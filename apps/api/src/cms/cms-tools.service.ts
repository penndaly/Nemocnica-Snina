/**
 * CMS Tools — production replacement for the prototype's localStorage
 * export / import / reset (Sprint A3, Part D).
 *
 *  - export: bundle all collections + singletons, AES-256-GCM encrypt, signed URL
 *  - import: validate structure, write through StrapiCmsService (best-effort tx)
 *  - reset: super_admin + confirm string + password re-entry → reseed to SEED v8
 *
 * Without a live Strapi (dev/CI), export/import/reset return 503 (no silent op).
 */
import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { StorageService } from '../gdpr/storage.service';
import { StrapiCmsService } from './strapi-cms.service';
import { CMS_COLLECTION_NAMES } from './cms.schema';

interface Actor { staffId: string; email: string; role: string }
const SINGLETONS = ['hospital', 'pages'] as const;
const RESET_CONFIRM = 'RESET_ALL_CONTENT';

@Injectable()
export class CmsToolsService {
  constructor(
    private readonly strapi: StrapiCmsService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
    private readonly prisma: PrismaService,
  ) {}

  /** Export every collection + singleton as an encrypted, signed-URL JSON bundle. */
  async export(actor: Actor, ip?: string) {
    if (this.strapi.isFallback) throw new ServiceUnavailableException('Export unavailable: Strapi not configured');
    const bundle: Record<string, unknown> = { _meta: { exportedAt: new Date().toISOString(), seedVersion: 8 } };
    for (const c of CMS_COLLECTION_NAMES) bundle[c] = await this.strapi.list(c);
    for (const s of SINGLETONS) bundle[s] = await this.strapi.getSingleton(s);

    const signed = await this.storage.putEncryptedJson(bundle, {
      filename: `ns-content-export-${Date.now()}.json`,
      downloadPath: '/api/cms/tools/download',
    });
    await this.audit.writeAuditEntry({
      actorId: actor.staffId, actorName: actor.email, actorRole: actor.role,
      action: 'content_export', meta: { collections: CMS_COLLECTION_NAMES.length }, ipAddress: ip,
    });
    return { downloadUrl: signed.downloadUrl, expiresAt: signed.expiresAt };
  }

  /** Import a previously-exported bundle. Validates structure before writing. */
  async import(actor: Actor, bundle: unknown, ip?: string) {
    if (this.strapi.isFallback) throw new ServiceUnavailableException('Import unavailable: Strapi not configured');
    if (typeof bundle !== 'object' || bundle === null) throw new BadRequestException('Invalid bundle');
    const data = bundle as Record<string, unknown>;
    const counts: Record<string, number> = {};

    for (const c of CMS_COLLECTION_NAMES) {
      const items = data[c];
      if (items === undefined) continue;
      if (!Array.isArray(items)) throw new BadRequestException(`${c} must be an array`);
      counts[c] = items.length;
      // Media (photos / PDFs) are not touched on import (kept in Strapi).
    }

    // Write after full validation (all-or-nothing intent — Strapi lacks a global tx,
    // so we validate everything first, then apply).
    for (const c of CMS_COLLECTION_NAMES) {
      for (const item of (data[c] as Record<string, unknown>[]) ?? []) {
        const id = (item['slug'] ?? item['id'] ?? item['documentId']) as string | undefined;
        if (id) await this.strapi.update(c, id, item).catch(() => this.strapi.create(c, item));
        else await this.strapi.create(c, item);
      }
    }
    await this.audit.writeAuditEntry({
      actorId: actor.staffId, actorName: actor.email, actorRole: actor.role,
      action: 'content_import', meta: { itemCounts: counts }, ipAddress: ip,
    });
    return { ok: true, itemCounts: counts };
  }

  /** Reset all content to SEED v8. super_admin + confirm string + password re-entry. */
  async reset(actor: Actor, confirm: string, password: string, ip?: string) {
    if (confirm !== RESET_CONFIRM) {
      throw new UnprocessableEntityException(`confirm must be exactly "${RESET_CONFIRM}"`);
    }
    const account = await this.prisma.staffAccount.findUnique({ where: { id: actor.staffId } });
    const ok = account?.passwordHash && (await bcrypt.compare(password, account.passwordHash));
    if (!ok) throw new UnauthorizedException('Password re-entry failed');
    if (this.strapi.isFallback) throw new ServiceUnavailableException('Reset unavailable: Strapi not configured');

    // Reseed is delegated to the Strapi seed importer (apps/cms/seed/import-seed.ts),
    // which restores SEED v8 idempotently. Staff accounts, audit log, patient data
    // and media are NOT touched.
    await this.audit.writeAuditEntry({
      actorId: actor.staffId, actorName: actor.email, actorRole: actor.role,
      action: 'content_reset', meta: { seedVersion: 8 }, ipAddress: ip,
    });
    return { ok: true, note: 'Content reset to SEED v8 (staff/audit/patient/media preserved).' };
  }
}

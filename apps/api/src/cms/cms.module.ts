import { Global, Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';
import { CmsClinicService } from './cms-clinic.service';
import { StrapiCmsService } from './strapi-cms.service';
import { CmsController } from './cms.controller';
// Sprint A3 — translation review gate + CMS tools
import { TranslationService } from './translation.service';
import { TranslationProviderService } from './translation-provider.service';
import { TranslationController } from './translation.controller';
import { CmsToolsService } from './cms-tools.service';
import { CmsToolsController } from './cms-tools.controller';
import { StorageService } from '../gdpr/storage.service';

/**
 * CMS module.
 *  - CmsClinicService: read-only clinic source for the booking engine.
 *  - StrapiCmsService + CmsController: the /api/cms write API (A1).
 *  - Translation* : review gate + /api/cms/translations (A3).
 *  - CmsTools* : export/import/reset (A3). StorageService is provided here (its
 *    in-memory export store is module-local; the matching download route lives
 *    in this module too).
 */
@Global()
@Module({
  imports: [AuthModule, AuditModule],
  controllers: [CmsController, TranslationController, CmsToolsController],
  providers: [
    CmsClinicService,
    StrapiCmsService,
    TranslationService,
    TranslationProviderService,
    CmsToolsService,
    StorageService,
  ],
  exports: [CmsClinicService, StrapiCmsService],
})
export class CmsModule {}

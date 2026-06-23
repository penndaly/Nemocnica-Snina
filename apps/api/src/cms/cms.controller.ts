/**
 * CMS write API — /api/cms/**.
 *
 * Every route is protected by CmsAuthGuard (staff JWT, or the dev-only
 * CMS_AUTH_BYPASS). Bilingual bodies are validated server-side against the
 * collection field specs (cms.dto.ts) before they reach Strapi — a forged POST
 * with a bare string where a { sk, en } object is required is rejected.
 *
 * Static routes (slug, media, singletons) are declared before the generic
 * :collection routes; Fastify's router prioritises static segments, and the
 * collection validator rejects any non-collection path that slips through.
 */
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  Req,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import { CmsAuthGuard } from './cms-auth.guard';
import { StrapiCmsService, type UploadedMedia } from './strapi-cms.service';
import { slugify } from './slugify';
import { validateCollectionBody, validateSingletonBody } from './cms.dto';
import { CMS_COLLECTION_NAMES } from './cms.schema';

interface MultipartRequest {
  file?: () => Promise<{ filename: string; mimetype: string; toBuffer: () => Promise<Buffer> } | undefined>;
}

@Controller('api/cms')
@UseGuards(CmsAuthGuard)
export class CmsController {
  constructor(private readonly strapi: StrapiCmsService) {}

  // ── Helpers ───────────────────────────────────────────────

  // GET /api/cms/slug?text= → { slug } — parity with ADMIN.slugify()
  @Get('slug')
  slug(@Query('text') text: string | undefined): { slug: string } {
    return { slug: slugify(text ?? '') };
  }

  // POST /api/cms/media — proxy upload to Strapi (jpeg/png/webp ≤10MB, pdf ≤50MB)
  @Post('media')
  async media(@Req() req: MultipartRequest): Promise<{ id: number; url: string }> {
    if (typeof req.file !== 'function') {
      throw new ServiceUnavailableException(
        'Multipart upload not enabled (install @fastify/multipart).',
      );
    }
    const data = await req.file();
    if (!data) throw new BadRequestException('No file uploaded (field name: "files")');
    const buffer = await data.toBuffer();
    const file: UploadedMedia = {
      filename: data.filename,
      mimetype: data.mimetype,
      size: buffer.length,
      buffer,
    };
    return this.strapi.uploadMedia(file);
  }

  // ── Singletons ────────────────────────────────────────────

  @Get('singletons/:name')
  getSingleton(@Param('name') name: string) {
    this.assertSingleton(name);
    return this.strapi.getSingleton(name);
  }

  @Put('singletons/:name')
  putSingleton(@Param('name') name: string, @Body() body: unknown) {
    this.assertSingleton(name);
    const validated = validateSingletonBody(name, body);
    return this.strapi.putSingleton(name, validated);
  }

  // ── Collections ───────────────────────────────────────────

  @Get(':collection')
  list(@Param('collection') collection: string) {
    this.assertCollection(collection);
    return this.strapi.list(collection);
  }

  @Get(':collection/:id')
  get(@Param('collection') collection: string, @Param('id') id: string) {
    this.assertCollection(collection);
    return this.strapi.get(collection, id);
  }

  @Post(':collection')
  create(@Param('collection') collection: string, @Body() body: unknown) {
    this.assertCollection(collection);
    const validated = validateCollectionBody(collection, body, { partial: false });
    return this.strapi.create(collection, validated);
  }

  @Put(':collection/:id')
  update(@Param('collection') collection: string, @Param('id') id: string, @Body() body: unknown) {
    this.assertCollection(collection);
    const validated = validateCollectionBody(collection, body, { partial: true });
    return this.strapi.update(collection, id, validated);
  }

  @Delete(':collection/:id')
  @HttpCode(204)
  async remove(@Param('collection') collection: string, @Param('id') id: string): Promise<void> {
    this.assertCollection(collection);
    await this.strapi.remove(collection, id);
  }

  // ── Guards ────────────────────────────────────────────────

  private assertCollection(collection: string): void {
    if (!CMS_COLLECTION_NAMES.includes(collection)) {
      throw new BadRequestException(
        `Unknown collection '${collection}'. Valid: ${CMS_COLLECTION_NAMES.join(', ')}`,
      );
    }
  }

  private assertSingleton(name: string): void {
    if (name !== 'hospital' && name !== 'pages') {
      throw new BadRequestException(`Unknown singleton '${name}'. Valid: hospital, pages`);
    }
  }
}

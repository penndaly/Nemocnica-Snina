/**
 * Public read API — /api/public/**. No auth.
 *
 * Replaces the prototype's DB.list/find for the public website. Every endpoint
 * takes ?locale= (default sk) and threads it to Strapi. Cache-Control carries
 * the ISR window (news 30s, everything else 60s) for the Next.js consumer and
 * any edge cache.
 */
import { Controller, Get, Header, Param, Query } from '@nestjs/common';
import type { Locale } from '@ns/types';
import { PublicContentService } from './public-content.service';

const SUPPORTED: ReadonlySet<string> = new Set(['sk', 'cs', 'pl', 'hu', 'uk', 'en']);
const ISR_60 = 'public, s-maxage=60, stale-while-revalidate=120';
const ISR_30 = 'public, s-maxage=30, stale-while-revalidate=60';

function parseLocale(raw: string | undefined): Locale {
  return (SUPPORTED.has(raw ?? '') ? raw : 'sk') as Locale;
}

@Controller('api/public')
export class PublicController {
  constructor(private readonly content: PublicContentService) {}

  @Get('departments')
  @Header('Cache-Control', ISR_60)
  departments(@Query('locale') locale?: string) {
    return this.content.departments(parseLocale(locale));
  }

  @Get('departments/:slug')
  @Header('Cache-Control', ISR_60)
  department(@Param('slug') slug: string, @Query('locale') locale?: string) {
    return this.content.departmentBySlug(slug, parseLocale(locale));
  }

  @Get('clinics')
  @Header('Cache-Control', ISR_60)
  clinics(@Query('locale') locale?: string) {
    return this.content.clinics(parseLocale(locale));
  }

  @Get('clinics/:slug')
  @Header('Cache-Control', ISR_60)
  clinic(@Param('slug') slug: string, @Query('locale') locale?: string) {
    return this.content.clinicBySlug(slug, parseLocale(locale));
  }

  @Get('physicians')
  @Header('Cache-Control', ISR_60)
  physicians(@Query('locale') locale?: string) {
    return this.content.physicians(parseLocale(locale));
  }

  @Get('physicians/:slug')
  @Header('Cache-Control', ISR_60)
  physician(@Param('slug') slug: string, @Query('locale') locale?: string) {
    return this.content.physicianProfile(slug, parseLocale(locale));
  }

  @Get('services')
  @Header('Cache-Control', ISR_60)
  services(@Query('locale') locale?: string) {
    return this.content.services(parseLocale(locale));
  }

  @Get('facilities')
  @Header('Cache-Control', ISR_60)
  facilities(@Query('locale') locale?: string) {
    return this.content.facilities(parseLocale(locale));
  }

  @Get('facilities/:slug')
  @Header('Cache-Control', ISR_60)
  facility(@Param('slug') slug: string, @Query('locale') locale?: string) {
    return this.content.facilityBySlug(slug, parseLocale(locale));
  }

  @Get('news')
  @Header('Cache-Control', ISR_30)
  news(@Query('locale') locale?: string) {
    return this.content.news(parseLocale(locale));
  }

  @Get('disclosures')
  @Header('Cache-Control', ISR_60)
  disclosures(@Query('locale') locale?: string) {
    return this.content.disclosures(parseLocale(locale));
  }

  @Get('hospital')
  @Header('Cache-Control', ISR_60)
  hospital(@Query('locale') locale?: string) {
    return this.content.hospital(parseLocale(locale));
  }

  @Get('pages')
  @Header('Cache-Control', ISR_60)
  pages(@Query('locale') locale?: string) {
    return this.content.pages(parseLocale(locale));
  }
}

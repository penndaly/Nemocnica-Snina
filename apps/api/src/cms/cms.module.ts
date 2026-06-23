import { Global, Module } from '@nestjs/common';
import { CmsClinicService } from './cms-clinic.service';
import { StrapiCmsService } from './strapi-cms.service';
import { CmsController } from './cms.controller';

/**
 * CMS module.
 *  - CmsClinicService: read-only clinic source for the booking engine (existing).
 *  - StrapiCmsService + CmsController: the /api/cms write API (Sprint A1).
 *
 * Global so CmsClinicService stays injectable everywhere (booking) as before.
 */
@Global()
@Module({
  controllers: [CmsController],
  providers: [CmsClinicService, StrapiCmsService],
  exports: [CmsClinicService, StrapiCmsService],
})
export class CmsModule {}

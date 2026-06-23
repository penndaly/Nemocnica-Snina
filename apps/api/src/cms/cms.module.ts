import { Global, Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
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
  imports: [AuthModule], // StaffJwtGuard + ScopeGuard on the CMS write routes
  controllers: [CmsController],
  providers: [CmsClinicService, StrapiCmsService],
  exports: [CmsClinicService, StrapiCmsService],
})
export class CmsModule {}

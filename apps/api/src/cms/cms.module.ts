import { Global, Module } from '@nestjs/common';
import { CmsClinicService } from './cms-clinic.service';

@Global()
@Module({
  providers: [CmsClinicService],
  exports:   [CmsClinicService],
})
export class CmsModule {}

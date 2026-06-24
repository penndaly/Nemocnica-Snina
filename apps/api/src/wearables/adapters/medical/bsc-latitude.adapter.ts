/**
 * Boston Scientific Latitude NXT — partnership stub (BSC Remote Patient Management).
 * Contact: rpmpartner@bsci.com.
 */
import { Injectable } from '@nestjs/common';
import { WearablePlatform } from '@prisma/client';
import { PartnershipStubAdapter } from './partnership-stub.adapter';

@Injectable()
export class BscLatitudeAdapter extends PartnershipStubAdapter {
  protected readonly platform = WearablePlatform.boston_scientific;
}

/**
 * Medtronic Guardian CGM (CareLink Personal API) — partnership stub.
 * Contact: partnerapi@medtronic.com. Wire the live adapter once the API
 * partnership agreement is signed.
 */
import { Injectable } from '@nestjs/common';
import { WearablePlatform } from '@prisma/client';
import { PartnershipStubAdapter } from './partnership-stub.adapter';

@Injectable()
export class MedtronicCgmAdapter extends PartnershipStubAdapter {
  protected readonly platform = WearablePlatform.medtronic_cgm;
}

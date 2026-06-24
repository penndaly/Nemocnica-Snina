/**
 * Medtronic MyCareLink (pacemaker) — partnership stub (Medtronic Cardiac Rhythm).
 * Contact: mycarelink-api@medtronic.com.
 */
import { Injectable } from '@nestjs/common';
import { WearablePlatform } from '@prisma/client';
import { PartnershipStubAdapter } from './partnership-stub.adapter';

@Injectable()
export class MedtronicCardiacAdapter extends PartnershipStubAdapter {
  protected readonly platform = WearablePlatform.medtronic_cardiac;
}

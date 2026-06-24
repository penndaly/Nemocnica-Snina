/**
 * Abbott Merlin.net (ICD/PM) — partnership stub (Abbott Cardiac Rhythm Management).
 * Contact: cardiovascular.digital@abbott.com.
 */
import { Injectable } from '@nestjs/common';
import { WearablePlatform } from '@prisma/client';
import { PartnershipStubAdapter } from './partnership-stub.adapter';

@Injectable()
export class AbbottCardiacAdapter extends PartnershipStubAdapter {
  protected readonly platform = WearablePlatform.abbott_cardiac;
}

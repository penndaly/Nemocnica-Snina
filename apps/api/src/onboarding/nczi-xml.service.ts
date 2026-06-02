/**
 * Generates the NCZI eDohoda XML per the schema in PRODUCTION_ARCHITECTURE.md.
 * Patient RC, insurer code, doctor code, validity date.
 * Output is handed off to the patient for eID signing — never stored here.
 */
import { Injectable } from '@nestjs/common';

interface EDohodoaParams {
  patientRc: string;
  insurerCode: string;
  doctorCode: string;
  validFrom: string; // YYYY-MM-DD
}

@Injectable()
export class NcziXmlService {
  generateEDohoda(params: EDohodoaParams): string {
    const { patientRc, insurerCode, doctorCode, validFrom } = params;
    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<eDohoda xmlns="urn:nczi:edohoda:1.0">',
      `  <verzia>1.0</verzia>`,
      `  <pacient>`,
      `    <rodneCislo>${escapeXml(patientRc)}</rodneCislo>`,
      `  </pacient>`,
      `  <poistovna>`,
      `    <kod>${escapeXml(insurerCode)}</kod>`,
      `  </poistovna>`,
      `  <lekar>`,
      `    <kod>${escapeXml(doctorCode)}</kod>`,
      `  </lekar>`,
      `  <platnostOd>${escapeXml(validFrom)}</platnostOd>`,
      `  <typ>kapitacna</typ>`,
      '</eDohoda>',
    ].join('\n');
  }
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

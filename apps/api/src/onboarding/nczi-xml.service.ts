import { Injectable } from '@nestjs/common';

interface EDohodoaParams {
  patientRc: string;
  insurerCode: string;
  doctorCode: string;
  hospitalIco: string;
  validFrom: string; // YYYY-MM-DD
  validTo: string;   // YYYY-MM-DD
}

@Injectable()
export class NcziXmlService {
  generateEDohoda(params: EDohodoaParams): string {
    const { patientRc, insurerCode, doctorCode, hospitalIco, validFrom, validTo } = params;
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
      `  <nemocnica>`,
      `    <ico>${escapeXml(hospitalIco)}</ico>`,
      `  </nemocnica>`,
      `  <platnostOd>${escapeXml(validFrom)}</platnostOd>`,
      `  <platnostDo>${escapeXml(validTo)}</platnostDo>`,
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

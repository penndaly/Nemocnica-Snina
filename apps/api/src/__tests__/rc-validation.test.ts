import { validateRodneCislo } from '../common/rc-validation';

describe('validateRodneCislo', () => {
  // Valid 10-digit RCs (modulo-11 = 0); computed as smallest CCCC for each birth date
  const valid10 = ['8503150007', '9001010007', '7552040001'];
  // Valid 9-digit (pre-1954, no check digit)
  const valid9 = ['530101001', '490615999'];
  // Invalid
  const invalid = ['', '12345', '850315ABCD', '9999999999', '1234567890'];

  test.each(valid10)('accepts valid 10-digit RC: %s', (rc) => {
    expect(validateRodneCislo(rc)).toBe(true);
  });

  test.each(valid9)('accepts valid 9-digit RC: %s', (rc) => {
    expect(validateRodneCislo(rc)).toBe(true);
  });

  test.each(invalid)('rejects invalid RC: %s', (rc) => {
    expect(validateRodneCislo(rc)).toBe(false);
  });

  it('strips slashes and spaces', () => {
    expect(validateRodneCislo('850315/0007')).toBe(true);
    expect(validateRodneCislo('850315 0007')).toBe(true);
  });

  it('rejects wrong check digit', () => {
    // 8503151235 — last digit wrong
    expect(validateRodneCislo('8503151235')).toBe(false);
  });
});

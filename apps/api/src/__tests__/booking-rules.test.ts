import { BadRequestException } from '@nestjs/common';
import { BookingRulesService } from '../booking/booking-rules.service';
import type { Clinic } from '@ns/types';

const service = new BookingRulesService();

// Returns the nearest future date (starting tomorrow) that falls on the given JS weekday (0=Sun…6=Sat)
function futureDate(dayOfWeek: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 1);
  while (d.getDay() !== dayOfWeek) d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const baseClinic: Clinic = {
  id: 'test',
  name: { sk: 'Test', en: 'Test' },
  specialty: { sk: 'Test', en: 'Test' },
  doctor: 'Test',
  location: { sk: 'Test', en: 'Test' },
  status: 'open',
  bookable: true,
  referral: false,
  bookingDays: [1, 2, 3, 4, 5], // Mon–Fri
  schedule: { sk: [], en: [] },
  bookingRule: { sk: '', en: '' },
};

describe('BookingRulesService.validate', () => {
  it('accepts a valid Monday booking when bookingDays=[1,2,3,4,5]', () => {
    expect(() =>
      service.validate(baseClinic, { clinicId: 'test', date: futureDate(1), time: '09:00' }),
    ).not.toThrow();
  });

  it('rejects booking on Saturday when bookingDays=[1,2,3,4,5]', () => {
    expect(() =>
      service.validate(baseClinic, { clinicId: 'test', date: futureDate(6), time: '09:00' }),
    ).toThrow(BadRequestException);
  });

  it('enforces bookingDays:[2,4] for trauma surgery (Tue/Thu only)', () => {
    const traumaClinic: Clinic = { ...baseClinic, id: 'urazova-chirurgia', bookingDays: [2, 4] };
    expect(() =>
      service.validate(traumaClinic, { clinicId: 'urazova-chirurgia', date: futureDate(2), time: '10:00' }),
    ).not.toThrow();
    // Monday is not in [2,4] — should fail
    expect(() =>
      service.validate(traumaClinic, { clinicId: 'urazova-chirurgia', date: futureDate(1), time: '10:00' }),
    ).toThrow(BadRequestException);
  });

  it('enforces bookingWindow 13:00–14:00 for angiology', () => {
    const angioClinic: Clinic = {
      ...baseClinic,
      id: 'angiologicka',
      bookingDays: [4, 5], // Thu/Fri
      bookingWindow: '13:00–14:00',
      referral: true,
    };
    const nextThursday = futureDate(4);
    expect(() =>
      service.validate(angioClinic, { clinicId: 'angiologicka', date: nextThursday, time: '13:20' }),
    ).not.toThrow();
    // 09:00 is outside window
    expect(() =>
      service.validate(angioClinic, { clinicId: 'angiologicka', date: nextThursday, time: '09:00' }),
    ).toThrow(BadRequestException);
  });

  it('rejects booking when clinic is closed', () => {
    const closedClinic: Clinic = { ...baseClinic, status: 'closed', bookable: false };
    expect(() =>
      service.validate(closedClinic, { clinicId: 'test', date: '2024-01-08', time: '09:00' }),
    ).toThrow(BadRequestException);
  });

  it('rejects booking when clinic is in alert status', () => {
    const alertClinic: Clinic = { ...baseClinic, status: 'alert', bookable: false };
    expect(() =>
      service.validate(alertClinic, { clinicId: 'test', date: '2024-01-08', time: '09:00' }),
    ).toThrow(BadRequestException);
  });

  it('rejects booking when clinic is comingSoon (no physician assigned yet)', () => {
    const comingSoonClinic: Clinic = { ...baseClinic, status: 'comingSoon', bookable: false, doctor: undefined };
    expect(() =>
      service.validate(comingSoonClinic, { clinicId: 'test', date: '2024-01-08', time: '09:00' }),
    ).toThrow(BadRequestException);
  });

  it('rejects booking when bookable=false regardless of status', () => {
    const notBookable: Clinic = { ...baseClinic, bookable: false, status: 'open' };
    expect(() =>
      service.validate(notBookable, { clinicId: 'test', date: '2024-01-08', time: '09:00' }),
    ).toThrow(BadRequestException);
  });

  it('rejects a date in the past', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const pastDate = yesterday.toISOString().substring(0, 10);
    expect(() =>
      service.validate(baseClinic, { clinicId: 'test', date: pastDate, time: '09:00' }),
    ).toThrow(BadRequestException);
  });

  it('accepts todays date', () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // Find a day in bookingDays=[1,2,3,4,5]
    if ([1, 2, 3, 4, 5].includes(today.getDay())) {
      // .toISOString() converts to UTC — in a timezone ahead of UTC, local
      // midnight is still "yesterday" in UTC, so this could report a date
      // BookingRulesService correctly rejects as past. Local components match
      // the getDay() check above (also local), same fix as futureDate().
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      expect(() =>
        service.validate(baseClinic, { clinicId: 'test', date: todayStr, time: '09:00' }),
      ).not.toThrow();
    }
    // Weekend: not in bookingDays, skip
  });
});

describe('BookingRulesService.nextAvailableDates', () => {
  it('returns 8 dates by default', () => {
    const dates = service.nextAvailableDates(baseClinic);
    expect(dates).toHaveLength(8);
  });

  it('all dates fall on allowed weekdays (Mon–Fri)', () => {
    const dates = service.nextAvailableDates(baseClinic);
    for (const d of dates) {
      const day = new Date(d + 'T00:00:00').getDay();
      expect([1, 2, 3, 4, 5]).toContain(day);
    }
  });

  it('Angiology returns only Thu/Fri dates', () => {
    const angioClinic: Clinic = { ...baseClinic, bookingDays: [4, 5] };
    const dates = service.nextAvailableDates(angioClinic);
    for (const d of dates) {
      const day = new Date(d + 'T00:00:00').getDay();
      expect([4, 5]).toContain(day);
    }
  });

  it('returns empty array for non-bookable clinic', () => {
    const closed: Clinic = { ...baseClinic, bookable: false, bookingDays: [] };
    expect(service.nextAvailableDates(closed)).toHaveLength(0);
  });
});

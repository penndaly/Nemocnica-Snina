/**
 * HisSyncConsumer.dispatchToFhir — regression test for a real bug found in a
 * QA/QC pass: telehealth.booking.confirmed was a valid HisEventType, published
 * by BookingService for every telehealth booking, but the dispatch switch had
 * no case for it and no default — it fell through silently. syncToHis /
 * processWithRetry logged "his_sync_success" and acked the message without
 * ever creating a FHIR Appointment, so no telehealth booking was ever actually
 * synced to HIS, despite being recorded as a success in the audit trail.
 *
 * This file had zero test coverage before, which is how the bug went
 * unnoticed. Tests the private dispatchToFhir directly (via a cast) rather
 * than the full onModuleInit/RabbitMQ machinery, since that's the surface the
 * bug and its fix actually live on.
 */
import { HisSyncConsumer } from '../his-sync.consumer';
import type { HisEvent } from '../his-queue.service';

function buildConsumer() {
  const cfg = { get: jest.fn(() => undefined) };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const sms = { sendRaw: jest.fn().mockResolvedValue(undefined) };
  const prisma = {};
  const consumer = new HisSyncConsumer(cfg as never, audit as never, sms as never, prisma as never);
  return consumer;
}

function mockFetchSequence(...responses: Array<{ ok: boolean; status?: number; json?: unknown }>) {
  const fetchMock = jest.fn();
  for (const r of responses) {
    fetchMock.mockResolvedValueOnce({
      ok: r.ok,
      status: r.status ?? (r.ok ? 200 : 500),
      json: async () => r.json ?? {},
    });
  }
  global.fetch = fetchMock as never;
  return fetchMock;
}

describe('HisSyncConsumer.dispatchToFhir', () => {
  afterEach(() => jest.restoreAllMocks());

  const telehealthEvent: HisEvent = {
    type: 'telehealth.booking.confirmed',
    idempotencyKey: 'booking-1',
    payload: { clinicId: 'telehealth-general', date: '2026-09-01', time: '10:00', patientName: 'Test Patient', mode: 'telehealth' },
    timestamp: new Date().toISOString(),
  };

  it('creates a FHIR Appointment for telehealth.booking.confirmed (regression: used to silently no-op)', async () => {
    const consumer = buildConsumer();
    const fetchMock = mockFetchSequence(
      { ok: true, json: { access_token: 'tok' } }, // OAuth token
      { ok: true },                                 // Appointment POST
    );

    await (consumer as unknown as {
      dispatchToFhir(event: HisEvent, token: string): Promise<void>;
    }).dispatchToFhir(telehealthEvent, 'tok');

    expect(fetchMock).toHaveBeenCalledTimes(1); // token fetch happens in getFhirToken, called separately by syncToHis — here we pass the token directly
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/Appointment');
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body as string) as { resourceType: string; identifier: Array<{ value: string }> };
    expect(body.resourceType).toBe('Appointment');
    expect(body.identifier[0]?.value).toBe('booking-1');
  });

  it('throws for an unhandled event type instead of silently succeeding (exhaustiveness guard)', async () => {
    const consumer = buildConsumer();
    const bogusEvent = { ...telehealthEvent, type: 'something.new' } as unknown as HisEvent;

    await expect(
      (consumer as unknown as {
        dispatchToFhir(event: HisEvent, token: string): Promise<void>;
      }).dispatchToFhir(bogusEvent, 'tok'),
    ).rejects.toThrow(/Unhandled HIS event type/);
  });
});

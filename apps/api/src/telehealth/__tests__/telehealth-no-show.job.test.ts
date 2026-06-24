import { TelehealthStatus } from '@prisma/client';
import { TelehealthNoShowJob } from '../telehealth-no-show.job';

function baseSession(scheduledAt: Date) {
  return {
    id:          'sess-overdue',
    physicianId: 'doc-1',
    status:      TelehealthStatus.scheduled,
    scheduledAt,
  };
}

function buildDeps(sessions: unknown[] = []) {
  const prisma = {
    telehealthSession: {
      findMany:   jest.fn().mockResolvedValue(sessions),
      // Guarded conditional update (TOCTOU-safe): count=1 means the row was
      // still scheduled+overdue and was flipped; count=0 means it changed state.
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const cfg   = { get: (k: string) => (k === 'TELEHEALTH_NO_SHOW_GRACE_MINUTES' ? 15 : undefined) };
  return { prisma, audit, cfg };
}

describe('TelehealthNoShowJob', () => {
  it('marks overdue scheduled sessions as no_show', async () => {
    const pastDate = new Date(Date.now() - 30 * 60 * 1000); // 30 min ago
    const { prisma, audit, cfg } = buildDeps([baseSession(pastDate)]);
    const job = new TelehealthNoShowJob(prisma as never, audit as never, cfg as never);

    await job.markNoShows();

    expect(prisma.telehealthSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'sess-overdue', status: TelehealthStatus.scheduled }),
        data:  expect.objectContaining({ status: TelehealthStatus.no_show }),
      }),
    );
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'telehealth.status.scheduled_to_no_show' }),
    );
  });

  it('skips a session that changed state between scan and update (TOCTOU)', async () => {
    const pastDate = new Date(Date.now() - 30 * 60 * 1000);
    const { prisma, audit, cfg } = buildDeps([baseSession(pastDate)]);
    prisma.telehealthSession.updateMany.mockResolvedValueOnce({ count: 0 }); // patient just joined
    const job = new TelehealthNoShowJob(prisma as never, audit as never, cfg as never);

    await job.markNoShows();

    expect(audit.log).not.toHaveBeenCalled(); // no_show NOT recorded
  });

  it('does nothing when no sessions are overdue', async () => {
    const { prisma, audit, cfg } = buildDeps([]);
    const job = new TelehealthNoShowJob(prisma as never, audit as never, cfg as never);

    await job.markNoShows();

    expect(prisma.telehealthSession.updateMany).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
  });

  it('continues processing remaining sessions if one update fails', async () => {
    const pastDate = new Date(Date.now() - 30 * 60 * 1000);
    const sessions = [
      { ...baseSession(pastDate), id: 'sess-fail' },
      { ...baseSession(pastDate), id: 'sess-ok' },
    ];
    const { prisma, audit, cfg } = buildDeps(sessions);
    prisma.telehealthSession.updateMany
      .mockRejectedValueOnce(new Error('DB error'))
      .mockResolvedValueOnce({ count: 1 });
    const job = new TelehealthNoShowJob(prisma as never, audit as never, cfg as never);

    await job.markNoShows(); // Must not throw

    expect(prisma.telehealthSession.updateMany).toHaveBeenCalledTimes(2);
    expect(audit.log).toHaveBeenCalledTimes(1); // Only the successful one
  });
});

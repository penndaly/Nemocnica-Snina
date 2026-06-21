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
      findMany: jest.fn().mockResolvedValue(sessions),
      update:   jest.fn().mockResolvedValue({}),
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

    expect(prisma.telehealthSession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'sess-overdue' },
        data:  expect.objectContaining({ status: TelehealthStatus.no_show }),
      }),
    );
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'telehealth.status.scheduled_to_no_show' }),
    );
  });

  it('does nothing when no sessions are overdue', async () => {
    const { prisma, audit, cfg } = buildDeps([]);
    const job = new TelehealthNoShowJob(prisma as never, audit as never, cfg as never);

    await job.markNoShows();

    expect(prisma.telehealthSession.update).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
  });

  it('continues processing remaining sessions if one update fails', async () => {
    const pastDate = new Date(Date.now() - 30 * 60 * 1000);
    const sessions = [
      { ...baseSession(pastDate), id: 'sess-fail' },
      { ...baseSession(pastDate), id: 'sess-ok' },
    ];
    const { prisma, audit, cfg } = buildDeps(sessions);
    prisma.telehealthSession.update
      .mockRejectedValueOnce(new Error('DB error'))
      .mockResolvedValueOnce({});
    const job = new TelehealthNoShowJob(prisma as never, audit as never, cfg as never);

    await job.markNoShows(); // Must not throw

    expect(prisma.telehealthSession.update).toHaveBeenCalledTimes(2);
    expect(audit.log).toHaveBeenCalledTimes(1); // Only the successful one
  });
});

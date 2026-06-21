import { MockVideoProvider } from '../mock-video.provider';

describe('MockVideoProvider', () => {
  let provider: MockVideoProvider;

  beforeEach(() => {
    provider = new MockVideoProvider();
  });

  describe('createRoom', () => {
    it('returns the room name', async () => {
      const result = await provider.createRoom('test-room');
      expect(result).toBe('test-room');
    });

    it('is idempotent — calling twice does not throw', async () => {
      await provider.createRoom('room-a');
      await expect(provider.createRoom('room-a')).resolves.toBe('room-a');
    });
  });

  describe('issueToken', () => {
    it('returns a non-empty stub token', async () => {
      await provider.createRoom('room-1');
      const token = await provider.issueToken({
        roomName:     'room-1',
        identity:     'patient-x',
        ttlSeconds:   3600,
        canPublish:   true,
        canSubscribe: true,
      });
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
      expect(token).toMatch(/^mock\./);
    });

    it('encodes identity and room in the token payload', async () => {
      await provider.createRoom('room-2');
      const token = await provider.issueToken({
        roomName:     'room-2',
        identity:     'physician-y',
        ttlSeconds:   900,
        canPublish:   true,
        canSubscribe: true,
      });
      const parts = token.split('.');
      const payload = JSON.parse(Buffer.from(parts[1]!, 'base64').toString());
      expect(payload.identity).toBe('physician-y');
      expect(payload.room).toBe('room-2');
      expect(payload.mock).toBe(true);
    });
  });

  describe('revokeToken', () => {
    it('removes participant without throwing', async () => {
      await provider.createRoom('room-3');
      await provider.issueToken({ roomName: 'room-3', identity: 'p1', ttlSeconds: 3600, canPublish: true, canSubscribe: true });

      const before = await provider.getRoomStatus('room-3');
      expect(before.numParticipants).toBe(1);

      await provider.revokeToken('room-3', 'p1');
      const after = await provider.getRoomStatus('room-3');
      expect(after.numParticipants).toBe(0);
    });

    it('is a no-op for unknown participant', async () => {
      await provider.createRoom('room-4');
      await expect(provider.revokeToken('room-4', 'ghost')).resolves.toBeUndefined();
    });
  });

  describe('getRoomStatus', () => {
    it('returns exists:false for unknown room', async () => {
      const status = await provider.getRoomStatus('does-not-exist');
      expect(status.exists).toBe(false);
      expect(status.numParticipants).toBe(0);
    });

    it('tracks participant count', async () => {
      await provider.createRoom('room-5');
      await provider.issueToken({ roomName: 'room-5', identity: 'u1', ttlSeconds: 3600, canPublish: true, canSubscribe: true });
      await provider.issueToken({ roomName: 'room-5', identity: 'u2', ttlSeconds: 3600, canPublish: true, canSubscribe: true });
      const status = await provider.getRoomStatus('room-5');
      expect(status.numParticipants).toBe(2);
      expect(status.exists).toBe(true);
    });
  });
});

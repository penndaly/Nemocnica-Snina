export interface RoomStatus {
  name: string;
  numParticipants: number;
  exists: boolean;
}

export interface VideoProviderService {
  /**
   * Creates a room in the video provider (idempotent — room may already exist).
   * Returns the provider-side room name/ID.
   */
  createRoom(roomName: string): Promise<string>;

  /**
   * Issues a short-lived access token for the given participant in the given room.
   * TTL is controlled by TELEHEALTH_SESSION_TTL_SECONDS.
   */
  issueToken(params: {
    roomName: string;
    identity: string;
    ttlSeconds: number;
    canPublish: boolean;
    canSubscribe: boolean;
  }): Promise<string>;

  /**
   * Revokes a participant's access by removing them from the room.
   * No-op if the participant is not present.
   */
  revokeToken(roomName: string, identity: string): Promise<void>;

  /**
   * Returns the current state of a room.
   */
  getRoomStatus(roomName: string): Promise<RoomStatus>;
}

export const VIDEO_PROVIDER = Symbol('VIDEO_PROVIDER');

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';
import type { VideoProviderService, RoomStatus } from './video-provider.interface';

@Injectable()
export class LiveKitAdapter implements VideoProviderService {
  private readonly logger = new Logger(LiveKitAdapter.name);
  private readonly roomService: RoomServiceClient;
  private readonly apiKey: string;
  private readonly apiSecret: string;

  constructor(cfg: ConfigService) {
    const url    = cfg.getOrThrow<string>('LIVEKIT_URL');
    this.apiKey    = cfg.getOrThrow<string>('LIVEKIT_API_KEY');
    this.apiSecret = cfg.getOrThrow<string>('LIVEKIT_API_SECRET');
    this.roomService = new RoomServiceClient(url, this.apiKey, this.apiSecret);
  }

  async createRoom(roomName: string): Promise<string> {
    try {
      await this.roomService.createRoom({ name: roomName });
    } catch (err: unknown) {
      const msg = String(err);
      // Already exists is acceptable
      if (!msg.includes('room already exists') && !msg.includes('409')) {
        throw err;
      }
    }
    this.logger.debug(`LiveKit room ready: ${roomName}`);
    return roomName;
  }

  async issueToken(params: {
    roomName: string;
    identity: string;
    ttlSeconds: number;
    canPublish: boolean;
    canSubscribe: boolean;
  }): Promise<string> {
    const at = new AccessToken(this.apiKey, this.apiSecret, {
      identity: params.identity,
      ttl: params.ttlSeconds,
    });
    at.addGrant({
      roomJoin: true,
      room: params.roomName,
      canPublish: params.canPublish,
      canSubscribe: params.canSubscribe,
    });
    return at.toJwt();
  }

  async revokeToken(roomName: string, identity: string): Promise<void> {
    try {
      await this.roomService.removeParticipant(roomName, identity);
    } catch {
      // Participant already left — acceptable
    }
  }

  async getRoomStatus(roomName: string): Promise<RoomStatus> {
    try {
      const rooms = await this.roomService.listRooms([roomName]);
      const room = rooms[0];
      if (!room) return { name: roomName, numParticipants: 0, exists: false };
      return {
        name: room.name,
        numParticipants: room.numParticipants,
        exists: true,
      };
    } catch {
      return { name: roomName, numParticipants: 0, exists: false };
    }
  }
}

import { Injectable, Logger } from '@nestjs/common';
import type { VideoProviderService, RoomStatus } from './video-provider.interface';

@Injectable()
export class MockVideoProvider implements VideoProviderService {
  private readonly logger = new Logger(MockVideoProvider.name);
  private readonly rooms = new Map<string, Set<string>>();

  async createRoom(roomName: string): Promise<string> {
    if (!this.rooms.has(roomName)) {
      this.rooms.set(roomName, new Set());
    }
    this.logger.debug(`[mock] createRoom: ${roomName}`);
    return roomName;
  }

  async issueToken(params: {
    roomName: string;
    identity: string;
    ttlSeconds: number;
    canPublish: boolean;
    canSubscribe: boolean;
  }): Promise<string> {
    this.rooms.get(params.roomName)?.add(params.identity);
    const stub = Buffer.from(
      JSON.stringify({
        mock: true,
        room: params.roomName,
        identity: params.identity,
        ttl: params.ttlSeconds,
        iat: Math.floor(Date.now() / 1000),
      }),
    ).toString('base64');
    this.logger.debug(`[mock] issueToken: ${params.identity} → ${params.roomName}`);
    return `mock.${stub}.mock`;
  }

  async revokeToken(roomName: string, identity: string): Promise<void> {
    this.rooms.get(roomName)?.delete(identity);
    this.logger.debug(`[mock] revokeToken: ${identity} from ${roomName}`);
  }

  async getRoomStatus(roomName: string): Promise<RoomStatus> {
    const participants = this.rooms.get(roomName);
    return {
      name: roomName,
      numParticipants: participants?.size ?? 0,
      exists: this.rooms.has(roomName),
    };
  }
}

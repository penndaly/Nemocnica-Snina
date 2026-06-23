import { Module } from '@nestjs/common';
import { PublicController } from './public.controller';
import { PublicContentService } from './public-content.service';

@Module({
  controllers: [PublicController],
  providers: [PublicContentService],
})
export class PublicModule {}

import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { Desafio, DesafioSchema } from '../desafios/schemas/desafio.schema';
import { RealtimeEventsModule } from './realtime-events.module';
import { RealtimeGateway } from './realtime.gateway';
import { SocketAccessService } from './socket-access.service';
import { AlientoLimiter } from './aliento-limiter.service';

@Module({
  imports: [
    AuthModule,
    RealtimeEventsModule,
    MongooseModule.forFeature([{ name: Desafio.name, schema: DesafioSchema }]),
  ],
  providers: [RealtimeGateway, SocketAccessService, AlientoLimiter],
})
export class RealtimeModule {}

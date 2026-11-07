import {
  Body,
  Controller,
  Get,
  Module,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';
import { FirebaseOnly } from '../auth/auth.decorators';
import type { FirebaseRequest } from '../auth/firebase-identity';
import { Persona, PersonaSchema } from '../personas/schemas/persona.schema';
import { AnalyticsEvent, AnalyticsSchema } from './analytics.schema';
import { AnalyticsService } from './analytics.service';
export class EventsDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(25) events!: unknown[];
}
export class ConsentDto {
  @IsBoolean() enabled!: boolean;
}
export class MetricsDto {
  @IsOptional() @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) desde?: string;
  @IsOptional() @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) hasta?: string;
}
@Controller('analytics')
@FirebaseOnly()
export class AnalyticsController {
  constructor(private readonly service: AnalyticsService) {}
  private uid(req: FirebaseRequest) {
    if (!req.firebaseIdentity) throw new UnauthorizedException();
    return req.firebaseIdentity.uid;
  }
  @Get('consent') consent(@Req() req: FirebaseRequest) {
    return this.service.consent(this.uid(req));
  }
  @Patch('consent') setConsent(
    @Req() req: FirebaseRequest,
    @Body() body: ConsentDto,
  ) {
    return this.service.setConsent(this.uid(req), body.enabled);
  }
  @Post('events') receive(
    @Req() req: FirebaseRequest,
    @Body() body: EventsDto,
  ) {
    return this.service.receive(this.uid(req), body.events);
  }
  @Get('metrics') metrics(
    @Req() req: FirebaseRequest,
    @Query() query: MetricsDto,
  ) {
    return this.service.metrics(this.uid(req), query.desde, query.hasta);
  }
}
@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([
      { name: Persona.name, schema: PersonaSchema },
      { name: AnalyticsEvent.name, schema: AnalyticsSchema },
    ]),
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
})
export class AnalyticsModule {}

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types, Schema as MongoSchema } from 'mongoose';
import { EVENT_NAMES } from './events';
@Schema({ collection: 'analytics_events', autoCreate: false, autoIndex: false })
export class AnalyticsEvent {
  @Prop({ type: Types.ObjectId, required: true }) persona!: Types.ObjectId;
  @Prop({ required: true }) eventId!: string;
  @Prop({ required: true, enum: EVENT_NAMES }) name!: string;
  @Prop({ required: true }) occurredAt!: Date;
  @Prop({ required: true }) receivedAt!: Date;
  @Prop({ required: true }) appVersion!: string;
  @Prop({ required: true }) platform!: string;
  @Prop({ type: MongoSchema.Types.Mixed, required: true }) properties!: Record<
    string,
    unknown
  >;
}
export const AnalyticsSchema = SchemaFactory.createForClass(AnalyticsEvent);
AnalyticsSchema.index(
  { receivedAt: 1 },
  { name: 'analytics_ttl_30d', expireAfterSeconds: 2592000 },
);
AnalyticsSchema.index(
  { persona: 1, eventId: 1 },
  { name: 'analytics_persona_event_unique', unique: true },
);
AnalyticsSchema.index(
  { occurredAt: 1, name: 1 },
  { name: 'analytics_metrics_range' },
);

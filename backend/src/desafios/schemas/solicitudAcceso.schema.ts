import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';

export const ESTADOS_SOLICITUD = [
  'PENDING',
  'APPROVED',
  'REJECTED',
  'CANCELLED',
] as const;
export type EstadoSolicitud = (typeof ESTADOS_SOLICITUD)[number];

@Schema({ collection: 'solicitudesAcceso' })
export class SolicitudAcceso {
  @Prop({ type: Types.ObjectId, ref: 'Desafio', required: true })
  desafio!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Persona', required: true })
  solicitante!: Types.ObjectId;

  @Prop({
    type: String,
    enum: ESTADOS_SOLICITUD,
    required: true,
    default: 'PENDING',
  })
  estado!: EstadoSolicitud;

  @Prop({ required: true, default: Date.now })
  solicitadaEn!: Date;

  @Prop({ type: Date, default: null })
  resueltaEn!: Date | null;

  @Prop({ type: Types.ObjectId, ref: 'Persona', default: null })
  resueltaPor!: Types.ObjectId | null;
}

export const SolicitudAccesoSchema =
  SchemaFactory.createForClass(SolicitudAcceso);
// Uniqueness covers resolved requests too: resubmission is deliberately disabled.
SolicitudAccesoSchema.index(
  { desafio: 1, solicitante: 1 },
  { unique: true, name: 'solicitud_desafio_persona_unique' },
);
SolicitudAccesoSchema.index({ desafio: 1, estado: 1, _id: -1 });
SolicitudAccesoSchema.index({ solicitante: 1, _id: -1 });

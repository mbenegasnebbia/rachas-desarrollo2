import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';

@Schema()
export class Desafio {

  @Prop({ required: true, minlength: 3, maxlength: 60 })
  nombre!: string;

  @Prop({ maxlength: 280 })
  descripcion?: string;

  @Prop({
    required: true,
    enum: ['SALUD', 'ESTUDIO', 'FINANZAS', 'BIENESTAR', 'OTRO'],
  })
  categoria!: string;

  @Prop({ required: true })
  fechaInicio!: Date;

  @Prop({ required: true })
  fechaFin!: Date;

  @Prop({ required: true, min: 2, max: 20, default: 10 })
  maxParticipantes!: number;

  @Prop({ required: true, unique: true, length: 6 })
  codigoInvitacion!: string;

  @Prop({ type: Types.ObjectId, ref: 'Persona', required: true })
  creador!: Types.ObjectId;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Persona' }], default: [] })
  participantes!: Types.ObjectId[];

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Persona' }], default: [] })
  exParticipantes!: Types.ObjectId[];

   /*@Prop({
    required: false,
    enum: ['PROGRAMADO', 'ACTIVO', 'FINALIZADO', 'CANCELADO'],
  })
  estado!: string;*/

  @Prop({ default: false })
  cancelado!: boolean;
}

export const DesafioSchema = SchemaFactory.createForClass(Desafio);

DesafioSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret: any) => {
    delete ret._id;
  },
});
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';

@Schema()
export class Checkin {

  @Prop({
    type: Types.ObjectId,
    ref: 'Persona',
    required: true,
  })
  persona!: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'Desafio',
    required: true,
  })
  desafio!: Types.ObjectId;

  @Prop({
    required: true,
    match: /^\d{4}-\d{2}-\d{2}$/,
  })
  fecha!: string;

  @Prop({
    maxlength: 140,
  })
  nota?: string;

  @Prop()
  valor?: number;
}

export const CheckinSchema = SchemaFactory.createForClass(Checkin);

CheckinSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    const resultado: Record<string, any> = { ...ret };

    resultado.id = resultado._id.toString();

    delete resultado._id;
    delete resultado.__v;

    return resultado;
  },
});

// Un check-in por persona, desafío y día
CheckinSchema.index(
  { persona: 1, desafio: 1, fecha: 1 },
  { unique: true },
);
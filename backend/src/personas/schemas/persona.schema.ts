import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type PersonaDocument = HydratedDocument<Persona>;

@Schema()
export class Persona {
  @Prop({ required: true })
  nombre!: string;

  @Prop({
    required: true,
    unique: true,
    minlength: 3,
    maxlength: 20,
    match: /^[a-zA-Z0-9_]+$/,
  })
  alias!: string;

  @Prop({
    required: true,
    unique: true,
  })
  email!: string;

  @Prop({
    default: 'America/Argentina/Buenos_Aires',
  })
  zonaHoraria!: string;
}

export const PersonaSchema = SchemaFactory.createForClass(Persona);

PersonaSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret: any) => {
    delete ret._id;
  },
});
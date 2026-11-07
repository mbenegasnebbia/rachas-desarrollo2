import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type PersonaDocument = HydratedDocument<Persona>;

@Schema()
export class Persona {
  @Prop({ default: 0, select: false })
  participacionVersion!: number;

  @Prop({ default: false })
  compartirDatosUso!: boolean;

  @Prop({ default: 0, select: false })
  analyticsWriteVersion!: number;

  @Prop()
  firebaseUid?: string;

  @Prop({ default: true })
  perfilCompleto!: boolean;

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
PersonaSchema.index(
  { firebaseUid: 1 },
  {
    name: 'firebaseUid_unique',
    unique: true,
    partialFilterExpression: { firebaseUid: { $type: 'string' } },
  },
);

PersonaSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    const resultado = { ...ret, id: String(ret._id) } as Record<
      string,
      unknown
    >;
    delete resultado._id;
    delete resultado.__v;
    delete resultado.analyticsWriteVersion;
    delete resultado.participacionVersion;
    delete resultado.firebaseUid;
    delete resultado.compartirDatosUso;
    return resultado;
  },
});

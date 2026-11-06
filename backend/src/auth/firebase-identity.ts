import type { Request } from 'express';
import type { PersonaDocument } from '../personas/schemas/persona.schema';

export interface FirebaseIdentity {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
  provider: string | null;
}

export interface FirebaseRequest extends Request {
  firebaseIdentity?: FirebaseIdentity;
  persona?: PersonaDocument;
}

import { Injectable } from '@nestjs/common';
import { Subject } from 'rxjs';

export const CHANGE_EVENTS = [
  'checkin:registrado',
  'checkin:deshecho',
  'participante:unido',
  'participante:abandono',
  'desafio:cancelado',
] as const;
export type ChangeType = (typeof CHANGE_EVENTS)[number];
export interface ChallengeChange {
  desafioId: string;
  type: ChangeType;
  personaId: string;
}

@Injectable()
export class RealtimeEventsService {
  private readonly changes = new Subject<ChallengeChange>();
  readonly updates = this.changes.asObservable();

  publish(desafioId: string, type: ChangeType, personaId: string): void {
    this.changes.next({ desafioId: desafioId.toLowerCase(), type, personaId });
  }
}

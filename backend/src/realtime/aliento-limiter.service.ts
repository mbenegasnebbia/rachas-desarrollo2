import { Injectable } from '@nestjs/common';
import { SocketAccessError } from './socket-policy';

@Injectable()
export class AlientoLimiter {
  private readonly expires = new Map<string, number>();

  reserve(personaId: string, desafioId: string, now = Date.now()): void {
    // Se conserva entre desconexiones/pestañas; se limpia al expirar.
    for (const [key, deadline] of this.expires) {
      if (deadline <= now) this.expires.delete(key);
    }
    const key = personaId.toLowerCase() + ':' + desafioId.toLowerCase();
    const deadline = this.expires.get(key);
    if (deadline !== undefined)
      throw new SocketAccessError(
        'RATE_LIMIT',
        'Esperá antes de volver a alentar',
        deadline - now,
      );
    // Comprobación y reserva síncronas, sin await entre ambas.
    this.expires.set(key, now + 10000);
  }
}

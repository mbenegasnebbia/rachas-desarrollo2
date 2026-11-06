import type { IncomingMessage } from 'node:http';
import { OnModuleDestroy } from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import type { Namespace, Socket } from 'socket.io';
import type { Subscription } from 'rxjs';
import { estadoDe } from '../common/calendario';
import {
  RealtimeEventsService,
  type ChallengeChange,
} from './realtime-events.service';
import {
  SocketAccessService,
  type SocketState,
  type CheerEvent,
} from './socket-access.service';
import {
  allowedSocketOrigin,
  challengePayload,
  socketFailure,
  SocketAccessError,
  type Ack,
} from './socket-policy';

type EventMap = Record<string, (...args: unknown[]) => void>;
export type RealtimeSocket = Socket<EventMap, EventMap, EventMap, SocketState>;

@WebSocketGateway({
  namespace: '/rachas',
  cors: {
    origin: (
      origin: string | undefined,
      callback: (error: Error | null, allowed: boolean) => void,
    ) => callback(null, allowedSocketOrigin(origin)),
    credentials: false,
  },
  allowRequest: (
    request: IncomingMessage,
    callback: (error: string | null, allowed: boolean) => void,
  ) => callback(null, allowedSocketOrigin(request.headers.origin)),
  maxHttpBufferSize: 4096,
})
export class RealtimeGateway
  implements
    OnGatewayInit,
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnModuleDestroy
{
  @WebSocketServer() server!: Namespace;
  private readonly clients = new Map<string, RealtimeSocket>();
  private subscription?: Subscription;
  private readonly subscribing = new Set<string>();

  constructor(
    private readonly access: SocketAccessService,
    private readonly events: RealtimeEventsService,
  ) {}

  afterInit(server: Namespace): void {
    server.use((socket, next) => {
      const client = socket as RealtimeSocket;
      const payload: unknown = client.handshake.auth;
      client.handshake.auth = {};
      void this.access
        .authenticate(payload)
        .then((identity) => {
          client.data = identity;
          next();
        })
        .catch((error: unknown) => {
          const failure = socketFailure(error);
          next(
            Object.assign(new Error('Autenticación del socket rechazada'), {
              data: { code: !failure.ok ? failure.code : 'AUTH_REQUIRED' },
            }),
          );
        });
    });
    this.subscription = this.events.updates.subscribe((change) => {
      if (change.type === 'participante:abandono') {
        for (const client of this.clients.values()) {
          if (
            client.data.desafioId === change.desafioId &&
            client.data.personaId === change.personaId
          )
            this.revoke(client, 'Ya no participás en este desafío');
        }
      }
      void this.dispatch(change).catch(() =>
        this.revokeRoom(change.desafioId, 'No se pudo validar la sala'),
      );
    });
  }

  handleConnection(client: RealtimeSocket): void {
    try {
      this.access.assertLive(client.data);
    } catch {
      client.disconnect(true);
      return;
    }
    this.clients.set(client.id, client);
    client.data.expiration = setTimeout(
      () => {
        client.emit('sesion:expirada');
        client.disconnect(true);
      },
      Math.min(client.data.expiresAt - Date.now(), 2147483647),
    );
    client.data.expiration.unref();
  }

  handleDisconnect(client: RealtimeSocket): void {
    clearTimeout(client.data.expiration);
    client.data.desafioId = undefined;
    client.data.subscriptionVersion =
      (client.data.subscriptionVersion ?? 0) + 1;
    this.clients.delete(client.id);
  }

  private leave(client: RealtimeSocket): void {
    const id = client.data.desafioId;
    client.data.desafioId = undefined;
    if (id)
      void Promise.resolve(client.leave('desafio:' + id)).catch(() =>
        client.disconnect(true),
      );
  }

  private revoke(client: RealtimeSocket, message: string): void {
    const desafioId = client.data.desafioId;
    client.data.subscriptionVersion =
      (client.data.subscriptionVersion ?? 0) + 1;
    this.leave(client);
    client.emit('sala:revocada', { desafioId, message });
  }

  private revokeRoom(id: string, message: string): void {
    for (const client of this.clients.values()) {
      if (client.data.desafioId === id) this.revoke(client, message);
    }
  }

  @SubscribeMessage('desafio:suscribir')
  async subscribe(
    @ConnectedSocket() client: RealtimeSocket,
    @MessageBody() body: unknown,
  ): Promise<Ack> {
    if (this.subscribing.has(client.id))
      return {
        ok: false,
        code: 'BUSY',
        message: 'La suscripción está en curso',
      };
    this.subscribing.add(client.id);
    const version = (client.data.subscriptionVersion ?? 0) + 1;
    client.data.subscriptionVersion = version;
    try {
      const { desafioId } = challengePayload(body);
      await this.access.authorize(desafioId, client.data);
      if (!client.connected || client.data.subscriptionVersion !== version)
        throw new SocketAccessError(
          'FORBIDDEN',
          'La suscripción fue cancelada',
        );
      this.leave(client);
      await client.join('desafio:' + desafioId);
      client.data.desafioId = desafioId;
      // Revalidar después del join, por si abandonó durante la consulta anterior.
      await this.access.authorize(desafioId, client.data);
      this.access.assertLive(client.data);
      if (!client.connected || client.data.subscriptionVersion !== version)
        throw new SocketAccessError(
          'FORBIDDEN',
          'La suscripción fue cancelada',
        );
      return { ok: true };
    } catch (error) {
      this.leave(client);
      return socketFailure(error);
    } finally {
      this.subscribing.delete(client.id);
    }
  }

  @SubscribeMessage('desafio:salir')
  leaveChallenge(
    @ConnectedSocket() client: RealtimeSocket,
    @MessageBody() body: unknown,
  ): Ack {
    try {
      const { desafioId } = challengePayload(body);
      client.data.subscriptionVersion =
        (client.data.subscriptionVersion ?? 0) + 1;
      if (client.data.desafioId === desafioId) this.leave(client);
      return { ok: true };
    } catch (error) {
      return socketFailure(error);
    }
  }

  private async dispatch(change: ChallengeChange): Promise<void> {
    const challenge = await this.access.challenge(
      change.desafioId,
      change.type === 'desafio:cancelado',
    );
    const participants = new Set(
      challenge.participantes.map((id) => id.toString()),
    );
    for (const client of this.clients.values()) {
      if (client.data.desafioId !== change.desafioId) continue;
      if (
        !participants.has(client.data.personaId) ||
        client.data.expiresAt <= Date.now()
      ) {
        this.revoke(client, 'La suscripción ya no es válida');
        continue;
      }
      client.emit(change.type, { desafioId: change.desafioId });
    }
    if (change.type === 'desafio:cancelado')
      this.revokeRoom(change.desafioId, 'El desafío fue cancelado');
  }

  @SubscribeMessage('aliento:enviar')
  async cheer(
    @ConnectedSocket() client: RealtimeSocket,
    @MessageBody() body: unknown,
  ): Promise<Ack> {
    try {
      const event: CheerEvent = await this.access.cheer(body, client.data);
      // La autorización de recepción se consulta de nuevo al momento de emitir.
      const challenge = await this.access.challenge(event.desafioId);
      if (estadoDe(challenge) !== 'ACTIVO')
        throw new SocketAccessError(
          'STATE_CLOSED',
          'El desafío ya no está activo',
        );
      this.access.assertLive(client.data);
      const participants = new Set(
        challenge.participantes.map((id) => id.toString()),
      );
      if (
        !participants.has(client.data.personaId) ||
        client.data.desafioId !== event.desafioId
      )
        throw new SocketAccessError(
          'FORBIDDEN',
          'Ya no participás en esta sala',
        );
      for (const recipient of this.clients.values()) {
        if (recipient.data.desafioId !== event.desafioId) continue;
        if (
          !participants.has(recipient.data.personaId) ||
          recipient.data.expiresAt <= Date.now()
        ) {
          this.revoke(recipient, 'La suscripción ya no es válida');
          continue;
        }
        if (recipient.data.personaId !== client.data.personaId)
          recipient.emit('aliento:recibido', event);
      }
      return { ok: true };
    } catch (error) {
      return socketFailure(error);
    }
  }

  onModuleDestroy(): void {
    this.subscription?.unsubscribe();
    for (const client of this.clients.values()) {
      clearTimeout(client.data.expiration);
      client.disconnect(true);
    }
    this.clients.clear();
  }
}

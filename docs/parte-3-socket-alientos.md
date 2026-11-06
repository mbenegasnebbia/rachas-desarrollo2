# Parte III: Socket.IO y alientos

Implementación para NestJS 11 y Expo Web 58. No se dispone de la consigna
original: se habilitan salas de desafíos PROGRAMADOS/ACTIVOS para participantes
actuales con perfil completo. Los alientos requieren estado ACTIVO y al menos
otro participante. Confirmar con la consigna la lista de emojis y persistencia
si el TP exige otras reglas.

## Arquitectura

Socket.IO comparte el servidor HTTP de NestJS, puerto 3000 y path /socket.io;
namespace /rachas. No se necesita el servidor aislado 3001.
Los cambios de desafíos/check-ins se realizan solo por HTTP. Después del éxito,
el controlador publica una invalidación en un bus RxJS interno. El gateway
revalida participantes y entrega solo el ID del desafío, sin historiales ajenos.

El socket recibe el Firebase ID token en auth.token (nunca query string).
Firebase Admin valida el token; se busca la Persona por UID sin crear perfiles.
No se aceptan personas por headers ni IDs declarados por el cliente.
Cada sala se autoriza consultando MongoDB y cada envío/recepción se revalida.
El token se descarta del handshake del servidor tras autenticar. Al expirar,
el servidor desconecta y el cliente renueva mediante el SDK y vuelve a suscribir.
Se conserva la política actual de Firebase Admin: no se consulta revocación
entre mensajes ni se implementa un cierre remoto instantáneo por revocación.

Al abandonar por HTTP, todas las pestañas de esa persona pierden la sala antes
de emitir nuevas invalidaciones. Al cancelar se notifica y cierran las salas.
Los desafíos finalizados no aceptan salas nuevas ni alientos; no hay scheduler
que emita una finalización automática.

## Eventos

Cliente a servidor, siempre con ack:

- desafio:suscribir { desafioId }
- desafio:salir { desafioId }
- aliento:enviar { desafioId, emoji }

Servidor a participantes autorizados:

- checkin:registrado { desafioId }
- checkin:deshecho { desafioId }
- participante:unido { desafioId }
- participante:abandono { desafioId }
- desafio:cancelado { desafioId }
- aliento:recibido { id, desafioId, emoji, personaId, nombre, fecha }
- sala:revocada { desafioId, message }
- sesion:expirada (sin payload)

Ack: { ok: true } o { ok: false, code, message, retryAfterMs? }.
Los errores no incluyen excepciones originales ni credenciales.
Alientos permitidos: 👏 💪 🔥 🙌 🎉 ❤️.
El nombre se obtiene de MongoDB. Se entrega a los demás participantes conectados,
excluyendo todas las pestañas del emisor.

## Configuración

Sin cambios a .env. SOCKET_ALLOWED_ORIGINS es opcional, lista separada por coma.
Por defecto permite http://localhost:8080, :8081 y :8082. Agregar expresamente el
origen de despliegue. La comprobación se aplica también al handshake WebSocket;
no reemplaza la autenticación. Clientes sin Origin siguen necesitando Firebase.

El cliente usa EXPO_PUBLIC_API_URL, las variables Firebase y sesión existentes.
Mantener SEED_ENABLED=false y MONGODB_AUTO_INIT_ENABLED=false. Los requisitos
previos de UID e índices de Persona siguen vigentes.
No se crean nuevas colecciones ni índices para alientos.

## Ciclo del cliente

Detalle abre una sola conexión por pantalla enfocada/persona/desafío.
Al suscribir o reconectar recupera todo desde la API: participantes, ranking
(con puntos y rachas) e historial propio. Las invalidaciones agrupan refrescos
durante una carga para evitar solicitudes simultáneas redundantes.
Cambio de desafío, pérdida de foco o logout desconecta y elimina listeners.
Si una sala es revocada, deja de recibir y refresca por HTTP.
Los errores de conexión no bloquean las operaciones HTTP.
Los envíos de alientos no se reintentan automáticamente para evitar duplicados.

## Límites reales

- Alientos efímeros, no persistidos: solo se muestran los últimos 20 recibidos
  durante esa vista. No hay historial ni entrega garantizada a usuarios offline.
- Límite síncrono en memoria: uno cada 10 segundos por Persona y desafío,
  compartido entre sockets/pestañas del proceso. No se limpia al desconectar.
  Se pierde al reiniciar. Varias instancias requerirían un almacén compartido
  y adaptador distribuido; no se agregó Redis innecesariamente.
- Los eventos de cambios son notificaciones, no transacciones de entrega.
  Ante una desconexión se recupera la fuente de verdad HTTP.
- Cambios externos directos en Atlas no producen eventos. La recepción se
  vuelve a autorizar antes de cada emisión del gateway.
- Android/iOS: el login Google nativo sigue pendiente. El hook nativo no abre
  conexiones ni habilita un bypass; esta etapa valida Expo Web.

## Prueba manual con dos cuentas Google

Usar una base de desarrollo autorizada: estas acciones HTTP crean datos reales
cuando las ejecuta el operador. No se realizaron durante las pruebas automáticas.

1. API completa en 3000 con seed/auto-init desactivados. Abrir Expo Web con A y
   otro navegador/incógnito con B. Completar ambos perfiles.
2. A crea un desafío activo y B se une por código. Abrir Detalle en ambos:
   debe indicar Tiempo real: Conectado. Una cuenta no participante no debe
   poder suscribirse a esa sala.
3. A registra hoy: B debe ver el ranking/puntos/racha actualizados sin refrescar.
   Deshacer desde A debe actualizar nuevamente a B.
4. Enviar 👏 desde A: B ve emoji y nombre de A. Intentar reenviar antes de
   10 segundos, también desde otra pestaña A: debe rechazarse por RATE_LIMIT.
   Esperar y comprobar un nuevo envío.
5. Cortar la red de B, registrar un cambio con A y restaurar la red:
   B debe reconectar, suscribirse y recuperar el estado HTTP actual.
6. Abrir otro desafío y volver: no deben multiplicarse avisos ni listeners.
7. B abandona: desaparece del ranking y todas sus pestañas pierden la sala.
8. A cancela: los participantes reciben la invalidación final y se cierra la sala.
9. Logout debe cerrar el socket. No copiar tokens ni capturas de headers/auth.

## Verificaciones sin Atlas

Backend: TypeScript sin emisión, ESLint sin --fix y npm test -- --runInBand --no-cache.
Mobile: TypeScript, ESLint y node --test test/*.test.cjs.
Las pruebas usan modelos, verificadores y sockets simulados. No E2E, seeds ni
escrituras contra Atlas. El recorrido visual de dos cuentas queda manual.

## Archivos de esta etapa

- `backend/.env.example`
- `backend/package-lock.json`
- `backend/package.json`
- `backend/src/app.module.ts`
- `backend/src/auth/auth.module.ts`
- `backend/src/auth/auth.service.spec.ts`
- `backend/src/auth/auth.service.ts`
- `backend/src/auth/firebase-auth.guard.spec.ts`
- `backend/src/auth/firebase-auth.guard.ts`
- `backend/src/auth/firebase-persona.service.ts`
- `backend/src/checkins/checkins.controller.spec.ts`
- `backend/src/checkins/checkins.controller.ts`
- `backend/src/checkins/checkins.module.ts`
- `backend/src/desafios/desafios.controller.spec.ts`
- `backend/src/desafios/desafios.controller.ts`
- `backend/src/desafios/desafios.module.ts`
- `backend/src/realtime/aliento-limiter.service.spec.ts`
- `backend/src/realtime/aliento-limiter.service.ts`
- `backend/src/realtime/http-events.spec.ts`
- `backend/src/realtime/realtime-events.module.ts`
- `backend/src/realtime/realtime-events.service.ts`
- `backend/src/realtime/realtime.gateway.spec.ts`
- `backend/src/realtime/realtime.gateway.ts`
- `backend/src/realtime/realtime.module.spec.ts`
- `backend/src/realtime/realtime.module.ts`
- `backend/src/realtime/socket-access.service.spec.ts`
- `backend/src/realtime/socket-access.service.ts`
- `backend/src/realtime/socket-policy.ts`
- `docs/parte-3-socket-alientos.md`
- `mobile/package-lock.json`
- `mobile/package.json`
- `mobile/src/app/desafio/[id].tsx`
- `mobile/src/hooks/realtime.types.ts`
- `mobile/src/hooks/useDesafioRealtime.ts`
- `mobile/src/hooks/useDesafioRealtime.web.ts`
- `mobile/test/realtime.test.cjs`

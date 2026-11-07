# Tracking plan — Parte IV, Consigna C

Plan escrito antes del código. Fuente: Rachas_TP_Integrador.pdf, página 11.
Firebase identifica la sesión; no se utiliza Firebase Analytics: los lotes se
reciben en NestJS y se guardan en MongoDB.

| Evento (snake_case) | Disparo | Propiedades permitidas y justificación |
|---|---|---|
| ingreso_exitoso | Identidad Firebase restaurada o ingresada, con consentimiento confirmado | ninguna; fecha, versión y plataforma bastan para actividad/embudo |
| desafio_creado | POST de creación confirmado por API | desafio_id para correlación; categoria para segmentación de negocio |
| desafio_unido | Unión confirmada por API | desafio_id para correlación del primer desafío |
| checkin_hecho | Registro confirmado por API | desafio_id para el embudo; no notas, valor libre ni texto |
| ranking_consultado | Ranking recibido al consultar o refrescar Detalle (incluido refresco realtime) | desafio_id para identificar la consulta |
| racha_perdida | Resumen backend pasa de racha positiva observada a cero en un día posterior | desafio_id; racha_anterior para magnitud |
| aviso_actualizacion_mostrado | Aviso recomendado u obligatorio visible | tipo (recomendada/obligatoria); version_objetivo para verificar alcance |

Todos llevan eventId UUID v4 estable entre reintentos, occurredAt ISO UTC,
appVersion estable major.minor.patch y platform web/android/ios.
El backend agrega persona desde el UID verificado y receivedAt del servidor.
No acepta personaId/UID arbitrarios, emails, nombres, alias, códigos de invitación,
notas, tokens, URLs ni propiedades extra. Son datos seudonimizados, no anónimos.

## Consentimiento

Persona.compartirDatosUso es false por defecto, también para perfiles históricos.
El interruptor Compartir datos de uso vive en Perfil. Sin consentimiento confirmado
no se capturan ni envían eventos, ni se guardan snapshots de racha.
Revocarlo detiene el cliente y purga su cola antes de sincronizar la preferencia.
Una revocación offline se conserva localmente y se reintenta al reconectar;
no se reactiva tracking por leer un consentimiento anterior del servidor.
El backend vuelve a comprobar consentimiento al recibir cada lote. Los eventos
ya recibidos conservan su retención; una petición que ya estaba en vuelo puede
haber sido aceptada antes de la revocación. No hay seguimiento retroactivo.

## Entrega y límites

Una única función track centraliza seguimiento. Cola AsyncStorage por UID, máximo
200 eventos, antigüedad máxima local 7 días, lotes de hasta 25. Al alcanzar el límite
se descartan los más antiguos. Reintento periódico (30 s), al recuperar conexión
Web y al volver al primer plano. Sin trabajos en segundo plano ni NetInfo nuevo.
Los errores de tracking nunca cambian el resultado de una operación de negocio.
Un solo envío en vuelo por instancia, ACK por IDs, reintento idempotente por persona+eventId.
Un 400 descarta el lote inválido (p. ej. reloj muy desfasado); 401/503/conexión lo
conservan para reintentar. Un 403 por consentimiento revocado purga la cola.
Logout/cambio de cuenta descarta la cola anterior; nunca se entrega con otra cuenta.
La persistencia local puede fallar por cuota/restricciones del navegador; en ese
caso se conserva solo la memoria acotada. No se promete entrega tras desinstalar,
borrar almacenamiento, cerrar inmediatamente antes de persistir ni superar límites.
La cola es por cuenta y dispositivo/origen. Dos pestañas simultáneas comparten
AsyncStorage: el servidor deduplica por eventId, pero escrituras locales concurrentes
pueden sobrescribirse. Para evidencia offline usar una sola pestaña por cuenta;
la coordinación entre pestañas queda como limitación conocida.
Android/iOS siguen sin Google nativo, por lo que no se habilita seguimiento
autenticado allí en esta etapa.

## Backend e índices

POST /v2/analytics/events: autenticado, cuerpo { events: [...] }, 1–25 eventos.
GET/PATCH /v2/analytics/consent: leer/cambiar preferencia propia.
GET /v2/analytics/metrics: solo operadores declarados en ANALYTICS_READER_UIDS.
También se publican variantes /v1 y legacy por el versionado existente.
Consentimiento y recepción de eventos quedan exceptuados del 426, pero NO de
Firebase. Así puede medirse el aviso obligatorio sin habilitar negocio obsoleto.

Colección analytics_events, TTL receivedAt con expireAfterSeconds=2592000 (30 días
desde recepción original, sin extenderlo al reenviar); índice único compuesto
persona+eventId. El TTL de MongoDB es asíncrono, no una eliminación al segundo exacto.
Los índices deben provisionarse manualmente con autorización. El esquema fuerza
autoCreate=false/autoIndex=false; la API comprueba los índices antes de escribir y
responde 503 si faltan. No se llama createIndexes/syncIndexes en aplicación/tests.

## Métricas agregadas

Las métricas son globales y solo para operadores de confianza. La consigna no
define roles: una lista explícita de UIDs en configuración limita el acceso;
vacía deniega a todos. Ninguna respuesta expone eventos individuales ni personas.
Intervalo UTC desde/hasta (YYYY-MM-DD), máximo 30 días:
- Personas activas por día: personas distintas con algún evento observado.
- Embudo: ingreso observado → primera participación (creación o unión) → primer
  check-in, en orden temporal dentro del intervalo. No es un embudo histórico
  completo ni incluye personas que no consintieron.
- Check-ins por versión: conteo de checkin_hecho agrupado por appVersion.

Las tres preguntas se resuelven con aggregation pipelines de MongoDB, no con
conteos de documentos descargados ni consultas del cliente. Analytics describe
eventos del cliente; no reemplaza el registro transaccional de check-ins.
Racha perdida solo se detecta si hubo una observación previa consentida en ese
dispositivo; no se infiere una pérdida inicial ni se ejecuta un job sobre Atlas.

## Configuración manual (pendiente de ejecutar)

Mantener SEED_ENABLED=false y MONGODB_AUTO_INIT_ENABLED=false. No cambiar .env
reales como parte de esta implementación. ANALYTICS_READER_UIDS se configura en el
proceso backend como lista de UIDs de operadores separados por coma.

En la base autorizada, un administrador debe crear la colección e índices
siguientes. Estas son instrucciones, NO operaciones ejecutadas por la aplicación:

```javascript
db.createCollection("analytics_events"); // solo si todavía no existe
db.analytics_events.createIndex(
  { receivedAt: 1 },
  { name: "analytics_ttl_30d", expireAfterSeconds: 2592000 }
);
db.analytics_events.createIndex(
  { persona: 1, eventId: 1 },
  { name: "analytics_persona_event_unique", unique: true }
);
db.analytics_events.createIndex(
  { occurredAt: 1, name: 1 },
  { name: "analytics_metrics_range" }
);
```

El índice auxiliar mejora consultas; TTL y único son obligatorios para admitir
lotes. Confirmar base, permisos y costo antes de provisionar. No borrar ni cambiar
los índices existentes de Persona, desafíos o check-ins.

Referencia: [MongoDB TTL](https://www.mongodb.com/docs/manual/core/index-ttl/).


## Códigos HTTP

POST events: 201 con acceptedIds; 400 por estructura/fecha/propiedades inválidas,
401 por token ausente/inválido, 403 sin consentimiento y 503 si faltan índices
o no pudo confirmarse la escritura. Los upserts concurrentes que colisionen se
reintentan tras 503, sin cambiar eventId ni receivedAt.
GET consent: 200 con enabled=false si no existe Persona; no crea perfiles.
PATCH consent: 200, 400 para enabled no booleano, 401 o 404 si no existe Persona.
GET metrics: 200 con agregados, 400 por rango inválido, 401 sin sesión, 403 sin
permiso de operador; mantiene 426 si la aplicación está por debajo de la mínima.

## Verificación y prueba manual

Las pruebas automáticas usan modelos, almacenamiento, transporte y Firebase
simulados. No conectan con Atlas ni provisionan índices. Los pipelines se
inspeccionan y se prueba su invocación: su ejecución real en MongoDB queda para
una base autorizada.

Desde backend:
```powershell
node node_modules/typescript/bin/tsc --noEmit --incremental false
node node_modules/eslint/bin/eslint.js src --no-cache
node --experimental-vm-modules node_modules/jest/bin/jest.js --runInBand --no-cache
```

Desde mobile:
```powershell
node node_modules/typescript/bin/tsc --noEmit --incremental false
node node_modules/eslint/bin/eslint.js src test --no-cache
node --test test/client.test.cjs test/version.test.cjs test/realtime.test.cjs test/analytics.test.cjs
```

Desde la raíz: git diff --check.

Prueba manual (implica escrituras reales SOLO si se ejecuta, en base autorizada):
1. Provisionar manualmente los índices en esa base. Mantener seed y auto-init
   apagados. Configurar ANALYTICS_READER_UIDS si se consultarán métricas.
2. Abrir una sola pestaña por cuenta. Ingresar con una cuenta Google ya vinculada.
   Perfil debe mostrar Compartir datos de uso apagado y no debe haber POST events.
   GET consent autenticado es necesario para comprobar la preferencia y no
   constituye un evento de tracking.
3. Activar el interruptor. Cerrar sesión y volver a ingresar para observar
   ingreso_exitoso con consentimiento previo. Crear/unirse/check-in/consultar
   ranking en un desafío de prueba; esperar hasta 30 segundos.
4. Ver en Network únicamente nombres, propiedades y acceptedIds, sin copiar,
   imprimir ni compartir Authorization. Nunca se envían título, código ni nota.
5. Bloquear SOLO /v2/analytics/events desde DevTools, dejando operativas las APIs
   de negocio. Consultar ranking, recargar, quitar el bloqueo y esperar el timer:
   los IDs conservados se reenvían. Si se bloquea toda la red, las operaciones de
   negocio tampoco pueden confirmarse y no deben producir eventos de éxito.
6. Desactivar Compartir datos de uso sin conexión. La cola se purga; al reconectar,
   se sincroniza enabled=false antes de intentar enviar eventos. Recargar no debe
   reactivar la preferencia anterior.
7. Cambiar a otra cuenta: nunca debe enviarse la cola con el UID/token de la
   cuenta anterior. No enviar un header x-usuario-id.
8. Probar una recomendación y una actualización obligatoria con la configuración
   del bloque 1: con sesión Firebase y consentimiento previo se registra un único
   aviso por tipo/versión/contexto mientras permanece visible. Sin sesión o sin
   consentimiento no se registra el aviso.
9. Consultar GET /v2/analytics/metrics?desde=YYYY-MM-DD&hasta=YYYY-MM-DD con un
   cliente Firebase autenticado de operador. Debe devolver solo las tres métricas.
   Con otro UID, 403. No se incorporó una pantalla de operador ni se copiaron
   tokens para verificarlo durante esta implementación.
10. Racha perdida: requiere una observación positiva previa en Inicio y otra con
    cero en un día posterior según la zona del perfil. El caso está probado con
    datos simulados; no se alteran fechas ni documentos reales para forzarlo.

## Pendientes de entrega

- Provisionar los índices y comprobar recepción, agregaciones y expiración en una
  base autorizada; no se ejecutaron esas operaciones sobre Atlas.
- Regresión visual Web del interruptor/avisos y evidencia con dos cuentas.
- Coordinación robusta de cola entre pestañas y Google Login nativo.
- Consignas D/E (monitoreo, requestId, salud y postmortem) siguen fuera de este bloque.
- El TP no especifica roles de consulta, nombres exactos en español ni semántica
  de primer desafío: se documentan las decisiones de operadores y creación/unión.


## Resultado de las verificaciones ejecutadas

- Backend: TypeScript y ESLint correctos; 184 pruebas aprobadas en 25 suites.
- Mobile: TypeScript y ESLint correctos; 30 pruebas aprobadas.
- git diff --check sin errores de whitespace (Git informa conversión LF/CRLF).
- No se ejecutaron seeds, E2E, creación de índices ni operaciones sobre Atlas.
- No se ejecutó la regresión manual Web ni la expiración real del TTL.

AnalyticsProvider observa Firebase por separado y está por encima de VersionGate:
puede leer el consentimiento propio y registrar un aviso obligatorio sin montar
la sesión ni las rutas de negocio de Rachas. GET consent no crea una Persona.
Todos los envíos usan el cliente HTTP existente con Bearer y una comprobación
adicional del UID esperado antes/después de obtener el token del SDK.

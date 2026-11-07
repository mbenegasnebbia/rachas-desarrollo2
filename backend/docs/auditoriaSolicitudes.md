# Auditoria de integracion de solicitudes de acceso

Fecha: 2026-11-06. Rama: feat/join-requests.

## Resultado y alcance

Integracion verificada por pruebas automatizadas locales, con cinco problemas
reproducibles corregidos. NO se declara validada de punta a punta con MongoDB:
no se conecto a Atlas ni se ejecutaron seeds, migraciones o escrituras reales.

No se agregaron funcionalidades, pantallas, dependencias o notificaciones.
No se modificaron puntos, rachas, ranking, consentimiento de Analytics ni credenciales.

## Hallazgos corregidos

1. El formulario priorizaba un PENDING cacheado sobre una respuesta terminal recien
   confirmada. Si fallaba el refresco, una aprobacion podia seguir viendose pendiente.
   Ahora se respeta la irreversibilidad de los estados terminales.
2. El error de cancelar la ultima pendiente desaparecia cuando una aprobacion concurrente
   la eliminaba de la lista. Ahora el error permanece visible sin un encabezado vacio.
   Tambien se corrigio un escape literal en el mensaje de cancelacion.
3. Pull-to-refresh en Explorar solo consultaba el catalogo. Ahora invalida tambien la
   carga de solicitudes propias, sin polling y sin perder el estado del formulario.
4. useCarga conservaba la instantanea anterior al cambiar de identidad. Inicio tampoco
   distinguia cuentas con la misma zona horaria para su consulta. Ahora la carga puede
   etiquetarse por cuenta/consulta: oculta datos y errores ajenos antes del siguiente
   efecto, invalida respuestas tardias y renueva Inicio al cambiar el UID.
   El resumen utiliza expectedUid del cliente Firebase existente.
5. GET /desafios/:id/participantes devolvia documentos Persona y exponia email y
   configuracion de perfil que Mobile no utiliza. Ahora proyecta y devuelve solo
   id, nombre y alias, igual al contrato publico de personas. No cambia la participacion
   ni el ranking. El tipo Mobile fue ajustado a esa respuesta minima.

Cada problema se reprodujo mediante una prueba que fallo antes de la correccion.
Los cuatro problemas Mobile se verifican en auditoriaSolicitudes.test.cjs.
La regresion de participantes y la coordinacion de sesiones estan en solicitudesAcceso.spec.ts.

## Contratos y autorizacion revisados

Se contrastaron docs/solicitudesAcceso.md, DTO, controladores, servicios,
adaptadores v1/v2 y cliente Mobile.

- POST /solicitudes: solo codigo, 200 con solicitud directa nueva/existente.
- GET /solicitudes: pagina de solicitudes propias, todos los estados.
- PATCH /solicitudes/:id/cancelar: solicitud directa CANCELLED.
- GET /desafios/creados: pagina de Desafio filtrada por creador.
- GET /desafios/:id/solicitudes: pagina PENDING, solo creador.
- PATCH aprobar/rechazar: solicitud directa, sin el wrapper interno del servicio.
- Listas: items, total, pagina, limite, paginas; pagina >=1, limite 1..50.
- Mobile conserva /v2, Firebase Bearer, x-app-version y x-platform mediante su cliente.
- Ruta antigua unirse: 410 en v1, v2 y alias legado. No hay consumidores activos Mobile.
- 409 no equivale exclusivamente a participante existente: Mobile solo ofrece acceso
  si lo confirma el endpoint propio de participaciones.
- 401/403/404/409/410/426/503 conservan el tratamiento existente; no se transforman en exito.
- Perfil incompleto y falta de autenticacion siguen bloqueados por el guard global.
- Identidad deriva del token; no se acepta solicitante/creador de un body o query.
- Estados terminales no se reabren. Repetir una resolucion no agrega participantes
  ni vuelve a emitir participante:unido.

## Consistencia de persistencia revisada

- Indice unico completo (desafio, solicitante), no sparse ni parcial: cubre estados
  terminales y evita nuevas solicitudes para el mismo par.
- El POST verifica ese indice y falla con 503 si falta o no puede consultarse.
- Aprobacion y resolucion comparten transaccion con snapshot/majority/primary.
- Escritura real de Persona.participacionVersion antes de contar participaciones.
  Crear usa la misma coordinacion; una prueba verifica el orden y la sesion compartida.
- Capacidad y elegibilidad se vuelven a comprobar en el $addToSet de Desafio.
- Actualizacion compare-and-set de la solicitud desde PENDING.
- Pruebas de doble aprobacion, ultimo cupo, cinco participaciones, crear vs aprobar,
  rechazar/cancelar vs aprobar, abandono y reduccion de cupo concurrentes.
- Rollback simulado si falla resolver despues de agregar el participante.
- Publicacion Socket.IO posterior al commit. Sigue siendo best effort, sin outbox.

APPROVED registra una aprobacion historica: si despues el usuario abandona o el desafio
se cancela, no se reescribe esa historia ni se permite volver a ingresar.
La garantia atomica se aplica a la aprobacion y su incorporacion inicial.

## Evidencia automatizada

Backend:
- 27 suites, 224 pruebas.
- Incluye cliente Mobile REAL compilado desde api/version.ts, api/client.ts y
  api/solicitudes.ts contra HTTP Nest, DTO, interceptor y servicio REAL de solicitudes.
  Solo identidad y persistencia son simuladas; el fetch se adapta a Supertest local.
- Pruebas HTTP adicionales usan el guard Firebase real con su verificacion simulada.
- Casos enlazados: solicitar/listar/aprobar, idempotencia, rechazar/cancelar, privacidad
  por actor, 400/401/403/404/409/410/503 y rollback con error propagado a Mobile.
- Las suites existentes cubren versionado/426, Firebase, check-ins, ranking y Analytics.

Mobile:
- 106 pruebas.
- Nuevas regresiones: prioridad de estados terminales, error al cancelar,
  refresco manual de solicitudes, aislamiento por cuenta, respuesta tardia,
  error residual y cambio de UID con la misma zona horaria.
- Se conservan las pruebas del formulario Crear, pills, borrador, administracion,
  bloqueo de doble envio, foco en Inicio/Explorar y responsive 320/440.

TypeScript y ESLint de ambos proyectos, builds Backend/Web y git diff --check
forman parte del cierre de la auditoria. Ver el resumen final de ejecucion.

Estas pruebas NO usan un servidor MongoDB y NO prueban comportamiento del driver
frente a una eleccion primaria, ni la configuracion del cluster de Atlas.

## Estado de MongoDB local inspeccionado

Se leyo unicamente la configuracion local necesaria, sin imprimir URI, hosts,
usuarios, passwords o tokens:
- MONGODB_URI configurada con esquema mongodb+srv.
- Inicializacion automatica no habilitada en la configuracion local revisada.
- No se encontro backend/.env.test ni se proporciono un entorno aislado autorizado.
- No se realizo DNS, conexion al cluster ni consulta de indices.

La URI SRV no confirma topologia, version efectiva, permisos, existencia de indices
o compatibilidad transaccional del cluster concreto. Tampoco la ausencia de un
parametro replicaSet en una URI SRV demuestra incompatibilidad: el despliegue se descubre.

MongoDB soporta transacciones multidocumento en despliegues compatibles; un standalone
no las soporta. Atlas documenta clusters replica set, pero eso NO confirma el cluster
de este proyecto. Fuentes oficiales:
- https://www.mongodb.com/docs/manual/core/transactions-production-consideration/
- https://www.mongodb.com/docs/atlas/manage-clusters/

**Compatibilidad real de Atlas: pendiente de validacion autorizada.**

## Plan de validacion real, SOLO entorno aislado autorizado

No ejecutar estas instrucciones contra la base habitual de desarrollo/produccion.
No usar seeds ni volcar datos personales reales. Conservar los cambios actuales.
Registrar URI/credenciales fuera de logs; usar variables temporales de terminal,
sin modificar archivos .env reales.

### 1. Precondiciones y topologia

El operador debe proporcionar una instancia/local replica set o cluster de prueba
autorizado y una base nueva cuyo nombre comience con rachas_join_requests_audit_.
Antes de cualquier escritura, comprobar host/cluster permitido y nombre de base.

En mongosh conectado UNICAMENTE a esa instancia, aplicar primero:

    if (!/^rachas_join_requests_audit_/.test(db.getName()))
      throw new Error("Base no autorizada para la auditoria");

Comprobar mediante hello y la informacion del operador que se trata de replica set
o mongos compatible. Registrar version, read/write permissions y acceso a listIndexes.
No copiar el resultado completo de hello a documentos publicos: incluye hosts.
Fallar cerrado si no se puede confirmar el aislamiento.

### 2. Coleccion e indices

En esa base nueva, provisionar la coleccion solicitudesAcceso y los indices de
docs/solicitudesAcceso.md. Confirmar con getIndexes que el indice por desafio/solicitante
es unico, completo, no sparse y sin partialFilterExpression.
Confirmar tambien indices de consulta y que los modelos comparten la misma conexion.

Comprobar que POST devuelve 503 si se omite el indice requerido, sin crear una solicitud.
Provisionarlo correctamente y repetir. No retirar indices de un entorno con trafico real.

### 3. Flujo real de dos cuentas

Arrancar el backend apuntando explicitamente a esa base, con identidades Firebase de
prueba autorizadas y versiones admitidas. Cargar datos de prueba mediante los endpoints,
no mediante seeds. Como creador C, crear un desafio programado/activo con cupo suficiente.

Como A:
- POST codigo -> PENDING con las claves documentadas.
- Repetir -> mismo ID, una sola fila en Mongo.
- GET propias -> solo A.
- Antes de aprobar, check-in -> 403 y ranking sin A.

Como C:
- GET creados y pendientes -> desafio y solicitud correctos.
- PATCH aprobar -> APPROVED.
- Leer Mongo desde primary: solicitud APPROVED y A presente una sola vez.
- Repetir PATCH -> mismo estado, sin segundo participante/evento de incorporacion.

Como A:
- Reenfocar/refrescar Inicio -> desafio visible.
- Reenfocar y refrescar Explorar -> ya no pendiente.
- Abrir Detalle -> check-in disponible segun las reglas de fecha existentes.

Verificar en cuentas adicionales rechazo, cancelacion, consulta ajena, exparticipante,
desafio completo/finalizado/cancelado, limite cinco y reenvio de estados terminales.

### 4. Rollback real

Solo en un proceso de prueba, sobre los modelos REALES de la base aislada:
crear una solicitud PENDING y provocar un error antes de actualizar su resolucion,
despues de la escritura de participante dentro de la misma transaccion.
Puede interceptarse findOneAndUpdate del modelo SolicitudAcceso en un test de
integracion temporal; restaurarlo siempre con finally.
No agregar endpoints de fallo ni flags de depuracion a produccion.

Invocar el servicio real, esperar 503 y consultar Mongo en primary:
solicitud sigue PENDING y A no fue agregado. Retirar la inyeccion y aprobar con exito.
Guardar evidencia de ambas lecturas y del rollback, sin datos sensibles.

### 5. Concurrencia real

Con requests HTTP paralelos:
- Misma solicitud: dos aprobaciones -> estado terminal unico, participante una vez.
- Dos solicitudes para el ultimo cupo: exactamente una incorporada; la otra no aprobada.
- Mismo solicitante con cuatro participaciones: aprobar dos desafios diferentes y
  enfrentar crear vs aprobar -> nunca mas de cinco vigentes.
- Aprobar vs rechazar/cancelar: una transicion terminal; membresia coincide con el ganador.
- Aprobar vs abandono/reduccion de cupo/cancelacion de desafio: sin listas sobrescritas
  ni capacidad excedida. Revisar tambien respuestas 409/503 y reintentos.

Registrar los resultados de HTTP y las lecturas de Mongo reales. Los dobles actuales
no acreditan estos pasos.

### 6. UI y dispositivos

En Web 320/375/440 y escritorio; despues iOS/Android fisicos:
formulario Crear y borrador, Mis creados, paginacion y contadores, loaders, doble toque,
errores de red/capacidad/autorizacion, pendientes y estados terminales.
Cambiar A -> B mientras hay consultas en vuelo y comprobar ausencia de datos residuales.
Teclado y texto ampliado requieren revision en dispositivos reales.

## Limites que permanecen

- No validado MongoDB/Atlas real, indices efectivos, rollback real, failover o contencion real.
- No validado Google real, Socket.IO real o dispositivos fisicos en esta auditoria.
- Listados por offset no son snapshots: cambios concurrentes pueden desplazar filas.
- Propias recorre todas las paginas; contadores requieren una consulta por desafio.
- Socket.IO conserva la entrega best effort, sin outbox.
- No hay errores pendientes en los casos automatizados corregidos; esto no sustituye
  la validacion real anterior.

## Archivos de esta auditoria

Backend: desafios.service.ts (proyeccion publica), solicitudesAcceso.spec.ts
(regresiones y pruebas enlazadas), docs/solicitudesAcceso.md y este informe.

Mobile: hooks/useCarga.ts; api/personas.ts y api/desafios.ts; types/index.ts;
app/(tabs)/index.tsx y explorar.tsx; app/desafio/[id].tsx;
components/desafios/accesoDesafios.tsx, solicitarAccesoFormulario.tsx,
solicitudesPendientes.tsx, solicitudesRecibidas.tsx, misCreados.tsx;
test/auditoriaSolicitudes.test.cjs, helpers/ui.cjs, mergeIntegracion.test.cjs;
docs/solicitudesAcceso.md.

## Registro de cierre automatizado

- Backend: 27 suites / 224 pruebas pasan. Tras ajustar el ejecutor VM del test
  enlazado para cumplir ESLint, su suite de 32 pruebas volvio a pasar.
- Mobile: 106 pruebas pasan.
- TypeScript de Backend y Mobile: pasa.
- ESLint de Backend y Mobile, incluidas las pruebas: pasa sin errores/advertencias.
- Build Nest y export Web de Expo: pasan.
- git diff --check: pasa.
- Vistas offline de componentes reales a 320 y 440 px regeneradas, sin red ni cuentas reales.

Pendientes de esta lista no automatizados: topologia/indices/transacciones del
cluster concreto, flujo real de dos cuentas y dispositivos fisicos.

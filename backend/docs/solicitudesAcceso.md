# Solicitudes de acceso a desafios

## Contrato para Mobile

Todos los endpoints requieren Authorization: Bearer <Firebase ID token>, Persona con
perfil completo y x-app-version compatible (por ejemplo 1.1.0). Se usa exclusivamente
la identidad del guard. No se acepta solicitante/creador enviado por el cliente.
La politica minima, errores 426 y deprecacion/Sunset de v1 no cambia.

Las rutas siguientes se exponen con /v1 y /v2; sin prefijo siguen siendo el alias
legado ya existente. Preferir /v2 en Mobile nuevo.

| Metodo | Ruta sin prefijo de version | Body | Acceso | Response |
|---|---|---|---|---|
| POST | /solicitudes | {"codigo":"ABC123"} | Solicitante | 200 solicitud nueva o existente |
| GET | /solicitudes | Ninguno | Solo propias | 200 pagina |
| PATCH | /solicitudes/:solicitudId/cancelar | Ninguno | Solo solicitante | 200 solicitud CANCELLED |
| GET | /desafios/creados | Ninguno | Solo propios del creador autenticado | 200 pagina de desafios |
| GET | /desafios/:desafioId/solicitudes | Ninguno | Solo creador correspondiente | 200 pagina de PENDING |
| PATCH | /desafios/:desafioId/solicitudes/:solicitudId/aprobar | Ninguno | Solo creador correspondiente | 200 solicitud APPROVED |
| PATCH | /desafios/:desafioId/solicitudes/:solicitudId/rechazar | Ninguno | Solo creador correspondiente | 200 solicitud REJECTED |
| POST | /desafios/unirse/:codigo | Ninguno | Autenticado | **410**, ingreso inmediato retirado |

Listas: ?pagina=1&limite=10, pagina >=1 y limite entre 1 y 50. No aceptan filtros
para seleccionar otro solicitante. Propias incluye todos los estados; pendientes solo
PENDING. Orden descendente estable por _id. Las paginas no son un snapshot: los cambios
concurrentes pueden desplazar filas.

### Solicitar acceso

POST /v2/solicitudes, Content-Type: application/json:

    {"codigo":"ABC123"}

Codigo de seis letras/numeros sin espacios; admite minusculas y busca en mayusculas.
El body no admite campos adicionales. Response 200 (misma forma al resolver):

    {
      "id": "507f1f77bcf86cd799439012",
      "desafio": {
        "id": "507f1f77bcf86cd799439011",
        "nombre": "Caminar",
        "categoria": "SALUD"
      },
      "solicitante": {
        "id": "507f1f77bcf86cd799439013",
        "nombre": "Ana",
        "alias": "ana"
      },
      "estado": "PENDING",
      "solicitadaEn": "2026-11-06T12:00:00.000Z",
      "resueltaEn": null,
      "resueltaPor": null
    }

Aprobar devuelve APPROVED con resueltaEn ISO UTC y resueltaPor igual al ID del creador.
Rechazar usa REJECTED. Cancelar usa CANCELLED y registra al solicitante como resolutor.

No se devuelven email, Firebase UID, consentimiento de Analytics, descripcion privada,
codigo, lista de participantes ni notas. Si se borran entidades fuera de la aplicacion,
las listas conservan sus IDs y devuelven nombre/alias/categoria null; no existe un
endpoint de borrado en este flujo.

### Listas

GET /v2/solicitudes y GET pendientes usan este sobre:

    {
      "items": [{
        "id": "507f1f77bcf86cd799439012",
        "desafio": {"id":"507f1f77bcf86cd799439011","nombre":"Caminar","categoria":"SALUD"},
        "solicitante": {"id":"507f1f77bcf86cd799439013","nombre":"Ana","alias":"ana"},
        "estado":"PENDING",
        "solicitadaEn":"2026-11-06T12:00:00.000Z",
        "resueltaEn":null,
        "resueltaPor":null
      }],
      "total": 1,
      "pagina": 1,
      "limite": 10,
      "paginas": 1
    }

GET /v2/desafios/creados usa el mismo sobre, con el contrato completo de Desafio ya
existente en items, filtrado por creador. En v2 fechaFin se llama finalizaEn y se agrega
el estado calculado; v1 conserva fechaFin. El creador recibe codigo y participantes
de sus propios desafios. Los endpoints preexistentes de catalogo/detalle mantienen
sus contratos/permisos: este cambio no introduce desafios privados ni modifica su
visibilidad historica.

### Errores

| HTTP | Motivo |
|---|---|
| 400 | Codigo/ID mal formado, paginacion invalida o campos no permitidos |
| 401 | Token Firebase ausente/invalido o identidad no disponible |
| 403 | Perfil incompleto o resolver sin ser el creador |
| 404 | Codigo inexistente, desafio propio no encontrado o solicitud fuera del alcance autorizado |
| 409 | Primera solicitud de creador/participante/exparticipante; desafio cerrado/completo; limite de cinco al aprobar; transicion incompatible |
| 410 | Ruta antigua de ingreso inmediato retirada |
| 426 | Version inferior a la minima configurada |
| 503 | Indice unico ausente/inaccesible, transacciones no disponibles o escritura no confirmada |

Sobre de errores habitual Nest: statusCode, message, error.
Usar codigo HTTP y estado; no depender de la frase exacta.

## Estados e idempotencia

- Solo PENDING -> APPROVED, REJECTED o CANCELLED.
- Repetir la misma resolucion autorizada: 200, sin incorporacion/evento duplicados.
- Intentar una resolucion diferente tras resolver: 409.
- Repetir codigo devuelve el registro existente, incluso tras cierre/aprobacion.
  No altera fechas ni vuelve a PENDING.
- Rechazo y cancelacion son definitivos para ese par persona/desafio en esta version.
  Nuevos intentos requieren una politica futura explicita.
- Solicitar no reserva cupos. Se rechaza una nueva solicitud si ya esta completo.
  Al aprobar se revalidan cupo, fechas, cancelacion, participacion previa y limite de cinco.
- PENDING no agrega participantes y no habilita check-ins, puntos, ranking ni salas.
- Cancelar un desafio no resuelve automaticamente solicitudes pendientes. Todavia
  pueden rechazarse/cancelarse, pero no aprobarse.
- Calendario, duracion, reglas de participacion, check-ins y desempates conservan
  sus criterios existentes.

## Indices y provisionado

Coleccion nueva: solicitudesAcceso. Referencia de provisionado para un operador
(NO ejecutado por esta tarea):

    db.createCollection("solicitudesAcceso");
    db.solicitudesAcceso.createIndex(
      {desafio: 1, solicitante: 1},
      {unique: true, name: "solicitud_desafio_persona_unique"}
    );
    db.solicitudesAcceso.createIndex({desafio: 1, estado: 1, _id: -1});
    db.solicitudesAcceso.createIndex({solicitante: 1, _id: -1});

La unicidad cubre todos los estados y respalda tanto la concurrencia como la prohibicion
de reenvios tras rechazo/cancelacion. Antes de crear, se verifica un indice unico completo,
sin sparse ni partialFilterExpression. Sin ese indice responde 503. La consulta de
metadatos por request tiene un costo deliberado para no cachear una garantia retirada.

Tambien se declaran indices de Desafio por creador (creador, _id) y para contar
participaciones vigentes (participantes, cancelado, fechaFin).

Se respeta MONGODB_AUTO_INIT_ENABLED: no se habilita autoIndex/autoCreate por este cambio.
Provisionar coleccion e indices mediante el procedimiento habitual del entorno.
No se ejecutaron esos comandos, seeds ni conexiones Atlas. Los campos internos nuevos
parten de cero con $inc; no necesitan poblarse en documentos anteriores.
No retirar los indices durante trafico.

## Concurrencia, consistencia y costo

Requiere MongoDB con transacciones (replica set/cluster compatible), primary,
readConcern snapshot y writeConcern majority. No hay fallback parcial.

Aprobar escribe participante y estado en la misma transaccion: ambos o ninguno.
Antes de contar participaciones, se escribe Persona.participacionVersion (interno y no
serializado). Crear desafios usa la misma coordinacion: aprobaciones a distintos desafios
y creaciones concurrentes del mismo usuario no pueden superar cinco vigentes.

El cupo se revalida en la escritura $addToSet de Desafio junto con cancelacion, fecha,
participacion y exparticipacion. Solicitar tambien escribe el desafio mediante
solicitudesVersion (interno) para coordinar con sus cambios. Resolver usa compare-and-set
PENDING. Mongoose reintenta el callback completo ante conflictos transitorios; no se
emiten sockets dentro de ese callback. Abandonar usa $pull/$addToSet para no sobrescribir
altas recientes; cambiar configuracion verifica de nuevo la capacidad al escribir.

Se serializan altas del mismo usuario y escrituras del mismo desafio entre instancias
Node. Hay mas escrituras, viajes a Mongo y posibles reintentos/503 bajo contencion.
No es un mutex en memoria. Ante commit incierto, repetir permite reconciliar mediante
la solicitud unica y los estados idempotentes.

participante:unido se publica solo tras confirmar una primera aprobacion y con el ID del
solicitante. El bus existente conserva entrega Socket.IO best effort: no hay outbox ni
entrega exactamente una vez si el proceso cae tras el commit. Consultar GET recupera
el estado persistido.

## Compatibilidad y despliegue

Ingreso inmediato retirado en TODAS las versiones/alias. La ruta vieja devuelve 410,
no una respuesta 200 que Mobile viejo pueda confundir con un Desafio incorporado.
No hay ruta alternativa que incorpore mediante codigo. Esto tambien evita que el cliente
antiguo registre un exito de incorporacion en Analytics al recibir solo PENDING.

Mobile no se modifico: ingreso por codigo mostrara error hasta que consuma POST
/solicitudes y las consultas/aprobaciones. Coordinar el despliegue con esa siguiente
etapa y la politica habitual de versiones; no se inventa una version minima nueva aqui.
Firebase y Analytics siguen intactos. No hay notificaciones ni cambios de puntos/rachas.

## Verificacion aislada

Las pruebas de servicio usan dobles de modelos con snapshots, conflictos y rollback.
Las pruebas HTTP usan Nest/Supertest, guards reales con identidad Firebase simulada
y servicios locales. No abren Mongo ni Atlas.

Los dobles prueban estados, permisos, sesiones/escrituras, carreras y rollback.
No reemplazan una validacion de indices, write conflicts y failover en un replica set
aislado antes del despliegue.

Desde backend:

    npx tsc --noEmit --incremental false
    npx eslint "src/**/*.ts" "test/**/*.ts"
    npm test -- --runInBand
    npm run build
    git diff --check

Manual minimo en entorno aislado: provisionar indices; solicitar como A; comprobar
que A no participa/no puede hacer check-in; consultar y aprobar como creador; comprobar
inclusion una sola vez y repetir PATCH; rechazar/cancelar otras solicitudes; comprobar
403/404 con B; aprobar concurrentemente para el ultimo cupo.


## Auditoria de integracion

GET /desafios/:id/participantes devuelve exclusivamente id, nombre y alias; no expone
email ni ajustes de perfil. La lista de solicitudes conserva su contrato minimo.
Resultados, correcciones y plan de validacion real: [auditoriaSolicitudes.md](auditoriaSolicitudes.md).
La compatibilidad real de Atlas y sus indices efectivos siguen pendientes; no se ejecutaron operaciones remotas.

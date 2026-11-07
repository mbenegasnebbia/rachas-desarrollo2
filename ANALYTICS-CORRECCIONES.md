# Analytics: correcciones de Parte IV

## Cliente

Cada operacion conserva UID y generacion de consentimiento. Antes de mutar estado, abrir/limpiar colas o borrar la marca de revocacion luego de una espera, se verifica ese contexto. Un 403 antiguo no apaga una autorizacion nueva del mismo UID.

La revocacion apaga y limpia la cola inmediatamente. Intenta guardar una marca durable y, aunque falle, intenta el PATCH. Mantiene ademas una marca en memoria por UID para reintentos en foreground, online o timer. Solo limpia las marcas tras confirmar el PATCH y su limpieza local. Si falla la limpieza, conserva el estado de error y reintenta de forma idempotente. Si almacenamiento y red fallan juntos, cerrar el proceso pierde el intento en memoria: no se puede garantizar durabilidad sin almacenamiento disponible. La interfaz no afirma sincronizacion exitosa en ese caso.

Un 400 divide el lote secuencialmente hasta aislar eventos individuales. Solo el evento que recibe 400 individual es retirado como rechazo definitivo; los hermanos validos se envian. Otros errores conservan pendientes e IDs para reintentos idempotentes. Hasta 49 solicitudes para un lote de 25 completamente rechazado. Rechazos globales 400 persistentes se consideran definitivos al llegar a cada evento individual.

## Concurrencia Web y nativa

Web Locks mantiene una unica instancia propietaria por origen durante toda la vida del documento, incluyendo cambios de cuenta. Solo la propietaria puede abrir, persistir, vaciar o eliminar la cola compartida y cambiar consentimiento desde esta interfaz. Las otras pesta?as deshabilitan Analytics y muestran un error; no capturan eventos ni alteran pendientes. Para tomar propiedad, cerrar la propietaria y recargar la otra pesta?a. Sin Web Locks se falla cerrado. Requiere contexto seguro (HTTPS o localhost). Un documento congelado puede retener el bloqueo; no se fuerza su robo. No coordina versiones antiguas de la app que no utilicen este protocolo.

En nativo el singleton y la cola serializan un unico runtime JS. AsyncStorage no ofrece transacciones ni CAS entre procesos/runtimes: multiples runtimes nativos compartiendo almacenamiento no estan soportados. No se afirma seguridad entre procesos nativos.

## Garantia del backend

Cada lote usa una transaccion con writeConcern majority. Un findOneAndUpdate condicionado a compartirDatosUso=true incrementa analyticsWriteVersion en la Persona dentro de la misma sesion que bulkWrite. El incremento produce una escritura real y coordina con el PATCH sobre ese documento. El PATCH usa writeConcern majority. Si gana el lote, su commit precede a la revocacion; si gana el PATCH, el lote no obtiene permiso (o su transaccion entra en conflicto y se reintenta). Tras completar PATCH false no se confirman nuevos eventos hasta un posterior consentimiento true. No elimina eventos historicos ni garantiza orden entre solicitudes HTTP simultaneas de otorgamiento y revocacion.

Costo: una escritura de Persona por lote, transaccion multidocumento, contencion por Persona y posibles reintentos del driver. Requiere replica set o cluster compatible con transacciones, colecciones e indices previamente provisionados y ambos modelos en la misma conexion. Sin soporte transaccional el envio falla cerrado; no hay fallback a comprobacion previa. analyticsWriteVersion es interno, no una propiedad editable del perfil ni parte del JSON publico.

Las pruebas usan dobles aislados que modelan el bloqueo y verifican la sesion compartida, el orden y el rechazo posterior. No son una prueba de integracion del motor MongoDB ni se accede a Atlas. Referencias: https://mongoosejs.com/docs/transactions.html y https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API

## Validacion manual minima

1. En entorno aislado, activar Analytics; offline, generar eventos, volver online y comprobar envio con los mismos IDs.
2. Forzar setItem fallido y red caida, revocar: estado apagado y error. Recuperar red sin reiniciar: comprobar PATCH false y desaparicion del error.
3. Demorar lectura de optout de A y cambiar a B: completar la lectura; B debe conservar estado y pendientes.
4. Demorar un POST y devolver 403 despues de renovar consentimiento para el mismo UID: debe permanecer activado.
5. Abrir dos pesta?as del mismo origen: segunda apagada; generar pendientes offline en primera y verificar que la segunda no los modifica. Cerrar primera y recargar segunda para recuperar propiedad.
6. Rechazar uno de varios eventos con 400: comprobar aislamiento, entrega de hermanos y ausencia de reenvio del rechazado.
7. Solo en replica set de pruebas aislado, demorar un lote dentro de transaccion, revocar y verificar que PATCH espera al commit; luego todos los envios reciben 403. Nunca usar Atlas de produccion para esta prueba.

# Mobile: solicitudes de acceso

Implementado sobre feat/join-requests, la rama actual confirmada para la etapa anterior.
No se modifico el backend ni se agregaron dependencias. Se conserva Neon Club, fuentes
y tokens compartidos.

## Archivos y responsabilidades

- api/solicitudes.ts: contratos reales tipados y paginacion de solicitudes propias.
- types/index.ts: SolicitudAcceso y EstadoSolicitud, con nombres exactos del backend.
- components/desafios/solicitarAccesoFormulario.tsx: codigo, envio explicito, estados,
  duplicados y acceso cuando la solicitud fue aprobada o ya existe participacion.
  Reemplaza unirseFormulario.tsx.
- components/desafios/accesoDesafios.tsx: consulta propia compartida al enfocar Explorar;
  mantiene el resultado del formulario sincronizado con pendientes y cancelaciones.
- components/desafios/solicitudesPendientes.tsx: solo pendientes, cancelacion y paginacion local.
- components/desafios/misCreados.tsx: pagina de desafios propios y sus contadores pendientes.
- components/desafios/solicitudesRecibidas.tsx: aprobar/rechazar dentro de Mis creados.
- components/desafios/estadoSolicitud.tsx: etiquetas de estados usando Badge.
- app/(tabs)/crear.tsx: agrega pills; conserva campos, callbacks, validaciones y estilos
  del formulario original. El borrador vive en la pantalla y no se pierde al cambiar pill.
- app/(tabs)/explorar.tsx: integra solicitud por codigo y seccion propia compacta.
- app/desafio/[id].tsx: reemplaza la entrada antigua por solicitud; no agrega administracion.
- api/desafios.ts: elimina el ingreso inmediato retirado.
- componentes y pruebas relacionados actualizan textos y contratos.

Se reutilizan Tarjeta, Texto, Boton, Badge, Encabezado, Campo, IconoCircular, Opciones,
EstadoCarga, Paginador, Pantalla, useAccion y useCarga. No hay un sistema visual paralelo.

## API utilizada

El cliente existente agrega /v2, Firebase Bearer y headers de version.
Las solicitudes de esta funcionalidad capturan expectedUid para impedir que una
operacion iniciada con una cuenta se envie con el token de otra.

- POST /solicitudes, body: {"codigo":"ABC123"}.
- GET /solicitudes?pagina=N&limite=50 (todos los estados, solo propias).
- PATCH /solicitudes/:id/cancelar, sin body.
- GET /desafios/creados?pagina=N&limite=10.
- GET /desafios/:id/solicitudes?pagina=N&limite=10.
- GET /desafios/:id/solicitudes?pagina=1&limite=1 para consultar total del contador.
- PATCH /desafios/:id/solicitudes/:solicitudId/aprobar o /rechazar, sin body.
- GET /personas/:personaId/desafios, solo propia participacion, como recuperacion tras
  409 para quien ya participaba antes de existir las solicitudes.

No se utiliza la ruta retirada /desafios/unirse/:codigo.
No se envian solicitante/creador en el body. Los controles de creador se muestran solo
cuando coincide persona.id con desafio.creador; la autorizacion final sigue en backend.

## Estados, refresco y concurrencia

Enviar no navega ni agrega un desafio localmente a Inicio. PENDING muestra el mensaje
de aprobacion requerido y deshabilita un segundo envio del mismo codigo conocido.
El backend sigue siendo idempotente si se repite desde otra instancia/dispositivo.

APPROVED ofrece Ver desafio. REJECTED y CANCELLED muestran su resultado sin reenviar.
Las solicitudes rechazadas no se muestran como historial permanente en Explorar.
Una participacion previa se resuelve mediante el endpoint propio y permite abrir el desafio.

useAccion bloquea doble envio incluso antes de que React repinte; los botones muestran
busy y spinner. Una resolucion confirmada oculta la fila inmediatamente y refresca
listado y contadores. Errores se muestran inline; no se informa exito si falla la mutacion.
Si falla el refresco posterior a un exito, se conserva la confirmacion y se muestra el
error de carga correspondiente. Un contador que no se pudo consultar no se muestra como cero.

useCarga conserva el refresco al enfocar y pull-to-refresh ya existentes. Al aprobar,
Inicio incorpora el desafio solo cuando el resumen del backend lo devuelve. Explorar
actualiza pendientes al reenfocar. No hay polling, notificaciones ni bandeja global.
Los componentes de cuenta y administracion se identifican por claves de usuario/desafio
para no reutilizar estado entre cuentas.

Solicitar, cancelar o aprobar no emite desafio_unido: PENDING no es incorporacion y
una aprobacion ejecutada por el creador no debe atribuirsele como participacion propia.
No se modificaron runtime, consentimiento ni almacenamiento de Analytics. Se mantienen
la instrumentacion de crear desafios, ranking y check-ins y sus pruebas.

## Rendimiento y limites de los contratos actuales

El backend no filtra solicitudes propias por estado. Se recorren sus paginas (50 por
request), se deduplican por ID y la UI muestra solo PENDING, diez por pagina. No se
ocultan pendientes antiguas detras del historial resuelto. Si una pagina falla, se
informa error en lugar de presentar un resultado parcial como completo.
El costo de lectura crece con el historial propio; un filtro de estado en backend
seria una mejora futura, no una ruta inventada en este cambio.

Mis creados muestra diez desafios por pagina. Se consulta el total pendiente una vez
por desafio visible; no se cargan sus listas completas para construir el badge.
Al administrar, se consultan diez solicitudes por pagina. Las listas son acotadas y
no introducen ScrollViews verticales anidados.

Las paginas del servidor no son un snapshot; altas concurrentes pueden desplazar filas.
Refrescar reconcilia los datos. No hay garantias de notificacion instantanea.

Antes de probar con backend real, siguen siendo necesarios la coleccion, indices y
replica set documentados por la etapa backend. No se provisionaron ni se uso Atlas aqui.

## Pruebas y revision visual

Tests con APIs/sesion simuladas: contratos/rutas/body/UID, todos los estados, duplicados,
cancelacion, permisos, aprobacion/rechazo, errores, refresco al enfocar y borrador de Crear.
Tambien se usan los hooks reales de accion/carga con dobles de React para comprobar
bloqueo durante solicitudes en vuelo y refresco al regresar a Inicio/Explorar.

Se comparo el AST de las tres secciones y boton/callback de Crear antes/despues:
solo cambia su envoltorio por la pill. Campos, props, validaciones y payload permanecen.

Previews offline de componentes reales a 320 y 440 px en dist/solicitudes320.png y
dist/solicitudes440.png. No sustituyen teclado fisico, autenticacion real ni dispositivos.
No se ejecutaron E2E contra Atlas.

Desde mobile:

    npm run typecheck
    npm run lint
    node --test test/*.test.cjs
    npx expo export --platform web
    git diff --check
    npm run web

## Validacion manual minima (entorno aislado)

1. Como solicitante, enviar codigo en Explorar: ver Pendiente, sin acceso a check-in.
   Repetir el codigo: no duplicar. Cancelar otra solicitud y verificar Cancelada.
2. Como creador, ir a Crear > Mis creados: ver participantes y contador; entrar a
   Administrar solicitudes. Aprobar una y rechazar otra. Ver spinner y confirmacion;
   volver y comprobar contadores.
3. Como solicitante aprobado, volver a Inicio y refrescar: debe aparecer el desafio.
   Abrir Detalle y comprobar las acciones existentes. Explorar ya no debe mostrarlo
   entre pendientes.
4. Reingresar un codigo rechazado/cancelado: mostrar estado, sin reenvio.
5. Probar errores de red, cupo completo y doble click. Como no creador, no mostrar
   administracion ajena.
6. Alternar Crear/Mis creados con borrador y verificar que Crear conserva el formulario.
   Revisar 320/375/440 px y escritorio, texto grande, scroll y teclado.


## Correcciones de auditoria

Las cargas de solicitudes y los resumenes se etiquetan por identidad/consulta para
ocultar instantaneas ajenas antes del siguiente efecto. Inicio distingue el UID y
usa expectedUid. Pull-to-refresh en Explorar refresca tambien solicitudes propias.
Las respuestas terminales confirmadas prevalecen sobre un PENDING cacheado y los
errores de cancelar se conservan aunque desaparezca la ultima pendiente.
Participantes consume el contrato publico id/nombre/alias.
Informe y pendientes reales: [auditoria Backend + Mobile](../../backend/docs/auditoriaSolicitudes.md).

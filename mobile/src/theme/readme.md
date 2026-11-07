# Sistema visual de Rachas

Neon Club claro es el tema activo. Todas las pantallas de producto, formularios y navegacion usan este sistema. Los roles oscuros estan preparados; no hay selector, persistencia ni deteccion del sistema.

## Donde editar

- **paletas.ts**: colores de marca y neutros por modo. fondo es blanco puro; superficieSuave es el gris de apoyo. Los iconos sobre fondos de marca solidos usan sobrePrimario (tinta negra compartida); los inactivos sin fondo usan textoSecundario.
- **tokens.ts**: espacios, radios, medidas, iconos, circulos, interaccion y tipografia.
- **index.ts**: combina los objetos. Cambiar crearTema("neonClub", "claro") por crearTema("lilacPop", "claro") para la alternativa. Los fondos suaves de marca se derivan aqui para que acompanen la paleta.
- **components/ui/boton.tsx**: variantes primario, secundario y peligro; foco, presionado, ocupado y deshabilitado. secundario se conserva como alias para pantallas existentes.
- **theme/estilos.ts**: contenedor responsive y estilos compartidos que mantienen compatible el codigo existente. Los valores salen de tokens; no agregar HEX aqui.
- **components/ui.tsx**: fachada de imports compatible. Los componentes visuales se implementan en ui/; TarjetaDesafio y EtiquetasDesafio mantienen sus componentes de dominio separados.

Para cambiar el radio de tarjetas, editar el literal radios.tarjeta en tokens.ts. Para el titulo, editar tipografia.pantallaTitulo dentro de crearTipografia. No mutar los tokens durante la ejecucion: editar las declaraciones y dejar que Expo recargue.

## Componentes

Ejemplos JSX:

    <IconoCircular icono="fuego" tono="acento" tamano="grande" variante="solido" />
    <IconoCircular icono="check" tono="primario" variante="suave" />
    <IconoCircular icono="trofeo" tono="secundario" />
    <Boton titulo="Guardar" onPress={guardar} cargando={guardando} />
    <Boton titulo="Cancelar desafio" variante="peligro" onPress={confirmar} />
    <Seccion titulo="Tus datos"><Campo etiqueta="Nombre" value={nombre} onChangeText={setNombre} /></Seccion>
    <SeccionExpandible titulo="Participantes" resumen="Ver personas">{contenido}</SeccionExpandible>

icono.tsx contiene un conjunto pequeno de trazos SVG propios, sin fuente de iconos ni otra libreria de diseno. Agregar un path de 24x24 ahi para sumar un icono. Se usa react-native-svg compatible con Expo; en builds nativos propios existentes debe recompilarse el binario si todavia no incluye ese modulo. Expo Go lo incluye.

Texto y Campo respetan el escalado de texto. Plus Jakarta Sans (400/600/700/800) se carga una vez en app/_layout.tsx. Se reutiliza el contexto de fuentes ya existente; si la carga falla, texto, campos y navegacion usan fuente del sistema sin bloquear la sesion.

Los componentes visuales no llaman APIs ni conocen Firebase/Socket.IO. Las acciones y validaciones siguen en sus pantallas o componentes funcionales existentes.

## Scroll, teclado y navegacion

Pantalla sirve para formularios y paginas cortas: SafeAreaView, KeyboardAvoidingView en iOS y ScrollView con taps conservados. Inicio usa FlatList. RankingDesplegable conserva una unica FlatList vertical con encabezado/pie; no envolverlo en Pantalla ni ScrollView. El contenido se limita a 760 px y deja espacio inferior.

La barra de tabs permanece en el flujo normal (sin position absolute), respeta los insets del navegador y se oculta con el teclado. Sus rutas se conservan. Se eliminaron titulos duplicados en tabs e ingreso; Detalle conserva el encabezado con volver.

El ranking no reordena ni calcula posiciones. Contraido muestra solo la posicion, alias y puntos propios, sin filas. Expandido muestra top 3 y ofrece el listado completo virtualizado. Los alientos mantienen sus emojis y callbacks: son contenido expresivo, no iconos de navegacion.

## Verificacion

Desde mobile:

    npm run typecheck
    npm run lint
    node --test test/*.test.cjs
    npx expo export --platform web
    git diff --check
    npm run web

Abrir la URL indicada por Expo e ingresar con una cuenta de prueba. Probar anchos de 320 px y escritorio, zoom/texto grande, filtros, formularios con teclado, calendario, estados de carga/vacio/error, botones deshabilitados y ranking expandido/contraido. Usar solamente datos aislados para probar acciones que escriben; navegar y revisar el diseno no requiere seeds ni Atlas.

Las pruebas de UI usan dobles locales para APIs, sesion y tiempo real. No prueban conectividad real, proveedor OAuth ni teclado fisico nativo. La validacion en iOS/Android real sigue siendo necesaria antes de publicar.

El componente de diagnostico GooglePrueba no esta conectado a las rutas de producto y queda fuera de esta migracion.

## Escala responsive (segunda pasada)

El unico breakpoint visual es breakpoints.compacto = 375 en tokens.ts. useTema.ts usa useWindowDimensions de React Native y delega en temaParaAncho (index.ts). No hay condiciones de ancho en las pantallas ni deteccion de modelos de telefono.

- Hasta 375 px: pantallaTitulo 25/32, desafioTitulo 20/27, seccionTitulo 18/25, tarjetaTitulo 17/24, cuerpo 14/21, cuerpoSecundario 13/19, etiqueta 12/17, boton 14/21, estadistica 26/33.
- Desde 376 px: pantallaTitulo 32/40, desafioTitulo 24/32, seccionTitulo 22/30, tarjetaTitulo 20/28, cuerpo 16/25, cuerpoSecundario 14/21, etiqueta 13/20, boton 16/24, estadistica 32/40.
- Los pares son fontSize/lineHeight. Cambiar ambos dentro de crearTipografia en tokens.ts. Los nombres anteriores titulo/seccion/numero son alias de estos roles, no otra escala.
- geometriaCompacta concentra margen 16, padding de tarjeta 16 y espacio de seccion 16. La escala amplia usa 24/20/20. Radios: tarjeta 24, control 16 y circulos completos.
- Los objetivos tactiles conservan un minimo de 44; botones compactos 48 y amplios 52. La escala de fuente del sistema no se limita. baseEstadistica crece con fontScale para que las metricas puedan envolver a otra fila.
- El ancho maximo del contenido permanece en 760 px para tablet/escritorio.
- useEstilos genera los estilos de compatibilidad con el mismo tema responsive. Usarlo dentro del componente; evitar importar los estilos estaticos en nuevas pantallas.

Ejemplo de componente:

    const tema = useTema(); // import desde theme/useTema
    <Texto variante="desafioTitulo">{desafio.nombre}</Texto>
    <View style={{ gap: tema.espacios.md }}>{contenido}</View>

El texto no debe duplicar fontSize ni condiciones de ancho en la pantalla.

## Navegacion, metricas y jerarquia

La barra no muestra nombres, pero conserva tabBarAccessibilityLabel por ruta. La seleccion vive exclusivamente en IconoCircular (acento solido); el item completo tiene fondo transparente. circulos.navegacion es 52 compacto/56 amplio. medidas.altoBarra es 76/80, mas insets.bottom; no usa posicion absoluta.

Inicio obtiene el saludo con utils/personas.ts: primerNombreVisible. No modifica Persona ni Firebase; Perfil conserva el nombre completo. El estado de check-in completado es informativo, no un boton. Las tres metricas usan ResumenMetricas, con un unico bloque gris compartido. El icono puntos es una estrella.

Detalle mantiene una unica FlatList del ranking, con resumen/check-in/progreso en el encabezado y alientos/participantes/invitacion/historial en el pie. Al completar HOY se muestra confirmacion, pero AYER sigue disponible con las mismas reglas y callbacks. Deshacer conserva su disponibilidad original. Participantes se expande dentro de la misma tarjeta; alientos no es expandible. No hay enlace de invitacion inventado: se conserva codigo y mensaje existentes.

## Matriz de revision

Probar 320 y 375 px (SE), 440 px (movil grande), 768 px (tablet) y 1440 px (escritorio). Comprobar cambio de ancho en caliente, nombres largos, fuente ampliada, campos y teclado, tab activa circular, scroll y top 3/ranking completo. Las vistas previas aisladas usan datos ficticios; no reemplazan una prueba fisica iOS/Android.

Los encabezados usan IconoCircular con tamano="grande" (48 compacto / 52 amplio). Inicio agrega espacios.sm de aire antes de Tus desafios. Los iconos de estadisticas conservan el tamano pequeno y comparten la misma tinta negra sobre sus fondos de marca.

## Resumen de metricas (Inicio)

ResumenMetricas recibe racha, puntos y puesto numericos, sin calcularlos ni consultar APIs. Presenta tres columnas iguales dentro de superficieSuave con radio control:

    <ResumenMetricas racha={rachaActual} puntos={puntos} puesto={posicion} />

circulos.metrica fija los circulos en 44 px para todos los anchos. metricaNumero define 26 px/peso 800 y metricaEtiqueta 12 px/semibold. El escalado de texto sigue habilitado.

IconoCircular acepta tinta="tono" para tinta oscura de marca; ResumenMetricas usa iconoSobreAcento, iconoSobrePrimario e iconoSobreSecundario. Los otros iconos conservan tinta="uniforme" (negra). Los roles se definen en paletas.ts y conservan Lilac Pop como alternativa. Estado de check-in y acciones quedan fuera del resumen.

## Jerarquia de Tus desafios

En Inicio, seccionDestacada usa 22/24 px (compacto/amplio), peso 800; desafioListado usa 17/18 px, peso 700. El subtitulo usa cuerpoSecundario (13/14 px). Los estilos estan en crearTipografia, tokens.ts.

medidas.separacionSeccionDestacada define 32/36 px antes del encabezado de listado, sumando el gap normal y el padding de encabezadoListado. medidas.espacioListado define 16/18 px entre el subtitulo y la primera tarjeta. El resto de encabezados mantiene sus roles actuales.

## Detalle: tarjetas y desplegables

Orden: resumen, check-in, Tu progreso, Ranking, Mandar un aliento, Participantes, Invitar personas, Historial de actividad. Las acciones destructivas conservan su confirmacion al final. El titulo redundante del stack no se muestra; el boton para volver se conserva.

- Tu progreso usa ResumenMetricas directamente, sin una tarjeta blanca adicional.
- RankingDesplegable mantiene la unica FlatList vertical de la pantalla. Su tarjeta lila se compone de encabezado, celdas virtualizadas y pie con gap cero entre esas partes; no envolverla en ScrollView o Tarjeta. Cerrada: data vacia y resumen propio. Abierta: top 3; Ver ranking completo conserva el orden de items del backend. Cerrar reinicia a top 3 para la proxima apertura.
- El endpoint de ranking y su respuesta se conservan. No se agrego paginacion de servidor ni una consulta al abrir: la virtualizacion y la seleccion top 3 se hacen con los datos ya disponibles.
- ControlDesplegable comparte titulo, chevron y estado accesible con SeccionExpandible, sin forzar el contenido. Participantes, invitaciones e historial estan cerrados por defecto.
- Invitacion conserva su codigo, copia de mensaje y compartir nativo. No se muestra un enlace porque no existe una URL de invitacion implementada.
- Alientos es una presentacion separada, siempre visible para quienes ya tenian acceso. Recibe estado y callbacks del mismo hook; no abre sockets ni calcula cooldown. Solo muestra estado de conexion si no esta Conectado. Conserva errores, espera y alientos recibidos.
- columnasReacciones (tokens.ts): 3 en compacto, 6 en amplio. Los botones de emoji blancos mantienen el minimo tactil de 44.

Colores en paletas.ts: fondoRanking (#F0E8FF), textoRanking (#2B1945), detalleRanking (#4D2788), fondoRankingPropio; fondoAlientos (#FFE0D0), textoAlientos (#54250F), detalleAlientos (#852400). Tambien hay equivalentes oscuros preparados.

Pruebas aisladas: ranking, alientos/guardas, clipboard local, historial paginado y deshacer. Los tests no establecen una conexion Socket.IO real ni llaman a Firebase/Atlas. Verificar manualmente con un entorno de prueba antes de publicar.

## Convenciones del frontend

- Archivos propios en camelCase: tarjetaDesafio.tsx, useTema.ts, realtimeTypes.ts.
  Los componentes y tipos conservan PascalCase; los hooks conservan el prefijo use.
  No renombrar rutas de Expo Router (_layout.tsx, [id].tsx), sufijos de plataforma
  (.web.tsx), extensiones de pruebas (.test.cjs), ni archivos exigidos por herramientas
  (package-lock.json, eslint.config.js, AGENTS.md, LICENSE, .env).
- components/ui/: piezas visuales genericas. fechaSelector pertenece aqui porque
  recibe valores y callbacks, sin conocer desafios. components/ui.tsx conserva
  helpers genericos y reexportaciones de compatibilidad; no exporta dominio.
- components/desafios/: alientos, etiquetasDesafio, invitacion, rankingDesplegable,
  resumenMetricas, tarjetaDesafio y unirseFormulario. ResumenMetricas es presentacional,
  pero su contrato RACHA/PUNTOS/PUESTO pertenece a este dominio.
- app/: rutas y pantallas; hooks/: logica reutilizable; theme/: paletas, tokens,
  estilos compartidos y useTema. Los hooks de tema permanecen junto a su tema.
- Imports: paquetes externos, alias internos @/, y relativos entre hermanos, con
  una linea en blanco entre grupos. Entre carpetas preferir @/. Exports nombrados
  para componentes, hooks y utilidades; default solamente donde Router o la
  configuracion lo exige. No crear nuevos barrels por carpeta.
- Usar Texto con su nombre original; evitar renombrarlo a Text en las pantallas.
  Props locales en componentes reutilizables; usar type para intersecciones con
  props nativas, interface para objetos. No mover tipos privados a types/index.ts.
- Colores, medidas visuales y espaciados salen de theme. Los estilos inline
  pequenos de composicion son validos; flex: 1, minWidth: 0 y porcentajes de layout
  no necesitan tokens. No cambiar valores solamente para eliminar literales.
- El diagnostico googlePrueba no esta conectado a las rutas de producto: conserva
  su texto nativo, estilos estaticos y color historico para no redisenarlo aqui.
  La logica de Firebase, APIs y sockets permanece intacta.
- Los assets propios tambien usan camelCase; sus referencias de app.json se
  actualizan sin cambiar los archivos binarios.

En Windows, Git puede ocultar renombres que solo cambian mayusculas con core.ignorecase=true. Revisarlos con git -c core.ignorecase=false status --short. Al preparar un commit mas adelante, usar tambien esa opcion en git add para registrar los nombres reales. Este refactor no modifica el indice ni la configuracion local de Git.

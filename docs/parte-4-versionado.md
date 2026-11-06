# Parte IV, bloque 1: contratos y actualización

Fuente: Rachas_TP_Integrador.pdf, páginas 10–13, Consignas A/B y anexo de
configuración. Se consultó el PDF original proporcionado por el usuario.
Se incluyen los cuatro cambios de contrato confirmados por el usuario.
Las instrucciones del PDF sobre tags, ruptura deliberada y publicación no se
ejecutaron: las restricciones de esta etapa tienen prioridad.

## Versiones y compatibilidad

Nest habilita versionado URI con enableVersioning. Los mismos controladores y
servicios atienden /v1, /v2 y las rutas históricas sin prefijo (alias de v1).
No cambian ObjectIds, referencias, fórmulas, orden de ranking ni documentos
históricos. No hay migración ni índices nuevos.

| Contrato | v1 y rutas históricas | v2 |
|---|---|---|
| Fin del desafío, entrada y salida | fechaFin | finalizaEn; fechaFin se rechaza |
| Puntos en check-ins, rachas, ranking y resúmenes | número | { total, bonusPorRacha } |
| Estados | estados existentes | incluye PAUSADO como vocabulario y admite estados futuros en la UI |
| POST check-in | zonaHoraria opcional | zonaHoraria IANA obligatoria, igual a la Persona autenticada |

La representación v2 se adapta en el límite HTTP; la persistencia mantiene fechaFin
y puntos numéricos para no migrar Atlas ni alterar servicios existentes.
El bonus se desglosa desde los puntos ya fijados: max(0, puntos-10) por check-in;
se suma para ranking/resumen. Los históricos sin puntos mantienen total/bonus 0.
No se recalculan ni reescriben puntos.

PAUSADO está reconocido en el contrato y filtros. **No existe operación de pausa
o reanudación ni documentos pausados producidos por la aplicación**: ese filtro
devuelve una página vacía. El PDF solo agrega el estado y no define transiciones,
permisos ni efecto sobre el calendario. Por la restricción de conservar las reglas
de desafíos no se inventan esas operaciones. Si la entrega exige producir desafíos
pausados reales, falta acordar e implementar esas reglas. Los estados desconocidos
se representan como DESCONOCIDO en Web, sin habilitar acciones de desafío activo.

Los documentos nuevos de check-in pueden guardar zonaHoraria; los históricos no
la requieren. Nunca reemplaza la zona del perfil para decidir hoy/ayer. El móvil
conserva sus tipos de pantalla mediante adaptadores del cliente; en la red usa v2.

## Endpoints y encabezados

Todas las rutas HTTP actuales tienen las tres variantes; no se duplican
controladores de negocio. Socket.IO conserva namespace /rachas y no se versiona.

- GET /version-policy es público, sin Firebase ni alta de perfil.
- GET /v1/version-policy y GET /v2/version-policy son alias públicos.
- Respuesta: minimumVersion, recommendedVersion, updateUrl, instructions.
- Por debajo de la mínima: 426 con esos mismos campos y mensaje de actualización.
- Excepciones al control de versión: raíz, política y /auth/* en las tres variantes.
  La excepción de versión NO vuelve públicas las rutas Auth: conservan Firebase.
- Header ausente se interpreta como 1.0.0 para los clientes históricos.
- Header explícito inválido devuelve 400. Solo releases estables major.minor.patch;
  no se distribuyen prereleases ni sufijos de build en esta aplicación.
- x-platform identifica la plataforma en cada pedido del cliente; no prueba identidad.
- Deprecation usa fecha estructurada @1793923200 (2026-11-06 UTC).
- Sunset usa fecha HTTP GMT configurable. Se exponen ambos mediante CORS.
- Se cuentan y registran pedidos v1/legacy, incluyendo respuestas 401/426, sin
  tokens, UID, IDs de documentos, cuerpo ni query. Discovery sin prefijo, raíz,
  OPTIONS y v2 no suman al contador v1.
- El contador es por proceso y se reinicia al arrancar. No es una métrica durable
  ni implementa el bloque de observabilidad.

Sunset anuncia una fecha; no desactiva automáticamente v1 al llegar ese día.
Los headers de versión no son un control de seguridad: Firebase sigue validándose.

## Configuración

Variables nuevas en backend/.env.example; **no se cambió ningún .env existente**:

| Variable | Valor por defecto |
|---|---|
| MIN_APP_VERSION | 1.0.0 |
| RECOMMENDED_APP_VERSION | 1.1.0 |
| V1_SUNSET_DATE | 2027-06-30T23:59:59Z |
| APP_UPDATE_URL | vacía: instrucciones + recarga Web |

La fecha de retiro predeterminada es **demostrativa**: confirmar el calendario
real antes de desplegar. APP_UPDATE_URL debe ser una URL pública http(s) sin
credenciales, que permita obtener la app publicada. Configurar el enlace real
antes de aumentar la mínima. La recomendada no puede ser menor que la mínima.
Una configuración inválida impide arrancar en lugar de aplicar una política ambigua.

EXPO_PUBLIC_API_URL continúa siendo el origen, por ejemplo http://localhost:3000,
**sin /v1 ni /v2**. Esto preserva también la URL de Socket.IO.
La app toma su versión de expo-constants/expoConfig (app.json), no de Expo Go.
app.json, package.json y las dos entradas raíz del lockfile se prepararon en 1.1.0;
no se instalaron dependencias.

Arranque de la API completa desde backend, con las credenciales y conexión ya
configuradas fuera del repositorio:

```powershell
$env:SEED_ENABLED = 'false'
$env:MONGODB_AUTO_INIT_ENABLED = 'false'
npm run start:dev
```

No se ejecutó este arranque durante la implementación. El login de una identidad
nueva continúa pudiendo crear una Persona; usar una cuenta ya vinculada para
validaciones manuales de lectura sin altas.

## Interfaz

Se consulta la política pública antes de montar la sesión y al volver al primer
plano. Si la política no puede consultarse, se muestran error y reintento.
Una versión obligatoria reemplaza las rutas por instrucciones, Actualizar y
Volver a comprobar. Un 426 recibido después también activa esta pantalla,
desmontando sesión/rutas/listeners de Detalle; Firebase no se borra.
No se reintenta una operación que recibió 426.
Una recomendación permite Más tarde; el descarte dura mientras siga montada la app
y vuelve a mostrarse si cambia la versión recomendada.

En Web, Actualizar abre APP_UPDATE_URL, o recarga si no está configurada.
En Android/iOS pide instalar el build o abre su enlace público; no se agregó
EAS Update, descarga automática ni Google Login nativo. No se generaron builds.
La experiencia visual y la integración real deben regresionarse manualmente.

## Pruebas locales sin Atlas

Desde backend:

```powershell
node node_modules/typescript/bin/tsc --noEmit --incremental false
node node_modules/eslint/bin/eslint.js src --no-cache
node --experimental-vm-modules node_modules/jest/bin/jest.js --runInBand --no-cache
```

Desde mobile:

```powershell
node node_modules/typescript/bin/tsc --noEmit --incremental false
node node_modules/eslint/bin/eslint.js src test/client.test.cjs test/version.test.cjs test/version-loader.cjs test/realtime.test.cjs --no-cache
node --test test/client.test.cjs test/version.test.cjs test/realtime.test.cjs
```

Desde la raíz: git diff --check.

Resultado local de esta etapa: TypeScript y ESLint sin errores ni advertencias en
backend y mobile; 155 pruebas backend en 24 suites y 15 pruebas mobile aprobadas.
La comprobación del diff no detectó errores de whitespace. No se probó una sesión
real de navegador ni se conectó con Atlas durante estas verificaciones.

La nueva prueba HTTP usa un módulo Nest con controladores y guard Firebase
simulados; no importa AppModule, MongooseModule ni SeedModule. Supertest opera
contra ese servidor local efímero. No usa Firebase real ni MongoDB.
Cubre compatibilidad v1/legacy, v2, validación DTO, 426 anterior al guard de perfil,
excepciones y 401, headers, conteo de uso y entradas sensibles no registradas.
Las pruebas del cliente simulan fetch, Firebase, Expo y Socket.IO.

## Validación manual mínima pendiente

1. Mantener el seed/auto-init desactivados. Levantar API completa y Expo Web.
2. Abrir /version-policy sin token: debe mostrar mínima/recomendada e instrucciones.
3. Ingresar con una cuenta Google **ya vinculada**. Comprobar Inicio, Explorar,
   Detalle y Perfil. En Network ver URL /v2, x-app-version=1.1.0 y x-platform=web.
   Inspeccionar solo payload/respuesta; no copiar ni compartir Authorization.
4. En las respuestas de desafíos debe aparecer finalizaEn; en ranking/historial,
   puntos como objeto. En pantalla se conservan fechas y totales anteriores.
   Para probar crear/check-in se necesita autorización para escribir en la base
   elegida: no se ejecutaron esas operaciones aquí.
5. Probar el build antiguo 1.0.0 que ya se disponga, contra rutas legacy/v1:
   debe conservar fechaFin y puntos numéricos. Confirmar Deprecation/Sunset y los
   logs api.v1.request del servidor. No se construyó ni etiquetó un build antiguo.
6. En otra consola, una consulta GET /v1/desafios con x-app-version=0.9.0,
   x-platform=web y SIN token debe dar 426 antes de resolver perfiles.
   /version-policy debe seguir dando 200; /auth/me sin token debe dar 401.
7. Para aviso recomendado, configurar temporalmente en el proceso del backend
   mínima=1.0.0 y recomendada=1.2.0, reiniciar y recargar Web: Más tarde debe
   permitir continuar. No editar .env para esta prueba.
8. Para bloqueo obligatorio, mínima=recomendada=1.2.0: recargar Web debe mostrar
   instrucciones y reintento. Restaurar mínima=1.0.0/recomendada=1.1.0, reiniciar
   y pulsar Volver a comprobar: debe recuperar las rutas.
9. Con dos cuentas ya vinculadas en navegadores distintos, abrir un desafío común
   y comprobar reconexión/refresco HTTP de Socket.IO. Probar alientos o check-ins
   solo en una base autorizada para esas operaciones.

## Pendientes y diferencias respecto del TP

- No se hizo la ruptura deliberada de Consigna A, tags app-1.0.0/app-1.1.0,
  publicación, build antiguo ni capturas/matriz empírica con builds reales.
- El almacenamiento conserva el modelo histórico: los cambios estructurales son
  del contrato HTTP, por la prohibición de migrar datos y conservar negocio.
- PAUSADO es vocabulario reservado, no un flujo de pausa implementado.
- Falta confirmar fecha real de Sunset y URL de distribución.
- Falta la regresión Web/nativa real y evidencia de recuperación 1.0.0/1.1.0.
- Analytics, consentimiento, monitoreo, alertas y postmortem quedan fuera del bloque.

Referencias técnicas: [NestJS versioning](https://docs.nestjs.com/techniques/versioning),
[Deprecation RFC 9745](https://www.rfc-editor.org/rfc/rfc9745.html),
[Sunset RFC 8594](https://www.rfc-editor.org/rfc/rfc8594.html),
[Expo Constants SDK 58](https://docs.expo.dev/versions/v58.0.0/sdk/constants/).

## Inventario de archivos

Backend:
- backend/src/versioning/contract.ts (nuevo)
- backend/src/versioning/version-policy.ts (nuevo)
- backend/src/versioning/versioning.module.ts (nuevo)
- backend/src/versioning/versioning.spec.ts (nuevo)
- backend/src/main.ts
- backend/src/app.module.ts
- backend/src/common/calendario.ts
- backend/src/common/calendario.spec.ts
- backend/src/checkins/dto/create-checkin.dto.ts
- backend/src/checkins/schemas/checkin.schema.ts
- backend/src/checkins/checkins.service.ts
- backend/src/checkins/checkins.service.spec.ts
- backend/src/desafios/dto/listar-desafios.dto.ts
- backend/src/desafios/desafios.service.ts
- backend/.env.example

Mobile:
- mobile/app.json
- mobile/package.json
- mobile/package-lock.json
- mobile/src/api/client.ts
- mobile/src/api/version.ts (nuevo)
- mobile/src/components/VersionGate.tsx (nuevo)
- mobile/src/app/_layout.tsx
- mobile/src/app/(tabs)/explorar.tsx
- mobile/src/app/(tabs)/index.tsx
- mobile/src/app/desafio/[id].tsx
- mobile/src/types/index.ts
- mobile/src/utils/fechas.ts
- mobile/test/client.test.cjs
- mobile/test/version.test.cjs (nuevo)
- mobile/test/version-loader.cjs (nuevo)

Documentación: README.md y docs/parte-4-versionado.md (nuevo).

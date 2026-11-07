# Rachas | Desarrollo 2

Aplicación para crear desafíos de hábitos, invitar participantes y registrar avances diarios. Las **Partes I y II** incluyen una API REST con NestJS y MongoDB Atlas y una app React Native / Expo con ingreso provisional, desafíos, check-ins, rachas y ranking.

## Estado actual y Parte IV

La sesión vigente usa Firebase Authentication + Persona en MongoDB; Socket.IO conserva
las salas y alientos de Parte III. La app ahora se prepara como **1.1.0** y consume
**/v2**. Las rutas sin prefijo y **/v1** conservan el contrato anterior y requieren
Firebase; `x-usuario-id` no autentica.

Consultar [Parte IV: contratos y política](docs/parte-4-versionado.md) para la
configuración, las excepciones al 426 y la validación manual. Las secciones
históricas de Partes I/II que siguen no reemplazan la configuración actual de
autenticación. Mantener `SEED_ENABLED=false` y
`MONGODB_AUTO_INIT_ENABLED=false` para arrancar sin escrituras automáticas.

## Tecnologías

- **Backend:** Node.js, NestJS, TypeScript, Mongoose.
- **Persistencia:** MongoDB Atlas.
- **Móvil:** React Native, Expo, Expo Router, TypeScript.
- **Pruebas manuales:** Postman.

## Estructura del repositorio

```text
proyecto-rachas/
├── backend/             # API REST, modelos y seed
├── mobile/              # Aplicación React Native / Expo
└── README.md
```

## Requisitos previos

- Node.js y npm.
- Acceso a una instancia de MongoDB Atlas.
- Para probar en Android: Android Studio con un emulador configurado, o un dispositivo físico con Expo Go.
- Postman para ejecutar el recorrido de pruebas.

## 1. Configurar y ejecutar el backend

Desde la raíz del repositorio:

```bash
cd backend
npm install
```

Crear el archivo `backend/.env` con la cadena de conexión a MongoDB Atlas y las variables que utiliza la configuración de NestJS. **Consultar `backend/src/app.module.ts` para confirmar el nombre exacto de la variable de conexión** antes de ejecutar. No subir credenciales al repositorio.

```bash
npm run start:dev
```

La API se utiliza en los ejemplos con `http://localhost:3000`. La conexión a Atlas debe funcionar sin modificar el código fuente entre ejecuciones. El proyecto incluye un servicio de *seed* con datos iniciales, diseñado para poder ejecutarse más de una vez sin duplicar los registros preexistentes.

## 2. Configurar y ejecutar la aplicación móvil

```bash
cd mobile
npm install
```

Crear `mobile/.env.local` tomando como referencia `mobile/.env.example`:

```dotenv
# Emulador Android estándar
EXPO_PUBLIC_API_URL=http://10.0.2.2:3000
```

Para ejecutar en el navegador, usar `http://localhost:3000`. En un celular físico, utilizar la dirección IP local de la computadora que ejecuta el backend y asegurar que ambos dispositivos puedan comunicarse.

Iniciar Expo:

```bash
npx expo start -c
```

Con el emulador Android encendido, presionar `a` en la terminal de Expo. Para abrir la versión web, presionar `w` (con las dependencias web instaladas).

La app tiene pestañas Inicio, Explorar, Crear y Perfil, y una pila para el detalle. El listado paginado consulta `GET /desafios` y presenta **nombre, categoría, estado y fechas**. También contempla indicador de carga, mensaje de error y botón para reintentar. El cliente HTTP utiliza la variable `EXPO_PUBLIC_API_URL` y un tiempo límite para evitar esperas indefinidas si la API no responde.

## 3. Modelo de datos y decisiones de persistencia

Se utilizan tres colecciones principales: **personas**, **desafíos** y **check-ins**.

### Personas

Cada persona se almacena como un documento independiente con `nombre`, `alias`, `email` y `zonaHoraria`. La zona horaria predeterminada es `America/Argentina/Buenos_Aires`. El `alias` y el `email` son únicos; el alias admite de 3 a 20 caracteres alfanuméricos o guion bajo.

### Desafíos

Cada desafío es un documento independiente con nombre, descripción opcional, categoría, fechas de inicio y fin, capacidad, código de invitación y cancelación. `creador` es una referencia (`ObjectId`) a una persona.

Los arreglos `participantes` y `exParticipantes` contienen **referencias `ObjectId` a personas**, en lugar de duplicar sus datos. Esto evita inconsistencias si se modifica el nombre de una persona. Los arreglos se mantienen en el documento del desafío porque su tamaño está acotado por la capacidad del desafío y son necesarios para operaciones frecuentes como unirse, abandonar y listar participantes. `exParticipantes` permite registrar quiénes abandonaron y aplicar la regla de no reincorporación.

El estado no se almacena como un campo persistido. Se **calcula** a partir de `fechaInicio`, `fechaFin` y `cancelado`, obteniendo `PROGRAMADO`, `ACTIVO`, `FINALIZADO` o `CANCELADO`. Así se evita que un estado guardado quede desactualizado al pasar los días.

### Check-ins

Cada check-in es un documento independiente con referencias a `persona` y `desafio`, además de `fecha`, `nota` opcional y `valor` opcional.

Se eligió una colección separada, en vez de embebir todos los check-ins dentro del desafío, porque los registros diarios pueden crecer con el tiempo y se consultan por persona y desafío. Además, esta estructura permite imponer directamente una restricción de unicidad a nivel de base de datos.

**Representación del día:** `fecha` se guarda como una cadena `YYYY-MM-DD`, que representa un **día calendario**, no un instante con hora UTC. Las reglas de creación toman en cuenta la zona horaria de la persona para determinar qué día corresponde. Esto evita que un cambio de fecha en UTC desplace el día local del check-in.

Las fechas de inicio y fin del desafío se almacenan como `Date` y se comparan por su componente de día calendario al aplicar las reglas del negocio.

## 4. Índices únicos

| Colección | Campo(s) | Motivo |
|---|---|---|
| Personas | `alias` | Evitar alias repetidos |
| Personas | `email` | Evitar correos repetidos |
| Desafíos | `codigoInvitacion` | Identificar inequívocamente cada invitación |
| Check-ins | `persona`, `desafio`, `fecha` | Permitir como máximo un check-in por persona, desafío y día |

El índice compuesto de check-ins se declara en Mongoose con:

```ts
CheckinSchema.index(
  { persona: 1, desafio: 1, fecha: 1 },
  { unique: true },
);
```

Los índices únicos se implementan en la base de datos; las validaciones de DTO complementan, pero no sustituyen, esas restricciones.

## 5. Endpoints REST

**Personas**

| Método | Ruta | Función |
|---|---|---|
| POST | `/personas` | Crear persona |
| GET | `/personas` | Listar personas |
| GET | `/personas/:id` | Ver persona |
| PATCH | `/personas/:id` | Actualizar datos permitidos |
| GET | `/personas/:id/desafios` | Listar desafíos de una persona |

**Desafíos**

| Método | Ruta | Función |
|---|---|---|
| POST | `/desafios` | Crear desafío |
| GET | `/desafios` | Listar desafíos; filtros `estado` y `categoria` |
| GET | `/desafios/:id` | Ver desafío |
| PATCH | `/desafios/:id` | Actualizar desafío |
| PATCH | `/desafios/:id/cancelar` | Cancelar desafío |
| POST | `/desafios/unirse/:codigo` | Unirse con código |
| POST | `/desafios/:id/abandonar` | Abandonar desafío |
| GET | `/desafios/:id/participantes` | Listar participantes |

**Check-ins**

| Método | Ruta | Función |
|---|---|---|
| POST | `/desafios/:desafioId/checkins` | Registrar check-in |
| DELETE | `/desafios/:desafioId/checkins/ultimo` | Deshacer último check-in permitido |
| GET | `/desafios/:desafioId/checkins?personaId=...` | Consultar check-ins de una persona |

Las operaciones que actúan en nombre de una persona utilizan la cabecera HTTP `x-usuario-id` según corresponda. Los DTO y servicios aplican validaciones y reglas de negocio. Las respuestas JSON ocultan los campos internos `_id` y `__v` y exponen `id`.

## 6. Pruebas con Postman

Importar [rachas.postman_collection.json](rachas.postman_collection.json), **Rachas - Partes I y II**, y ejecutar los pedidos en orden con el backend levantado. La variable `baseUrl` usa `http://localhost:3000` por defecto.

El recorrido crea dos personas y un desafío activo, une a la segunda persona, registra y deshace un check-in, comprueba ranking, resumen, racha e historial paginado, valida errores 400/404/409 y cancela el desafío al terminar. Cada ejecución usa alias y emails nuevos; los datos de prueba quedan en la base.

```bash
npx --yes --package newman newman run rachas.postman_collection.json --bail
```

## 7. Consideraciones para la entrega

- Mantener `backend/.env` y `mobile/.env.local` fuera del control de versiones.
- Incluir archivos `.env.example` sin secretos para documentar la configuración.
- Confirmar que el backend arranca conectado a Atlas y que la app muestra los desafíos en el emulador Android.
- Incluir la colección de Postman en el repositorio o adjuntarla en la entrega.

## Parte II — app completa

Implementados ingreso con sesión persistente, pestañas Inicio/Explorar/Crear/Perfil, detalle, check-ins, puntos, rachas, ranking, resumen y paginación. Ver [documentación y pruebas](docs/parte-2.md).

La colección [Rachas - Partes I y II](rachas.postman_collection.json) incluye el recorrido de integración.

## Elección del proveedor de autenticación: Firebase Authentication**

Se seleccionó Firebase Authentication para implementar el inicio de sesión con Google, debido a su integración con el ecosistema Expo/React Native y a la disponibilidad de Firebase Admin SDK para verificar tokens de identidad desde NestJS.

Esta arquitectura permite separar la autenticación de la lógica de negocio: Firebase verifica la identidad del usuario, mientras que MongoDB Atlas conserva los perfiles, desafíos, participantes y registros de actividad.

Se evaluó Auth0 como alternativa válida, pero se priorizó Firebase por ajustarse al alcance del proyecto, centrado en autenticación con Google, sin requerimientos avanzados de gestión empresarial de identidades.

## Parte IV — Analytics y tracking

El [tracking plan](docs/tracking-plan.md) define los siete eventos mínimos de la
Consigna C, el consentimiento apagado por defecto, la cola offline y los
pipelines de métricas. El perfil incluye Compartir datos de uso; no se usa
Firebase Analytics ni se almacenan tokens en la cola.

Endpoints autenticados: POST /v2/analytics/events, GET/PATCH
/v2/analytics/consent y GET /v2/analytics/metrics. Hay variantes v1/legacy.
Los eventos y consentimiento tienen una excepción de versión para medir el
aviso obligatorio; la autenticación Firebase continúa siendo obligatoria.

Antes de habilitar recepción, provisionar manualmente la colección e índices
TTL de 30 días y único persona+eventId descritos en el plan. La aplicación no
los crea. Configurar ANALYTICS_READER_UIDS para permitir las métricas globales
solo a operadores; vacío deniega a todos. Mantener SEED_ENABLED=false y
MONGODB_AUTO_INIT_ENABLED=false. No se modifican los .env existentes.

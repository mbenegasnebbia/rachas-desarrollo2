# Rachas

**Aplicación de desafíos y seguimiento de hábitos**

Rachas es una aplicación que permite crear desafíos personales y grupales, compartirlos con otras personas y registrar el progreso diario mediante check-ins.

Su objetivo es incentivar la constancia a través de rachas de cumplimiento, puntos, rankings y herramientas de interacción entre participantes.

El proyecto integra una API REST desarrollada con **NestJS**, una aplicación multiplataforma construida con **React Native y Expo**, persistencia en **MongoDB Atlas** y autenticación mediante **Firebase Authentication**.

## Funcionalidades principales

### Desafíos y participación

- Crear desafíos con nombre, descripción, categoría, fechas y cupo de participantes.
- Explorar desafíos y consultar sus detalles.
- Solicitar acceso mediante un código de invitación.
- Aprobar o rechazar solicitudes desde la cuenta del creador.
- Consultar solicitudes propias y cancelar las que estén pendientes.
- Administrar desafíos creados, abandonar participaciones o cancelar desafíos según los permisos correspondientes.

### Seguimiento de hábitos

- Registrar check-ins diarios.
- Consultar el historial de actividad.
- Visualizar la racha actual y la mejor racha alcanzada.
- Acumular puntos por cumplimiento y continuidad.
- Comparar resultados mediante rankings.
- Consultar los resultados de desafíos finalizados.

### Interacción en tiempo real

Rachas utiliza **Socket.IO** para comunicar cambios entre participantes conectados a un mismo desafío.

Permite actualizar información de check-ins, participantes y rankings, además de enviar alientos mediante emojis.

Los alientos son temporales y no se almacenan como historial permanente.

### Autenticación y perfiles

El acceso web utiliza **Google mediante Firebase Authentication**.

El backend valida los tokens de identidad con Firebase Admin SDK y asocia cada usuario autenticado con su perfil en MongoDB.

Las operaciones protegidas verifican la identidad y los permisos del usuario desde el servidor.

### Versionado y compatibilidad

La API admite contratos `/v1` y `/v2`, además de rutas históricas de compatibilidad.

La aplicación consulta una política de versiones que permite informar actualizaciones recomendadas o exigir una actualización cuando la versión instalada es inferior a la mínima admitida.

### Analytics y privacidad

Rachas incorpora seguimiento opcional de eventos de uso para analizar la actividad de la aplicación.

- El consentimiento está desactivado por defecto.
- Los eventos se registran únicamente con autorización del usuario.
- Se utiliza una cola local para manejar interrupciones de conexión.
- El backend valida el consentimiento antes de aceptar eventos.
- Las métricas agregadas están restringidas a operadores autorizados.

## Arquitectura y tecnologías

| Capa | Tecnologías |
|---|---|
| Aplicación | React Native, Expo, Expo Router, TypeScript |
| Backend | Node.js, NestJS, TypeScript |
| Base de datos | MongoDB Atlas, Mongoose |
| Autenticación | Firebase Authentication, Firebase Admin SDK |
| Tiempo real | Socket.IO |
| Pruebas | Jest, Node.js Test Runner |
| Validación de código | ESLint, TypeScript |

La aplicación consume los servicios del backend mediante HTTP y utiliza Socket.IO para recibir actualizaciones en tiempo real.

MongoDB almacena perfiles, desafíos, check-ins, solicitudes de acceso y eventos de Analytics. Firebase se encarga de la autenticación, mientras que las reglas de negocio y los controles de autorización se ejecutan en NestJS.

## Estructura del repositorio

```text
├── backend/
│   ├── src/                  # API, módulos y lógica de negocio
│   ├── test/                 # Pruebas del backend
│   └── docs/                 # Documentación de contratos
├── mobile/
│   ├── src/
│   │   ├── app/              # Pantallas y navegación
│   │   ├── api/              # Comunicación con el backend
│   │   ├── auth/             # Autenticación y sesión
│   │   ├── analytics/        # Tracking y consentimiento
│   │   ├── components/       # Componentes reutilizables
│   │   └── hooks/            # Lógica reutilizable
│   └── test/                 # Pruebas del cliente
├── docs/                     # Documentación técnica
├── rachas.postman_collection.json
└── README.md
```

## Instalación y ejecución

### Requisitos

- Node.js y npm.
- Una base de datos MongoDB Atlas accesible.
- Un proyecto Firebase con autenticación Google configurada.
- Credenciales de Firebase Admin para el backend.
- Un navegador compatible para ejecutar Expo Web.

### 1. Backend

Ingresar a la carpeta e instalar las dependencias:

```bash
cd backend
npm install
```

Crear `backend/.env` tomando como referencia `backend/.env.example`.

Configurar las variables correspondientes:

| Variable | Descripción |
|---|---|
| `MONGODB_URI` | Cadena de conexión a MongoDB |
| `PORT` | Puerto HTTP del backend, normalmente 3000 |
| `FIREBASE_PROJECT_ID` | Identificador del proyecto Firebase |
| `SEED_ENABLED` | Habilita explícitamente la carga de datos iniciales |
| `MONGODB_AUTO_INIT_ENABLED` | Controla la inicialización automática de estructuras MongoDB |
| `SOCKET_ALLOWED_ORIGINS` | Orígenes autorizados para Socket.IO |
| `MIN_APP_VERSION` | Versión mínima admitida |
| `RECOMMENDED_APP_VERSION` | Versión recomendada |
| `V1_SUNSET_DATE` | Fecha anunciada de retiro de v1 |
| `APP_UPDATE_URL` | URL pública para actualizar la aplicación |
| `ANALYTICS_READER_UIDS` | UIDs Firebase autorizados para consultar métricas |

Firebase Admin utiliza Application Default Credentials. En desarrollo local puede configurarse `GOOGLE_APPLICATION_CREDENTIALS` con la ruta absoluta a un archivo JSON privado, almacenado fuera del repositorio.

Para iniciar el backend:

```bash
npm run start:dev
```

La API estará disponible en `http://localhost:3000` si se utiliza el puerto predeterminado.

**Importante:** con `SEED_ENABLED=false` y `MONGODB_AUTO_INIT_ENABLED=false`, la aplicación no provisiona automáticamente las colecciones e índices necesarios. En una base nueva, deben crearse previamente las estructuras requeridas por autenticación, solicitudes de acceso y Analytics.

### 2. Aplicación

Abrir otra terminal:

```bash
cd mobile
npm install
```

Crear `mobile/.env.local` tomando como referencia `mobile/.env.example`.

Configurar la dirección del backend mediante `EXPO_PUBLIC_API_URL`:

| Entorno | Valor de ejemplo |
|---|---|
| Expo Web | `http://localhost:3000` |
| Emulador Android | `http://10.0.2.2:3000` |
| Dispositivo físico | `http://IP_LOCAL_DEL_EQUIPO:3000` |

Para la autenticación web también se requieren las variables públicas de Firebase:

```dotenv
EXPO_PUBLIC_FIREBASE_API_KEY=
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=
EXPO_PUBLIC_FIREBASE_PROJECT_ID=
EXPO_PUBLIC_FIREBASE_APP_ID=
```

Iniciar Expo:

```bash
npx expo start -c
```

Para abrir directamente la aplicación web:

```bash
npm run web
```

**Nota de compatibilidad:** el flujo de inicio de sesión con Google está implementado para Expo Web. El inicio de sesión nativo para Android e iOS no forma parte de la implementación documentada.

## Pruebas

### Backend

Desde `backend/`:

```bash
npm test
npm run build
```

Para ejecutar las pruebas de manera secuencial:

```bash
npm test -- --runInBand
```

### Aplicación

Desde `mobile/`:

```bash
node --test test/*.test.cjs
npm run lint
npm run typecheck
```

Para generar una exportación web:

```bash
npx expo export --platform web
```

Las pruebas automatizadas verifican contratos y comportamiento mediante simulaciones de dependencias. Las comprobaciones con Firebase, MongoDB Atlas, transacciones reales y dispositivos requieren un entorno configurado para pruebas de integración.

## Documentación técnica

- [Autenticación e integración de perfiles](docs/parte-3-integracion-web.md)
- [Socket.IO y alientos](docs/parte-3-socket-alientos.md)
- [Versionado y compatibilidad de API](docs/parte-4-versionado.md)
- [Tracking plan de Analytics](docs/tracking-plan.md)
- [Solicitudes de acceso: contrato y reglas de negocio](backend/docs/solicitudesAcceso.md)
- [Colección de Postman](rachas.postman_collection.json)

## Consideraciones

- Las credenciales privadas, tokens y cadenas de conexión no deben incorporarse al repositorio.
- El backend requiere índices específicos para garantizar unicidad, consistencia y retención de datos.
- Los alientos de Socket.IO no tienen persistencia ni entrega garantizada a usuarios desconectados.
- El consentimiento de Analytics es opcional y puede revocarse desde el perfil.
- Algunas funcionalidades de despliegue y compatibilidad requieren validación manual en un entorno real.

---

**Rachas** | Proyecto integrador de desarrollo de aplicaciones.
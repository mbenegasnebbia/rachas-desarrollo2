# Parte III, etapa 2: Firebase Admin en NestJS

Solo GET /auth/me usa FirebaseAuthGuard en esta etapa. Los endpoints de Parte II
siguen utilizando x-usuario-id; no se vinculan personas de MongoDB ni se cambia
la sesión del frontend.

## Credenciales locales (ADC)

Firebase Admin se inicializa una sola vez, al primer uso, con un proyecto
explícito y Application Default Credentials. Si falta el proyecto o falla la
inicialización, responde 503 con un mensaje genérico, sin imprimir credenciales.
Un token ausente, mal formado, vencido, firmado incorrectamente o de otro
proyecto responde 401. El guard no recurre a x-usuario-id.

En Firebase Console, obtener una cuenta de servicio del proyecto con los
permisos necesarios para el entorno de desarrollo. Guardar el archivo JSON
privado fuera del repositorio, fuera de mobile y de cualquier carpeta pública.
Nunca pegar su contenido en .env, ejemplos, chats o capturas.

En PowerShell, antes de iniciar el proceso:

```powershell
$env:FIREBASE_PROJECT_ID = 'rachas-desarrollo2'
$env:GOOGLE_APPLICATION_CREDENTIALS = 'C:\Users\TU_USUARIO\.config\rachas\firebase-admin.json'
```

La segunda variable contiene una RUTA, no el JSON. No usar EXPO_PUBLIC_* para
credenciales Admin. En infraestructura Google, ADC también puede usar una
identidad adjunta al entorno sin archivo de clave.
No configurar FIREBASE_AUTH_EMULATOR_HOST al validar tokens reales.
Las variables de proceso tienen prioridad sobre .env. El arranque normal carga
backend/.env como antes; este trabajo no lo modifica.

Se verifica el Firebase ID token con verifyIdToken(token): firma, vigencia y
proyecto. No se acepta un Google OAuth token ni un custom token de Admin.
La comprobación de revocación NO está habilitada en esta etapa.

## Arranque aislado SIN MongoDB ni seed

NO usar AppModule, npm run start:dev ni los E2E para esta prueba aislada:
AppModule sigue importando SeedModule y configurando MongoDB.

Desde backend, con las variables anteriores en la misma terminal:

```powershell
node -r ts-node/register -e "require('reflect-metadata'); const { NestFactory } = require('@nestjs/core'); const { AuthModule } = require('./src/auth/auth.module'); async function run() { const app = await NestFactory.create(AuthModule); app.enableCors({ origin: 'http://localhost:8082' }); await app.listen(3001); } void run();"
```

Esto importa únicamente AuthModule y ConfigModule; no carga .env por sí solo.
Cambiar el origen CORS de este comando si Expo usa otro puerto.
No ejecutar el comando hasta haber configurado las credenciales.

Sin Authorization: GET http://localhost:3001/auth/me debe devolver 401.
Con Authorization: Bearer invalido también debe devolver 401.

## Prueba positiva sin copiar o imprimir el token

Mantener el frontend intacto. En DevTools del navegador:

1. En Sources, abrir mobile/src/auth/google.web.ts y poner un breakpoint en
   el return posterior a await signInWithPopup, donde la variable user existe.
2. Pulsar Continuar con Google y completar el popup.
3. Con la ejecución detenida en ese contexto, evaluar lo siguiente en Console
   y luego continuar la ejecución del navegador:

```js
void (async () => {
  const response = await fetch('http://localhost:3001/auth/me', {
    headers: { Authorization: 'Bearer ' + await user.getIdToken() },
  });
  console.log('HTTP', response.status);
  console.log(await response.json());
})();
```

El token se obtiene y usa en memoria; no se imprime, no se copia a un archivo,
no se coloca en una URL y no queda escrito como literal en el historial.
No expandir/copiar headers Authorization ni compartir capturas de Network:
el navegador necesariamente puede inspeccionar el header que envía.

Esperado: HTTP 200 y solo uid, email, emailVerified, name y provider. No hay
persistencia ni asociación con Persona. Email/nombre/UID son datos personales:
no compartirlos públicamente aunque no sean credenciales.

## Verificaciones sin servicios externos

Desde backend:

```sh
node node_modules/typescript/bin/tsc --noEmit --incremental false
node node_modules/eslint/bin/eslint.js "src/**/*.ts" --no-cache
npm test -- --runInBand --no-cache auth/
```

Desde la raíz: git diff --check.

Los tests instancian clases con dependencias simuladas; el test del proveedor
simula las funciones de Firebase Admin. No importan AppModule ni arrancan Nest,
MongoDB o seeds. No se requiere un archivo privado para ejecutarlos.

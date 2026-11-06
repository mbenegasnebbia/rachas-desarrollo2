# Parte III, etapa 1: prueba Google en Expo Web

Esta etapa agrega una prueba aislada de Firebase Authentication en Ingreso.
No cambia la sesión provisional de Rachas, AsyncStorage ni `x-usuario-id`.
No crea ni vincula personas en MongoDB y no habilita rutas de Rachas.

## Configuración manual

En Firebase Console, proyecto rachas-desarrollo2:

1. Abrir Configuración del proyecto > Tus apps > Rachas Web.
2. Copiar del objeto de configuración los valores de apiKey, authDomain,
   projectId y appId a las variables EXPO_PUBLIC_FIREBASE_* de mobile/.env.example.
3. Agregar esas cuatro variables al archivo local existente mobile/.env
   o mobile/.env.local, sin reemplazar su contenido ni EXPO_PUBLIC_API_URL.
   Si ambos archivos definen una variable, revisar cuál tiene prioridad.
4. En Authentication > Sign-in method, habilitar Google y completar el email
   de soporte si la consola lo solicita.
5. En Authentication > Settings > Authorized domains, confirmar localhost.
   Usar localhost en el navegador; una IP local u otro hostname requiere su
   propia autorización.
6. Desde mobile, reiniciar Expo: `npx expo start --web -c`.

Las variables EXPO_PUBLIC_* se incluyen en el cliente. No colocar credenciales
Admin, claves privadas ni secretos OAuth. El botón muestra errores de
configuración sin imprimir tokens.

## Prueba manual

- Si hay una sesión provisional guardada, cerrarla desde Perfil para ver Ingreso.
- Sin configuración Firebase, el botón debe informar el problema; el ingreso
  provisional debe seguir disponible.
- Pulsar Continuar con Google y permitir el popup.
- Cerrar el popup: debe indicar cancelación y permitir reintentar.
- Completar el ingreso: deben aparecer nombre, email y UID de Firebase.
- Verificar que la pantalla siga en Ingreso y que el login Google por sí solo
  no dé acceso a pestañas ni a Detalle.
- Cerrar prueba de Google: debe desaparecer el usuario de prueba.
- Volver a ingresar y recargar: la prueba usa persistencia en memoria y no
  debe restaurarse como sesión de Rachas.
- Comprobar selección/registro provisional y cierre de sesión como antes.
- En Android/iOS no se muestra la prueba Web; no hay integración nativa nueva.

## Aislamiento

Firebase se inicializa bajo una app con nombre propio y persistencia en memoria.
Solo se devuelven al componente UID, nombre y email; no se solicitan ID tokens
para el backend. No se modifica SesionProvider ni el cliente HTTP actual.
Las llamadas de listado de personas que ya realiza Ingreso siguen existiendo.

## Verificaciones estáticas

Desde mobile:

```sh
node node_modules/typescript/bin/tsc --noEmit --incremental false
node node_modules/eslint/bin/eslint.js src --no-cache
```

Desde la raíz: `git diff --check`.

Un login real con Google debe verificarse manualmente con la configuración del
proyecto; las verificaciones estáticas no prueban OAuth ni permisos de consola.

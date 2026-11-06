# Parte III: sesión Web Firebase y Persona

La consigna original de Parte III no está en el repositorio. Esta implementación
protege por defecto todas las rutas salvo GET / (estado básico). Listados de
desafíos, detalles, participantes y ranking requieren un perfil completo.
El historial, la racha individual y las rutas de Persona por ID son del titular.
Confirmar estas decisiones de visibilidad con la consigna antes de la entrega.

## Datos y alta

Se conserva cada ObjectId y todas las referencias existentes. firebaseUid es
opcional para datos históricos y tiene un índice único PARCIAL sobre strings.
No hay vinculación por email ni selección manual de personas anteriores.

GET /auth/persona devuelve la persona del UID; si no existe, realiza un upsert
atómico por UID con email Google verificado y perfilCompleto=false. Usa un alias
interno aleatorio válido mientras el usuario elige el definitivo. Si un email
histórico colisiona con el índice existente, responde 409 y no toca ese perfil.
La recuperación/vinculación administrativa de perfiles históricos queda pendiente.

PATCH /auth/perfil acepta alias (3-20 alfanuméricos o guion bajo), nombre y zona
horaria opcionales. Usa el UID del token, solo completa perfiles incompletos y
responde 409 ante alias repetido. El perfil incompleto no puede operar desafíos.

GET /auth/me valida solo Firebase y no crea perfiles.
POST /personas deja de permitir altas arbitrarias (403).
x-usuario-id ya no interviene en ninguna autorización.

## Requisito MANUAL antes de habilitar altas

No se crearon índices ni documentos en Atlas durante la implementación.
Con SEED_ENABLED=false y MONGODB_AUTO_INIT_ENABLED=false, los índices nuevos NO
se crean al arrancar. Un administrador debe revisar y provisionar el índice
siguiente en la base correcta ANTES de los logins que creen perfiles:

```js
// Operación de estructura pendiente de autorización/ejecución manual.
db.personas.createIndex(
  { firebaseUid: 1 },
  {
    name: "firebaseUid_unique",
    unique: true,
    partialFilterExpression: { firebaseUid: { $type: "string" } }
  }
);
```

No reemplazar ni borrar los índices únicos de alias/email existentes. El servicio
consulta los índices antes del alta y devuelve 503 sin escribir si falta la
garantía de unicidad del UID. Los upserts simultáneos del mismo UID reutilizan
el documento ganador. El alta real ocurre al acceder, no en un seed.

## Configuración y arranque

- Backend: FIREBASE_PROJECT_ID=rachas-desarrollo2, ADC fuera del repo y MONGODB_URI
  de la base elegida. Nunca habilitar el emulador Firebase contra una base real.
- Mantener SEED_ENABLED=false y MONGODB_AUTO_INIT_ENABLED=false.
- Web: las cuatro EXPO_PUBLIC_FIREBASE_* ya configuradas y EXPO_PUBLIC_API_URL
  apuntando a la API completa (http://localhost:3000).
- Firebase Google habilitado y localhost autorizado.
- No hacen falta dependencias adicionales.
- Las instrucciones antiguas de la etapa 2 para arrancar solo AuthModule en
  3001 ya no aplican: AuthModule ahora requiere el modelo Persona. Usar la API
  completa en 3000, con el seed y auto-init desactivados.
- Reiniciar Expo y hacer una recarga completa: la app Firebase ahora se llama
  rachas-web y usa persistencia LOCAL administrada por el SDK.
- El objeto histórico rachas.persona.v1 de AsyncStorage deja de leerse. No se
  migra, no prueba identidad ni permite entrar en rutas.
- Android/iOS no tienen bypass provisional: el login nativo queda pendiente.

## Verificación manual (crea datos solo al probar el alta)

1. Preparar el índice en la base de desarrollo autorizada.
2. Levantar la API completa sin seed y abrir Expo Web.
3. Continuar con Google: el SDK autentica y NestJS resuelve el UID.
4. Cuenta nueva: elegir alias; uno ocupado debe devolver 409 y permitir corregir.
5. Completar perfil: entrar a Inicio. Al recargar/cerrar y reabrir, se restaura
   la sesión Firebase y se consulta la misma Persona, con el mismo ObjectId.
6. Abrir dos pestañas con la misma cuenta: no debe duplicarse el perfil.
7. Otra cuenta debe probarse en otro navegador/incógnito; la persistencia local
   Firebase se comparte entre pestañas del mismo origen.
8. Crear/unirse/check-in/deshacer/ranking funcionan como Parte II. No usar
   identidades históricas ficticias para probar Google sin una asociación aprobada.
9. Cerrar sesión: salir de las rutas. Un header x-usuario-id aislado debe dar 401;
   cambiar IDs de persona con token válido debe dar 403.
10. Un token expirado causa una renovación SDK y un solo reintento; un segundo
    401 termina con error, sin recurrir al ingreso anterior.
11. Email ya existente sin UID: 409 sin asociación automática ni cambio de datos.

## Verificaciones locales sin Atlas

Backend: TypeScript, ESLint sin --fix y npm test -- --runInBand --no-cache.
Mobile: TypeScript, ESLint y node --test test/client.test.cjs.
Los modelos y verificadores se simulan. No ejecutar E2E contra la base actual.
No se implementó Socket.IO ni se modificaron reglas de puntos, rachas o ranking.

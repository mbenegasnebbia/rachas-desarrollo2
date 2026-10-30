# Parte II — implementación y verificación

## Alcance

La app usa Expo Router con cuatro pestañas (Inicio, Explorar, Crear y Perfil) y una pila para el detalle. El ingreso permite elegir una persona existente o registrarla. La sesión provisional se guarda con AsyncStorage y todos los pedidos posteriores envían `x-usuario-id`. Registro y selección inicial de personas no requieren una identidad previa.

Las pantallas usan funciones tipadas de `mobile/src/api`; el cliente centraliza URL, cabecera, tiempo límite y errores. Los hooks se ocupan de carga, refresco al recuperar foco y bloqueo de acciones. Los listados admiten pull-to-refresh; errores de carga y de acciones tienen mensajes separados.

El formulario de creación valida nombre, descripción, duración inclusiva, fecha inicial y cupo. El selector de fechas es un calendario de React Native que funciona en Android y web sin módulos nativos adicionales.

## Contratos nuevos

| Método | Ruta | Respuesta |
|---|---|---|
| GET | `/desafios?pagina=1&limite=10&estado=ACTIVO&categoria=SALUD` | Página de desafíos |
| GET | `/desafios/:id/checkins?personaId=...&pagina=1&limite=10` | Página del historial |
| GET | `/desafios/:id/racha/:personaId` | Puntos, racha actual, mejor racha y check-in de hoy |
| GET | `/desafios/:id/ranking` | Participantes ordenados y ganador, o null |
| GET | `/personas/me/resumen` | Desafíos vigentes, racha, posición y check-in de hoy |
| GET | `/personas/me/resultados` | Desafíos finalizados con resultado personal y ganador |

Las páginas devuelven `{ items, total, pagina, limite, paginas }`. Página mínima 1, límite entre 1 y 50 (por defecto 10). Página inválida: 400; una página fuera del rango devuelve items vacío. El cambio desde los arrays de la parte I se hizo junto con la adaptación del cliente.

Los filtros y la paginación se resuelven en MongoDB, con orden estable por id descendente en desafíos y por fecha descendente en check-ins. Formatos inválidos responden 400, recursos ausentes 404, permisos insuficientes 403 y conflictos de estado 409.

## Puntos, rachas y fechas

Cada nuevo check-in persiste 10 puntos más 5 al completar de 3 a 6 días consecutivos, o 10 desde el séptimo. Para calcular su bonus se recorren exclusivamente los días consecutivos inmediatamente anteriores a su fecha. Un hueco corta la racha.

Los puntos quedan fijados al registrar: cargar ayer después de haber registrado hoy no recalcula el registro de hoy. Deshacer hoy elimina ese registro y sus puntos. Los check-ins anteriores a la parte II que no tenían puntos se interpretan con 0; no se reescribe automáticamente el historial de la parte I.

La racha actual puede terminar hoy o ayer, según la zona horaria IANA de cada persona. La mejor racha considera todo el historial. El ranking suma los puntos guardados, ordena por puntos descendentes, racha actual descendente y alias ascendente, e incluye solo participantes actuales. El ganador se obtiene al consultar un desafío finalizado; no hay tareas programadas.

El estado general del desafío usa el calendario de Argentina, igual que el backend de la parte I. La fecha de los check-ins y su racha usan la zona de la persona.

## Verificación reproducible

Backend:

```bash
cd backend
npm test -- --runInBand
npx tsc --noEmit --incremental false
npx eslint "src/**/*.ts"
```

Jest usa transformación TypeScript a ESM para cargar la versión instalada de `@nestjs/mongoose`. Las pruebas de servicios simulan los modelos; no necesitan Atlas.

App:

```bash
cd mobile
npm run lint
npm run typecheck
npx expo export --platform web --platform android
```

Integración con backend levantado:

```bash
npx --yes --package newman newman run rachas.postman_collection.json --bail
```

También se puede importar la colección en Postman y ejecutarla en orden. Cada ejecución crea dos personas identificadas como prueba, crea un desafío, recorre el flujo y lo cancela. Las personas y el desafío cancelado se conservan en la base. Usar una base de desarrollo. La URL se configura con la variable de colección `baseUrl`.

## Pruebas realizadas el 30/10/2026

- 21 pruebas automáticas del backend: bonus, huecos de racha, racha viva hasta ayer, mejor racha, calendario y zonas horarias, desempates, ganador y permisos para deshacer.
- Colección contra el backend local conectado a Atlas: 18 pedidos y 25 aserciones aprobados, incluidos 400, 404 y 409.
- TypeScript de backend y mobile aprobado; lint de mobile y backend aprobado.
- Exportación de bundles Android y web aprobada.
- Emulador Android `sdk_gphone64_x86_64`, Expo Go 58.0.5: ingreso con persona seed, Inicio y Explorar con datos de Atlas, formulario Crear y calendario, Perfil y conservación de sesión tras cerrar y reabrir Expo Go. Backend apagado: mensaje de timeout y Reintentar; al reiniciarlo se recuperó el listado de ingreso.
- iOS no probado: este entorno Windows no dispone de simulador de iOS.

## Recorrido manual de entrega

1. Abrir dos dispositivos, o Android y navegador, con personas distintas.
2. Crear un desafío que empiece hoy; compartir el código y unirse desde la otra sesión.
3. Registrar check-ins con nota y valor; refrescar ambos detalles para comprobar el ranking.
4. Deshacer el de hoy; comprobar que bajen los puntos y se habilite nuevamente el botón.
5. Probar filtros, páginas, abandonar con quien no es creador y cancelar con el creador.
6. Cerrar y reabrir la app: la sesión debe conservarse. Editar nombre y zona horaria.
7. Apagar el backend: cada consulta debe mostrar un mensaje y permitir reintentar. Reiniciarlo y verificar recuperación.

El recorrido completo con dos interfaces simultáneas y la prueba física de iOS siguen pendientes; no se consideran cubiertos por las pruebas de API.

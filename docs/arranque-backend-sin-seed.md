# API completa sin seed ni inicialización automática de MongoDB

El seed se registra en SeedModule, importado por AppModule. Nest llama
SeedService.onApplicationBootstrap() al inicializar la aplicación, tanto en el
arranque normal como en un E2E que importe AppModule y llame app.init().

Ahora ese hook retorna ANTES de consultar o escribir modelos salvo que
SEED_ENABLED sea exactamente true. Ausente, false u otro valor: deshabilitado.
No se elimina ni modifica ningún documento existente por desactivar el seed.

MONGODB_AUTO_INIT_ENABLED también es opt-in: por defecto autoCreate y autoIndex
son false en la conexión de Mongoose. Así se evitan comandos automáticos de
creación de colecciones/índices al arrancar. No se borran los índices existentes.
Una base NUEVA requerirá provisionar sus índices únicos de forma explícita
antes de utilizar operaciones de escritura; no habilitar la opción para esta
verificación de lectura.

## Comando exacto en PowerShell

Desde cualquier directorio:

```powershell
Set-Location 'C:\Users\marti\Desktop\rachas-desarrollo2\backend'
$env:PORT = '3000'
$env:SEED_ENABLED = 'false'
$env:MONGODB_AUTO_INIT_ENABLED = 'false'
npm run start:dev
```

El proceso carga la URI de backend/.env como antes. Las tres variables del
proceso prevalecen sobre valores de .env. No es necesario editar ese archivo.
El arranque se conecta a Atlas pero no ejecuta el seed ni inicializa estructuras.
Las rutas POST/PATCH/DELETE siguen siendo operaciones de escritura: no invocarlas
durante esta comprobación.

El servidor Firebase aislado de 3001 solo expone AuthModule; no reemplaza la API
completa. Ambos procesos pueden convivir en puertos distintos.

## Expo Web en 8081

Verificar que EXPO_PUBLIC_API_URL en la configuración local de mobile apunte a
http://localhost:3000. El puerto 8081 pertenece a Expo, 3000 a la API completa y
3001 a la prueba aislada Firebase. Reiniciar Expo con caché limpia si se cambia
su configuración local. El CORS existente de main.ts permite el origen 8081.

## Comprobaciones manuales de solo lectura

Con la API ya levantada:

- GET http://localhost:3000/personas
- GET http://localhost:3000/desafios?pagina=1&limite=10
- GET http://localhost:3000/desafios/ID_EXISTENTE/checkins?personaId=PERSONA_EXISTENTE&pagina=1&limite=10

Los dos IDs de la última consulta deben provenir de registros existentes.
No crear usuarios, desafíos o check-ins para esta revisión.

Los módulos y controladores de personas, desafíos y check-ins siguen importados.
La prueba routes.spec.ts comprueba sus prefijos, métodos y rutas mediante
metadata, sin iniciar servidor, ejecutar seeds ni conectarse a MongoDB.
Esto no sustituye una comprobación HTTP real; la última queda para ejecución
manual con la configuración local.

## Verificación local sin conexiones

Desde backend:

```sh
node node_modules/typescript/bin/tsc --noEmit --incremental false
node node_modules/eslint/bin/eslint.js "src/**/*.ts" --no-cache
npm test -- --runInBand --no-cache seed/seed.service.spec.ts common/mongo-options.spec.ts common/routes.spec.ts
```

Desde la raíz: git diff --check. No ejecutar test:e2e para esta revisión.

/* global __dirname */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function load(source, requireMock, exports = {}) {
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function('exports', 'require', compiled)(exports, requireMock);
  return exports;
}

function harness(id = 'desafio-a') {
  const handlers = new Map();
  const emitted = [];
  let focus;
  let connects = 0;
  let disconnects = 0;
  let refreshes = 0;
  const socket = {
    connected: true,
    on: (event, callback) => { handlers.set(event, callback); return socket; },
    connect: () => { connects++; handlers.get('connect')?.(); return socket; },
    disconnect: () => { disconnects++; return socket; },
    removeAllListeners: () => { handlers.clear(); return socket; },
    timeout: () => socket,
    emitWithAck: async (event, body) => { emitted.push({ event, body }); return { ok: true }; },
  };
  const react = {
    useRef: (current) => ({ current }),
    useState: (initial) => {
      let value = initial;
      return [value, (next) => { value = typeof next === 'function' ? next(value) : next; }];
    },
    useEffect: (callback) => callback(),
    useCallback: (callback) => callback,
  };
  const types = load(fs.readFileSync(path.join(__dirname, '../src/hooks/realtimeTypes.ts'), 'utf8'), () => ({}));
  const api = load(fs.readFileSync(path.join(__dirname, '../src/hooks/useDesafioRealtime.web.ts'), 'utf8'), (name) => {
    if (name === 'react') return react;
    if (name === 'expo-router') return { useFocusEffect: (callback) => { focus = callback; } };
    if (name === 'socket.io-client') return { io: () => socket };
    if (name === '@/auth/session') return { obtenerToken: async () => 'token-simulado' };
    if (name === '@/api/client') return { API_URL: 'http://example.invalid' };
    if (name === './realtimeTypes') return types;
    throw new Error('Import inesperado');
  });
  const result = api.useDesafioRealtime(id, 'persona', true, async () => { refreshes++; });
  const cleanup = focus();
  return { handlers, emitted, cleanup, result,
    connects: () => connects, disconnects: () => disconnects, refreshes: () => refreshes };
}
const flush = () => new Promise((resolve) => setImmediate(resolve));

test('al suscribir y reconectar recupera estado HTTP sin duplicar conexión', async () => {
  const h = harness();
  await flush();
  assert.equal(h.connects(), 1);
  assert.equal(h.refreshes(), 1);
  h.handlers.get('disconnect')('transport close');
  h.handlers.get('connect')();
  await flush();
  assert.equal(h.refreshes(), 2);
  assert.equal(h.emitted.filter((e) => e.event === 'desafio:suscribir').length, 2);
  h.cleanup();
});

test('las invalidaciones refrescan HTTP y al salir se eliminan listeners', async () => {
  const h = harness();
  await flush();
  h.handlers.get('checkin:registrado')({ desafioId: 'desafio-a' });
  await flush();
  assert.equal(h.refreshes(), 2);
  const sent = h.emitted.length;
  h.cleanup();
  assert.equal(h.handlers.size, 0);
  assert.equal(h.disconnects(), 1);
  h.result.enviar('👏');
  assert.equal(h.emitted.length, sent);
});

test('ignora eventos de otro desafío', async () => {
  const h = harness();
  await flush();
  h.handlers.get('checkin:registrado')({ desafioId: 'otro' });
  await flush();
  assert.equal(h.refreshes(), 1);
  h.cleanup();
});

test('normaliza el desafío de la ruta para no perder eventos por mayúsculas', async () => {
  const h = harness('DESAFIO-A');
  await flush();
  assert.equal(h.emitted[0].body.desafioId, 'desafio-a');
  h.handlers.get('checkin:registrado')({ desafioId: 'desafio-a' });
  await flush();
  assert.equal(h.refreshes(), 2);
  h.cleanup();
});

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function client(statuses, hasUser = true) {
  const calls = [];
  const refresh = [];
  const source = fs.readFileSync(path.join(__dirname, '../src/api/client.ts'), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  const obtenerToken = async (force) => {
    refresh.push(force);
    return hasUser ? 'token-simulado' : null;
  };
  const fetch = async (url, options) => {
    calls.push({ url, options });
    const status = statuses.shift();
    return {
      status, ok: status === 200,
      text: async () => JSON.stringify(status === 200 ? { id: 'persona-propia' } : { message: 'rechazado' }),
    };
  };
  new Function('exports', 'require', 'process', 'fetch', 'AbortController', 'setTimeout', 'clearTimeout', compiled)(
    exports, () => ({ obtenerToken }),
    { env: { EXPO_PUBLIC_API_URL: 'http://example.invalid' } },
    fetch, AbortController, setTimeout, clearTimeout,
  );
  return { api: exports, calls, refresh };
}

test('usa Bearer y no envía un header provisional', async () => {
  const c = client([200]);
  assert.deepEqual(await c.api.request('/auth/persona'), { id: 'persona-propia' });
  assert.ok(c.calls[0].options.headers.Authorization.startsWith('Bearer '));
  assert.equal('x-usuario-id' in c.calls[0].options.headers, false);
});

test('renueva y reintenta exactamente una vez después de 401', async () => {
  const c = client([401, 200]);
  await c.api.request('/auth/persona');
  assert.deepEqual(c.refresh, [false, true]);
  assert.equal(c.calls.length, 2);
});

test('un segundo 401 termina sin fallback ni más reintentos', async () => {
  const c = client([401, 401, 200]);
  await assert.rejects(c.api.request('/auth/persona'), (e) => e.status === 401);
  assert.equal(c.calls.length, 2);
});

test('403 no dispara renovación ni repetición de operaciones', async () => {
  const c = client([403]);
  await assert.rejects(c.api.request('/desafios', { method: 'POST', body: { nombre: 'simulado' } }), (e) => e.status === 403);
  assert.equal(c.calls.length, 1);
});

test('sin usuario Firebase no se envía ninguna petición', async () => {
  const c = client([200], false);
  await assert.rejects(c.api.request('/auth/persona'), (e) => e.status === 401);
  assert.equal(c.calls.length, 0);
});

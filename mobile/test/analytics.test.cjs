/* global __dirname */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
function compile(file, dependencies = {}, extra = {}) {
  const source = fs.readFileSync(path.join(__dirname, "../src/", file), "utf8");
  const js = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  const exports = {};
  new Function("exports", "require", ...Object.keys(extra), js)(
    exports,
    (name) => {
      if (!(name in dependencies))
        throw new Error("Unexpected dependency: " + name);
      return dependencies[name];
    },
    ...Object.values(extra),
  );
  return exports;
}
const { AnalyticsQueue } = compile("analytics/queue.ts");
const now = Date.parse("2026-11-06T12:00:00Z");
const challenge = "000000000000000000000001";
function storage() {
  const data = new Map();
  return {
    data,
    getItem: async (k) => data.get(k) ?? null,
    setItem: async (k, v) => {
      data.set(k, v);
    },
    removeItem: async (k) => {
      data.delete(k);
    },
  };
}
function setup(store = storage(), send) {
  let number = 0;
  const calls = [];
  const queue = new AnalyticsQueue(
    store,
    send ??
      (async (events, uid) => {
        calls.push({ events, uid });
        return events.map((e) => e.eventId);
      }),
    () =>
      "00000000-0000-4000-8000-" + (++number).toString(16).padStart(12, "0"),
    { appVersion: "1.1.0", platform: "web" },
    () => now,
  );
  return { queue, calls, store };
}
test("without consent, no capture, snapshot, persistence or sending", async () => {
  const f = setup();
  await f.queue.open("A", false);
  f.queue.track("ingreso_exitoso", {});
  f.queue.observe(
    [{ desafio: { id: challenge }, rachaActual: 4 }],
    "2026-11-06",
  );
  await f.queue.flush();
  await f.queue.settled();
  assert.equal(f.calls.length, 0);
  assert.equal(f.store.data.size, 0);
});
test("offline reload preserves IDs; reconnect delivers batches without extending events", async () => {
  const s = storage();
  const first = setup(s, async () => {
    throw new Error("offline");
  });
  await first.queue.open("A", true);
  first.queue.track("checkin_hecho", { desafio_id: challenge });
  await first.queue.settled();
  await first.queue.flush();
  const original = JSON.parse(s.data.get("rachas.analytics.v1.A")).events[0];
  first.queue.suspend();
  const next = setup(s);
  await next.queue.open("A", true);
  await next.queue.flush();
  assert.deepEqual(next.calls[0].events[0], original);
  assert.equal(
    JSON.parse(s.data.get("rachas.analytics.v1.A")).events.length,
    0,
  );
});
test("bounded storage, coalesced writes and batch size <=25", async () => {
  const f = setup();
  await f.queue.open("A", true);
  for (let i = 0; i < 250; i++) f.queue.track("ingreso_exitoso", {});
  await f.queue.settled();
  assert.equal(
    JSON.parse(f.store.data.get("rachas.analytics.v1.A")).events.length,
    200,
  );
  await f.queue.flush();
  assert.equal(f.calls.length, 8);
  assert.ok(f.calls.every((c) => c.events.length <= 25));
});
test("revoking in-flight clears queue and ignores late ACK", async () => {
  let resolve;
  const f = setup(
    storage(),
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  await f.queue.open("A", true);
  f.queue.track("ingreso_exitoso", {});
  await f.queue.settled();
  const sending = f.queue.flush();
  await new Promise((done) => setImmediate(done));
  f.queue.revoke();
  resolve(["00000000-0000-4000-8000-000000000001"]);
  await sending;
  await f.queue.settled();
  assert.equal(f.store.data.has("rachas.analytics.v1.A"), false);
});
test("switching account never delivers the other user's queue", async () => {
  const f = setup();
  await f.queue.open("A", true);
  f.queue.track("ingreso_exitoso", {});
  await f.queue.settled();
  await f.queue.open("B", true);
  f.queue.track("ranking_consultado", { desafio_id: challenge });
  await f.queue.flush();
  assert.ok(
    f.calls.every(
      (c) =>
        c.uid === "B" && c.events.every((e) => e.name === "ranking_consultado"),
    ),
  );
  assert.equal(f.store.data.has("rachas.analytics.v1.A"), false);
});
test("corrupt, stale and private properties are not sent", async () => {
  const f = setup();
  f.store.data.set(
    "rachas.analytics.v1.A",
    JSON.stringify({
      events: [
        {
          name: "ingreso_exitoso",
          properties: { email: "dummy@example.invalid" },
        },
      ],
    }),
  );
  await f.queue.open("A", true);
  f.queue.track("ingreso_exitoso", { email: "dummy@example.invalid" });
  await f.queue.flush();
  assert.equal(f.calls.length, 0);
});
test("storage errors never reject business tracking", async () => {
  const s = {
    getItem: async () => {
      throw Error();
    },
    setItem: async () => {
      throw Error();
    },
    removeItem: async () => {
      throw Error();
    },
  };
  const f = setup(s);
  await f.queue.open("A", true);
  assert.doesNotThrow(() => f.queue.track("ingreso_exitoso", {}));
  await f.queue.settled();
});
test("detects a previously observed lost streak once, not an undo on same day", async () => {
  const f = setup();
  await f.queue.open("A", true);
  const row = (n) => [{ desafio: { id: challenge }, rachaActual: n }];
  f.queue.observe(row(3), "2026-11-04");
  f.queue.observe(row(0), "2026-11-04");
  f.queue.observe(row(3), "2026-11-05");
  f.queue.observe(row(0), "2026-11-06");
  f.queue.observe(row(0), "2026-11-06");
  await f.queue.flush();
  assert.equal(f.calls[0].events.length, 1);
  assert.deepEqual(f.calls[0].events[0].properties, {
    desafio_id: challenge,
    racha_anterior: 3,
  });
});
function runtime(s = storage(), override, environment = {}) {
  let enabled = true,
    offline = false,
    count = 0;
  const calls = [];
  class ApiError extends Error {
    constructor(status) {
      super("simulated");
      this.status = status;
    }
  }
  const api = {
    ApiError,
    request: async (p, options = {}) => {
      calls.push({ p, options });
      if (override) {
        const value = await override(p, options, ApiError);
        if (value !== undefined) return value;
      }
      if (offline) throw new ApiError(0);
      if (p === "/analytics/consent") {
        if (options.method === "PATCH") enabled = options.body.enabled;
        return { enabled };
      }
      return { acceptedIds: options.body.events.map((e) => e.eventId) };
    },
  };
  const module = compile(
    "analytics/runtime.ts",
    {
      "@react-native-async-storage/async-storage": {
        __esModule: true,
        default: s,
      },
      "react-native": { Platform: { OS: "web" } },
      "@/api/client": api,
      "@/api/version": { APP_VERSION: "1.1.0" },
      "./queue": { AnalyticsQueue },
    },
    {
      ...environment,
      globalThis: {
        crypto: {
          randomUUID: () =>
            "00000000-0000-4000-8000-" +
            (++count).toString(16).padStart(12, "0"),
        },
      },
    },
  );
  return {
    module,
    s,
    calls,
    offline: (v) => {
      offline = v;
    },
    enabled: () => enabled,
  };
}
test("offline opt-out survives reload and synchronizes before any batch", async () => {
  const s = storage(),
    first = runtime(s);
  await first.module.connectAnalytics("A");
  first.offline(true);
  await first.module.setAnalyticsConsent(false);
  assert.equal(first.module.analyticsState().enabled, false);
  assert.equal(s.data.get("rachas.analytics.optout.A"), "1");
  const next = runtime(s);
  next.offline(true);
  await next.module.connectAnalytics("A");
  next.module.track("ingreso_exitoso", {});
  next.offline(false);
  await next.module.flushAnalytics();
  await next.module.flushAnalytics();
  assert.equal(next.module.analyticsState().enabled, false);
  assert.equal(next.enabled(), false);
  assert.ok(next.calls.every((c) => c.p !== "/analytics/events"));
});
test("unconfirmed offline consent preserves a durable queue until recovery", async () => {
  const s = storage(),
    q = setup(s);
  await q.queue.open("A", true);
  q.queue.track("checkin_hecho", { desafio_id: challenge });
  await q.queue.settled();
  const r = runtime(s);
  r.offline(true);
  await r.module.connectAnalytics("A");
  assert.equal(r.module.analyticsState().enabled, false);
  assert.equal(
    JSON.parse(s.data.get("rachas.analytics.v1.A")).events[0].name,
    "checkin_hecho",
  );
  r.offline(false);
  await r.module.flushAnalytics();
  await r.module.flushAnalytics();
  assert.ok(
    r.calls.some(
      (c) => c.p === "/analytics/events" && c.options.expectedUid === "A",
    ),
  );
});
test("late operation from a prior account context is ignored", async () => {
  const r = runtime();
  await r.module.connectAnalytics("A");
  const context = r.module.analyticsContext();
  await r.module.connectAnalytics("B");
  r.module.track("checkin_hecho", { desafio_id: challenge }, context);
  await r.module.flushAnalytics();
  const sent = r.calls
    .filter((c) => c.p === "/analytics/events")
    .flatMap((c) => c.options.body.events);
  assert.ok(sent.every((e) => e.name !== "checkin_hecho"));
});
test("token retrieval checks expected Firebase UID before and after renewal", async () => {
  let finish;
  const user = {
    uid: "A",
    getIdToken: () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  };
  const auth = { currentUser: user };
  const session = compile("auth/session.web.ts", {
    "firebase/auth": {},
    "./firebase.web": { obtenerAuthFirebase: () => auth },
    "./google.web": { resultadoErrorGoogle: () => ({ mensaje: "simulated" }) },
  });
  assert.equal(await session.obtenerToken(false, "B"), null);
  const pending = session.obtenerToken(true, "A");
  auth.currentUser = { uid: "B" };
  finish("dummy-not-a-real-token");
  assert.equal(await pending, null);
});

test("two flush calls share one in-flight batch and keep unacknowledged events", async () => {
  let finish,
    calls = 0;
  const f = setup(storage(), (batch) => {
    calls++;
    return new Promise((resolve) => {
      finish = () => resolve([batch[0].eventId]);
    });
  });
  await f.queue.open("A", true);
  f.queue.track("ingreso_exitoso", {});
  await f.queue.settled();
  const first = f.queue.flush();
  await new Promise((resolve) => setImmediate(resolve));
  await f.queue.flush();
  assert.equal(calls, 1);
  finish();
  await first;
  assert.equal(
    JSON.parse(f.store.data.get("rachas.analytics.v1.A")).events.length,
    0,
  );
});
test("expired offline events are pruned on reload", async () => {
  const f = setup();
  f.store.data.set(
    "rachas.analytics.v1.A",
    JSON.stringify({
      events: [
        {
          eventId: "00000000-0000-4000-8000-000000000001",
          name: "ingreso_exitoso",
          occurredAt: new Date(now - 8 * 86400000).toISOString(),
          appVersion: "1.1.0",
          platform: "web",
          properties: {},
        },
      ],
    }),
  );
  await f.queue.open("A", true);
  await f.queue.flush();
  await f.queue.settled();
  assert.equal(f.calls.length, 0);
});
test("API instrumentation emits only after success and never includes free text", async () => {
  const tracked = [],
    response = { id: challenge, categoria: "SALUD" };
  let reject = false;
  const deps = {
    "@/analytics/runtime": {
      analyticsContext: () => 7,
      track: (...args) => tracked.push(args),
    },
    "./client": {
      request: async () => {
        if (reject) throw Error("failed operation");
        return response;
      },
    },
  };
  const api = compile("api/desafios.ts", deps);
  assert.equal(
    await api.crearDesafio({
      nombre: "private title",
      descripcion: "private description",
    }),
    response,
  );
  assert.deepEqual(
    tracked.map(([name, props]) => ({ name, props })),
    [
      {
        name: "desafio_creado",
        props: { desafio_id: challenge, categoria: "SALUD" },
      },
    ],
  );
  reject = true;
  await assert.rejects(api.crearDesafio({ nombre: "private" }));
  assert.equal(tracked.length, 1);
  assert.ok(tracked.every((args) => args[2] === 7));
  const checks = compile("api/checkins.ts", deps);
  reject = false;
  await checks.checkin(challenge, {
    fecha: "2026-11-06",
    nota: "private note",
    valor: 5,
  });
  assert.deepEqual(tracked[1][1], { desafio_id: challenge });
});

const tick = () => new Promise((resolve) => setImmediate(resolve));
test("setItem failure still revokes remotely and failed PATCH retries from memory", async () => {
  const s = storage(),
    r = runtime(s);
  await r.module.connectAnalytics("A");
  s.setItem = async () => {
    throw Error("disk");
  };
  r.offline(true);
  await r.module.setAnalyticsConsent(false);
  assert.ok(r.calls.some((c) => c.options.method === "PATCH"));
  assert.ok(r.module.analyticsState().error);
  r.offline(false);
  await r.module.flushAnalytics();
  assert.equal(r.enabled(), false);
  assert.equal(r.module.analyticsState().error, "");
});
test("account switch during opt-out read cannot revoke B", async () => {
  const s = storage(),
    r = runtime(s);
  await r.module.connectAnalytics("A");
  const get = s.getItem;
  let finish;
  s.getItem = (k) =>
    k.endsWith("optout.A")
      ? new Promise((resolve) => {
          finish = resolve;
        })
      : get(k);
  const pending = r.module.flushAnalytics();
  await tick();
  await r.module.connectAnalytics("B");
  finish("1");
  await pending;
  assert.equal(r.module.analyticsState().enabled, true);
  assert.ok(!r.calls.some((c) => c.options.method === "PATCH"));
});
test("late 403 from an older consent generation cannot disable same UID", async () => {
  let reject;
  const r = runtime(storage(), (p, o, ApiError) => {
    if (p.endsWith("events"))
      return new Promise((resolve, fail) => {
        reject = () => fail(new ApiError(403));
      });
  });
  await r.module.connectAnalytics("A");
  const pending = r.module.flushAnalytics();
  await tick();
  await r.module.setAnalyticsConsent(true);
  reject();
  await pending;
  assert.equal(r.module.analyticsState().enabled, true);
});
test("400 isolates one rejected event and delivers all valid siblings without infinite retries", async () => {
  const delivered = [];
  const r = runtime(storage(), (p, o, ApiError) => {
    if (!p.endsWith("events")) return;
    const events = o.body.events;
    if (events.some((e) => e.name === "checkin_hecho")) throw new ApiError(400);
    delivered.push(...events);
    return { acceptedIds: events.map((e) => e.eventId) };
  });
  await r.module.connectAnalytics("A");
  r.module.track("checkin_hecho", { desafio_id: challenge });
  r.module.track("ranking_consultado", { desafio_id: challenge });
  await r.module.flushAnalytics();
  const count = r.calls.length;
  await r.module.flushAnalytics();
  assert.equal(r.calls.filter((c) => c.p.endsWith("events")).length, 5);
  assert.ok(delivered.some((e) => e.name === "ranking_consultado"));
  assert.equal(r.calls.length, count);
});
test("two Web instances cannot overwrite pending events", async () => {
  const s = storage();
  let held = false;
  const environment = {
    window: {},
    navigator: {
      locks: {
        request: async (name, options, callback) => {
          const lock = held ? null : {};
          if (lock) held = true;
          return callback(lock);
        },
      },
    },
  };
  const a = runtime(s, undefined, environment),
    b = runtime(s, undefined, environment);
  await a.module.connectAnalytics("A");
  await tick();
  const before = s.data.get("rachas.analytics.v1.A");
  await b.module.connectAnalytics("A");
  b.module.track("checkin_hecho", { desafio_id: challenge });
  await b.module.flushAnalytics();
  assert.equal(b.module.analyticsState().enabled, false);
  assert.equal(s.data.get("rachas.analytics.v1.A"), before);
  assert.equal(b.calls.length, 0);
});

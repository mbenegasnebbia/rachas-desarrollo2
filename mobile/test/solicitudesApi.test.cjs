/* global __dirname */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const { solicitud } = require("./helpers/ui.cjs");
function api(responder = () => solicitud) {
  const calls = [];
  const exports = {};
  const codigo = ts.transpileModule(
    fs.readFileSync(path.join(__dirname, "../src/api/solicitudes.ts"), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  new Function("exports", "require", codigo)(exports, (name) => {
    assert.equal(name, "./client"); // No Analytics, auth bypass or storage dependency.
    return {
      request: async (...args) => {
        calls.push(args);
        return responder(...args);
      },
    };
  });
  return { api: exports, calls };
}
test("request/admin API uses the real routes, bodies, pagination and expected Firebase UID", async () => {
  const h = api();
  assert.equal(await h.api.solicitarAcceso(" abc123 ", "uid-A"), solicitud);
  await h.api.listarSolicitudesPropias(3, "uid-A");
  await h.api.cancelarSolicitud("s1", "uid-A");
  await h.api.listarCreados(2, "uid-A");
  await h.api.listarSolicitudesRecibidas("d1", 2, 1, "uid-A");
  await h.api.resolverSolicitud("d1", "s1", "aprobar", "uid-A");
  await h.api.resolverSolicitud("d1", "s1", "rechazar", "uid-A");
  await h.api.listarParticipaciones("p1", "uid-A");
  assert.deepEqual(h.calls, [
    [
      "/solicitudes",
      { method: "POST", body: { codigo: "ABC123" }, expectedUid: "uid-A" },
    ],
    ["/solicitudes?pagina=3&limite=50", { expectedUid: "uid-A" }],
    ["/solicitudes/s1/cancelar", { method: "PATCH", expectedUid: "uid-A" }],
    ["/desafios/creados?pagina=2&limite=10", { expectedUid: "uid-A" }],
    ["/desafios/d1/solicitudes?pagina=2&limite=1", { expectedUid: "uid-A" }],
    [
      "/desafios/d1/solicitudes/s1/aprobar",
      { method: "PATCH", expectedUid: "uid-A" },
    ],
    [
      "/desafios/d1/solicitudes/s1/rechazar",
      { method: "PATCH", expectedUid: "uid-A" },
    ],
    ["/personas/p1/desafios", { expectedUid: "uid-A" }],
  ]);
  assert.ok(h.calls.every(([url]) => !url.includes("/unirse/")));
});
test("own requests traverse all pages and deduplicate: pending entries can follow resolved history", async () => {
  const h = api((url) => ({
    items: url.includes("pagina=1")
      ? [{ ...solicitud, id: "resuelta", estado: "REJECTED" }]
      : [
          { ...solicitud, id: "pendiente" },
          { ...solicitud, id: "resuelta", estado: "REJECTED" },
        ],
    total: 2,
    paginas: 2,
    pagina: url.includes("pagina=1") ? 1 : 2,
    limite: 50,
  }));
  const all = await h.api.listarTodasSolicitudesPropias("uid-A");
  assert.equal(all.length, 2);
  assert.deepEqual(
    all.filter((s) => s.estado === "PENDING").map((s) => s.id),
    ["pendiente"],
  );
  assert.equal(h.calls.length, 2);
  assert.ok(h.calls.every(([, options]) => options.expectedUid === "uid-A"));
});
test("failure on a later page rejects instead of showing an incomplete pending list", async () => {
  const h = api((url) => {
    if (url.includes("pagina=2")) throw Error("offline");
    return { items: [solicitud], paginas: 2 };
  });
  await assert.rejects(h.api.listarTodasSolicitudesPropias("uid-A"), /offline/);
});
test("v2 adapter preserves request states and nested identities", () => {
  const { loadVersion } = require("./versionLoader.cjs");
  assert.deepEqual(loadVersion().fromV2(solicitud), solicitud);
});

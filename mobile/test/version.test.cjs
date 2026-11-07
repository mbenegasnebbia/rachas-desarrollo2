/* global __dirname */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const { loadVersion } = require("./versionLoader.cjs");
test("version headers come from the application, not Expo Go", () => {
  assert.deepEqual(loadVersion().appHeaders(), {
    "x-app-version": "1.1.0",
    "x-platform": "web",
  });
});
test("wire adapter preserves nested totals and dates in the screen model", () => {
  const api = loadVersion();
  assert.deepEqual(api.toV2({ fechaFin: "2026-11-20" }), {
    finalizaEn: "2026-11-20",
  });
  assert.deepEqual(
    api.fromV2({
      items: [
        {
          finalizaEn: "2026-11-20",
          puntos: { total: 35, bonusPorRacha: 5 },
          estado: "PAUSADO",
        },
      ],
    }),
    { items: [{ fechaFin: "2026-11-20", puntos: 35, estado: "PAUSADO" }] },
  );
});
test("mandatory/recommended comparisons and safe 426 subscriptions", () => {
  const api = loadVersion();
  assert.equal(api.compareVersions("1.10.0", "1.9.0"), 1);
  assert.equal(api.compareVersions("1.1.0", "1.2.0"), -1);
  assert.equal(api.compareVersions("1.1.0", "1.1.0"), 0);
  const policy = {
    minimumVersion: "1.2.0",
    recommendedVersion: "1.3.0",
    updateUrl: null,
    instructions: "Actualizar",
  };
  let seen = 0;
  const stop = api.onUpgrade(() => seen++);
  api.reportUpgrade({ ...policy, updateUrl: "javascript:invalid" });
  assert.equal(seen, 0);
  api.reportUpgrade(policy);
  stop();
  api.reportUpgrade(policy);
  assert.equal(seen, 1);
});
test("future challenge states render a generic state instead of enabling actions", () => {
  const compiled = ts.transpileModule(
    fs.readFileSync(path.join(__dirname, "../src/utils/fechas.ts"), "utf8"),
    {
      compilerOptions: { module: ts.ModuleKind.CommonJS },
    },
  ).outputText;
  const exports = {};
  new Function("exports", compiled)(exports);
  assert.equal(exports.estadoDe({ estado: "FUTURO" }), "DESCONOCIDO");
  assert.equal(exports.estadoDe({ estado: "PAUSADO" }), "PAUSADO");
});

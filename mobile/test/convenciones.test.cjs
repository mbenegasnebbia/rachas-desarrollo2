/* global __dirname */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const raiz = path.resolve(__dirname, "..");
function archivos(carpeta) {
  return fs.readdirSync(carpeta, { withFileTypes: true }).flatMap((entrada) => {
    const ruta = path.join(carpeta, entrada.name);
    return entrada.isDirectory() ? archivos(ruta) : [ruta];
  });
}

test("source, tests and own assets use camelCase, preserving Router and platform suffixes", () => {
  for (const carpeta of ["src", "test", "assets"]) {
    for (const ruta of archivos(path.join(raiz, carpeta))) {
      const nombre = path.basename(ruta);
      if (ruta.includes(path.join("src", "app") + path.sep)) continue;
      assert.match(nombre, /^[a-z][a-zA-Z0-9]*(?:\.(?:web|test))?\.(?:ts|tsx|cjs|md|png)$/, ruta);
    }
  }
});

test("local imports and exports resolve with exact casing, including on Windows", () => {
  function existeExacto(ruta) {
    const partes = path.relative(raiz, ruta).split(path.sep);
    let actual = raiz;
    for (const parte of partes) {
      if (!fs.existsSync(actual) || !fs.statSync(actual).isDirectory()) return false;
      if (!fs.readdirSync(actual).includes(parte)) return false;
      actual = path.join(actual, parte);
    }
    return fs.statSync(actual).isFile();
  }
  for (const ruta of archivos(path.join(raiz, "src"))) {
    if (!/\.tsx?$/.test(ruta)) continue;
    const fuente = ts.createSourceFile(ruta, fs.readFileSync(ruta, "utf8"), ts.ScriptTarget.Latest, true);
    for (const nodo of fuente.statements) {
      if (!ts.isImportDeclaration(nodo) && !ts.isExportDeclaration(nodo)) continue;
      const spec = nodo.moduleSpecifier?.text;
      if (!spec || (!spec.startsWith("@/") && !spec.startsWith("."))) continue;
      const destino = spec.startsWith("@/")
        ? path.join(raiz, "src", spec.slice(2))
        : path.resolve(path.dirname(ruta), spec);
      assert.ok(
        [".ts", ".tsx", ".web.ts", ".web.tsx", "/index.ts", "/index.tsx"].some(
          (extension) => existeExacto(destino + extension),
        ),
        path.relative(raiz, ruta) + ": " + spec,
      );
      if (ruta.includes(path.join("components", "ui") + path.sep) || ruta === path.join(raiz, "src/components/ui.tsx")) {
        assert.ok(!destino.includes(path.join("components", "desafios")), spec);
      }
    }
  }
});

test("generic components keep palette literals centralized", () => {
  for (const ruta of archivos(path.join(raiz, "src/components/ui"))) {
    assert.doesNotMatch(fs.readFileSync(ruta, "utf8"), /#[0-9a-f]{3,8}\b/i, ruta);
  }
});

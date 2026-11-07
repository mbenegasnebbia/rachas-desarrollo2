/* global __dirname */
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
function loadVersion() {
  const compiled = ts.transpileModule(
    fs.readFileSync(path.join(__dirname, "../src/api/version.ts"), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    },
  ).outputText;
  const exports = {};
  new Function("exports", "require", compiled)(exports, (name) =>
    name === "expo-constants"
      ? { default: { expoConfig: { version: "1.1.0" } }, __esModule: true }
      : { Platform: { OS: "web" } },
  );
  return exports;
}
module.exports = { loadVersion };

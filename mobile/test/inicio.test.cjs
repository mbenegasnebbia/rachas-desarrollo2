/* global __dirname */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

// Shallow native doubles: verify data, actions and semantic styles without Firebase or HTTP.
function harness({
  datos = [],
  cargando = false,
  error = "",
  ocupado = false,
  actionError = "",
  fuentes = true,
} = {}) {
  const calls = [],
    cache = new Map();
  const refresh = async () => {
    calls.push(["refresh"]);
  };
  const react = {
    useCallback: (fn) => fn,
    useState: (initial) => [initial, () => {}],
    createContext: (value) => ({ Provider: "Provider", value }),
    useContext: () => fuentes,
  };
  const native = {
    useWindowDimensions: () => ({ width: 440, fontScale: 1 }),
    StyleSheet: { create: (x) => x },
    Platform: { OS: "web" },
  };
  for (const name of [
    "View",
    "Text",
    "Pressable",
    "FlatList",
    "ActivityIndicator",
    "KeyboardAvoidingView",
    "RefreshControl",
    "ScrollView",
    "TextInput",
  ])
    native[name] = name;
  const mocks = {
    react,
    "react-native": native,
    "react-native-safe-area-context": { SafeAreaView: "SafeAreaView" },
    "react-native-svg": { __esModule: true, default: "Svg", Path: "Path" },
    "react/jsx-runtime": require("react/jsx-runtime"),
    "expo-font": { useFonts: () => [fuentes, null] },
    "expo-router": {
      router: {
        push: (route) => calls.push(["push", route]),
        navigate: (route) => calls.push(["navigate", route]),
      },
    },
    "@/session/sesion": {
      useSesion: () => ({
        persona: {
          nombre: "Ana",
          zonaHoraria: "America/Argentina/Buenos_Aires",
        },
      }),
    },
    "@/api/personas": {
      resumen: () => {
        throw Error("No real HTTP allowed");
      },
    },
    "@/api/checkins": {
      checkin: async (...args) => {
        calls.push(["checkin", ...args]);
      },
    },
    "@/utils/fechas": {
      hoy: (zona) => {
        calls.push(["timezone", zona]);
        return "2026-11-06";
      },
      fechaVisible: (x) => x,
    },
    "@/hooks/useCarga": {
      useCarga: () => ({ datos, cargando, error, cargar: refresh }),
      useAccion: () => ({
        ocupado,
        error: actionError,
        ejecutar: (fn) => fn(),
      }),
    },
  };
  function load(name, parent = path.join(__dirname, "../src")) {
    if (name in mocks) return mocks[name];
    if (name.startsWith("@expo-google-fonts/")) return {};
    let file = name.startsWith("@/")
      ? path.join(__dirname, "../src", name.slice(2))
      : path.resolve(parent, name);
    if (!path.extname(file))
      file += fs.existsSync(file + ".tsx")
        ? ".tsx"
        : fs.existsSync(file + ".ts")
          ? ".ts"
          : "/index.ts";
    if (cache.has(file)) return cache.get(file);
    const js = ts.transpileModule(fs.readFileSync(file, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText;
    const result = {};
    cache.set(file, result);
    new Function("exports", "require", js)(result, (dep) =>
      load(dep, path.dirname(file)),
    );
    return result;
  }
  const root = load("@/app/(tabs)/index.tsx").default();
  return { list: root.props.children.props, calls, load, root };
}
function expand(node) {
  if (node == null || typeof node === "boolean") return null;
  if (Array.isArray(node)) return node.map(expand);
  if (typeof node !== "object") return node;
  if (typeof node.type === "function") return expand(node.type(node.props));
  return {
    ...node,
    props: { ...node.props, children: expand(node.props.children) },
  };
}
function nodes(node) {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  return [node, ...nodes(node.props.children)];
}
function text(node) {
  if (node == null || typeof node === "boolean") return "";
  if (Array.isArray(node)) return node.map(text).join("");
  return typeof node === "object" ? text(node.props.children) : String(node);
}
const sample = (estado = "ACTIVO", checkinHoy = false) => ({
  desafio: {
    id: "desafio-1",
    nombre: "Caminar",
    categoria: "SALUD",
    fechaInicio: "2026-11-01",
    fechaFin: "2026-11-20",
  },
  estado,
  checkinHoy,
  rachaActual: 4,
  puntos: 37,
  posicion: 2,
});

test("Inicio preserves backend metrics, route and check-in date/refresh ordering", async () => {
  const r = sample(),
    h = harness({ datos: [r] });
  assert.equal(h.list.data[0], r);
  const row = expand(h.list.renderItem({ item: r }));
  assert.match(text(row), /4/);
  assert.match(text(row), /37/);
  assert.match(text(row), /2/);
  const actions = nodes(row).filter((n) => n.type === "Pressable");
  assert.equal(actions[0].props.disabled, false);
  await actions[0].props.onPress();
  // The native callback is fire-and-forget, allow its refresh continuation.
  await Promise.resolve();
  assert.deepEqual(h.calls.slice(0, 3), [
    ["timezone", "America/Argentina/Buenos_Aires"],
    ["checkin", "desafio-1", { fecha: "2026-11-06" }],
    ["refresh"],
  ]);
  actions[1].props.onPress();
  assert.deepEqual(h.calls.at(-1), [
    "push",
    { pathname: "/desafio/[id]", params: { id: "desafio-1" } },
  ]);
});
test("completed and scheduled are informational; busy actions remain disabled", () => {
  for (const r of [sample("PROGRAMADO"), sample("ACTIVO", true)]) {
    const h = harness({ datos: [r] });
    const row = expand(h.list.renderItem({ item: r }));
    const actions = nodes(row).filter((n) => n.type === "Pressable");
    assert.equal(actions.length, 1);
    assert.equal(actions[0].props.disabled, false);
  }
  const h = harness({ datos: [sample()], ocupado: true });
  const row = expand(h.list.renderItem({ item: sample() }));
  assert.equal(
    nodes(row).find((n) => n.type === "Pressable").props.disabled,
    true,
  );
});

test("loading, empty, request error, action error and retry remain distinguishable", () => {
  assert.ok(harness().list.ListEmptyComponent);
  const loading = harness({ cargando: true });
  assert.equal(loading.list.ListEmptyComponent, undefined);
  assert.ok(
    nodes(expand(loading.list.ListHeaderComponent)).some(
      (n) => n.type === "ActivityIndicator",
    ),
  );
  const failed = harness({ error: "offline", actionError: "check-in failed" });
  assert.equal(failed.list.ListEmptyComponent, undefined);
  const header = expand(failed.list.ListHeaderComponent);
  assert.match(text(header), /offline/);
  assert.match(text(header), /check-in failed/);
  nodes(header)
    .find((n) => n.type === "Pressable")
    .props.onPress();
  assert.deepEqual(failed.calls, [["refresh"]]);
});
test("font fallback preserves scaling and switches to bundled face when loaded", () => {
  for (const fuentes of [false, true]) {
    const h = harness({ fuentes });
    const { Texto } = h.load("@/components/ui/texto");
    const result = Texto({ variante: "titulo", children: "Hola" });
    assert.notEqual(result.props.allowFontScaling, false);
    assert.equal(
      result.props.style[1].fontFamily,
      fuentes ? "PlusJakartaSans_800ExtraBold" : undefined,
    );
  }
});
function luminance(hex) {
  const rgb = hex
    .slice(1)
    .match(/../g)
    .map((x) => parseInt(x, 16) / 255)
    .map((x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}
test("both palettes and modes provide readable semantic text/fill pairs", () => {
  const { crearTema } = harness().load("@/theme");
  for (const palette of ["neonClub", "lilacPop"])
    for (const mode of ["claro", "oscuro"]) {
      const c = crearTema(palette, mode).colores;
      for (const [fg, bg] of [
        ["texto", "fondo"],
        ["textoSecundario", "superficie"],
        ["sobrePrimario", "primario"],
        ["sobreSecundario", "secundario"],
        ["sobreAcento", "acento"],
        ["exito", "fondoExito"],
        ["advertencia", "fondoAdvertencia"],
        ["error", "fondoError"],
        ["sobreDestructivo", "destructivo"],
      ]) {
        const a = luminance(c[fg]),
          b = luminance(c[bg]);
        assert.ok(
          (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) >= 4.5,
          `${palette}/${mode}: ${fg}/${bg}`,
        );
      }
    }
});

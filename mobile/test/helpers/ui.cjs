/* global __dirname */
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const jsx = require("react/jsx-runtime");
const persona = {
  id: "p1",
  nombre: "Ana",
  alias: "ana",
  zonaHoraria: "America/Argentina/Buenos_Aires",
  perfilCompleto: true,
};
const desafio = {
  id: "d1",
  nombre: "Caminar",
  descripcion: "Un paso cada dia",
  categoria: "SALUD",
  fechaInicio: "2026-11-06",
  fechaFin: "2026-11-20",
  maxParticipantes: 10,
  participantes: ["p1"],
  exParticipantes: [],
  creador: "p1",
  codigoInvitacion: "ABC123",
  cancelado: false,
};
const posicion = {
  personaId: "p1",
  alias: "ana",
  nombre: "Ana",
  puntos: 37,
  posicion: 2,
  rachaActual: 4,
  mejorRacha: 6,
  checkinHoy: false,
};
const detail = {
  desafio,
  personas: [persona],
  tabla: { items: [posicion], ganador: null },
  historia: { items: [], paginas: 0 },
};
const solicitud = {
  id: "s1",
  desafio: {
    id: desafio.id,
    nombre: desafio.nombre,
    categoria: desafio.categoria,
  },
  solicitante: { id: persona.id, nombre: persona.nombre, alias: persona.alias },
  estado: "PENDING",
  solicitadaEn: "2026-11-06T12:00:00.000Z",
  resueltaEn: null,
  resueltaPor: null,
};
class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
function harness({
  datos = [],
  cargas = [],
  apiSolicitudes = {},
  apiPersonas = {},
  accionReal = false,
  cargaReal = false,
  focoEstable = false,
  states = [],
  session = {},
  analytics = {},
  versionGate = true,
  cargando = false,
  error = "",
  platform = "web",
  fonts = true,
  width = 440,
  fontScale = 1,
  bottomInset = 0,
} = {}) {
  const consultas = [];
  const effects = [];
  const focusEffects = [];
  const refs = [];
  const callbacks = [];
  const focosAplicados = [];
  let callbackCursor = 0;
  let inicioFocos = 0;
  let refCursor = 0,
    cargaCursor = 0;
  const calls = [],
    pending = [],
    cache = new Map(),
    values = [...states];
  let cursor = 0;
  const refresh = () => {
    calls.push(["refresh"]);
    return Promise.resolve();
  };
  const record =
    (name, result) =>
    (...args) => {
      calls.push([name, ...args]);
      return Promise.resolve(result);
    };
  const router = {
    push: (r) => calls.push(["push", r]),
    replace: (r) => calls.push(["replace", r]),
    navigate: (r) => calls.push(["navigate", r]),
  };
  const makeNav = (type) =>
    Object.assign((props) => jsx.jsx(type, props), {
      Screen: type + ".Screen",
    });
  const react = {
    useEffect: (fn) => effects.push(fn),
    useCallback: (fn, deps) => {
      if (!focoEstable) return fn;
      const index = callbackCursor++;
      const anterior = callbacks[index];
      if (!anterior || deps.some((v, i) => !Object.is(v, anterior.deps[i])))
        callbacks[index] = { fn, deps };
      return callbacks[index].fn;
    },
    useMemo: (fn) => fn(),
    useRef: (current) => {
      const index = refCursor++;
      if (!(index in refs)) refs[index] = { current };
      return refs[index];
    },
    createContext: (value) => ({ Provider: "Provider", value }),
    useContext: () => fonts,
    useState: (initial) => {
      const index = cursor++;
      if (!(index in values))
        values[index] = typeof initial === "function" ? initial() : initial;
      return [
        values[index],
        (next) => {
          values[index] =
            typeof next === "function" ? next(values[index]) : next;
        },
      ];
    },
  };
  const native = {
    Platform: { OS: platform },
    useWindowDimensions: () => ({ width, height: 900, fontScale, scale: 1 }),
    StyleSheet: { create: (x) => x },
    Share: { share: record("share", {}) },
  };
  for (const n of [
    "Switch",
    "View",
    "Text",
    "Pressable",
    "FlatList",
    "ScrollView",
    "RefreshControl",
    "KeyboardAvoidingView",
    "TextInput",
    "Modal",
    "ActivityIndicator",
  ])
    native[n] = n;
  const mocks = {
    react,
    "react/jsx-runtime": jsx,
    "react-native": native,
    "react-native-svg": { __esModule: true, default: "Svg", Path: "Path" },
    "react-native-safe-area-context": {
      SafeAreaView: "SafeAreaView",
      useSafeAreaInsets: () => ({
        top: 0,
        right: 0,
        left: 0,
        bottom: bottomInset,
      }),
    },
    "expo-font": { useFonts: () => [fonts, null] },
    "expo-status-bar": { StatusBar: "StatusBar" },
    "expo-router": {
      router,
      useFocusEffect: (fn) => focusEffects.push(fn),
      Redirect: "Redirect",
      Stack: makeNav("Stack"),
      Tabs: makeNav("Tabs"),
      useLocalSearchParams: () => ({ id: "d1" }),
    },
    "@/analytics/analyticsProvider": {
      AnalyticsProvider: "AnalyticsProvider",
      useAnalytics: () => ({
        enabled: false,
        ready: true,
        busy: false,
        error: "",
        setConsent: record("consent", undefined),
        ...analytics,
      }),
    },
    "@/analytics/runtime": {
      analyticsContext: () => 1,
      track: record("track", undefined),
    },
    "@/api/client": { API_URL: "https://example.invalid", ApiError },
    "@/api/version": require("../versionLoader.cjs").loadVersion(),
    ...(versionGate
      ? { "@/components/versionGate": { VersionGate: "VersionGate" } }
      : {}),
    "@/session/sesion": {
      SesionProvider: "SesionProvider",
      useSesion: () => ({
        persona,
        usuarioFirebase: { uid: "fake" },
        cargando: false,
        error: "",
        reintentar: refresh,
        guardar: record("guardar", persona),
        ingresar: record("ingresar", null),
        ...session,
      }),
    },
    "@/hooks/useCarga": {
      useCarga: (consulta, contexto) => {
        consultas.push(consulta);
        if (cargaReal)
          return load("./hooks/useCarga.ts").useCarga(consulta, contexto);
        const index = cargaCursor++;
        return {
          datos: index === 0 ? datos : [],
          cargando,
          error,
          cargar: refresh,
          ...cargas[index],
        };
      },
      useAccion: () =>
        accionReal
          ? load("./hooks/useCarga.ts").useAccion()
          : {
              ocupado: false,
              error: "",
              limpiarError() {},
              ejecutar: (fn) => {
                const promise = Promise.resolve().then(fn);
                pending.push(promise);
                return promise.catch(() => {});
              },
            },
    },
    "@/auth/session": { mensajeErrorAuth: (e) => e.message },
    "@/hooks/useDesafioRealtime": {
      useDesafioRealtime: (...args) => {
        calls.push(["realtime", ...args.slice(0, 3)]);
        return {
          estado: "Conectado",
          error: "",
          reconectar() {},
          enviar: record("aliento", null),
          alientos: [],
          enEspera: false,
          enviando: false,
        };
      },
    },
    "@/api/desafios": {
      listarDesafios: record("listar", { items: [desafio], paginas: 1 }),
      crearDesafio: record("crear", desafio),
      obtenerDesafio: record("obtenerDesafio", desafio),
      participantes: record("participantes", [persona]),
      ranking: record("ranking", detail.tabla),
      abandonar: record("abandonar", null),
      cancelar: record("cancelar", null),
    },
    "@/api/solicitudes": {
      solicitarAcceso: record("solicitar", solicitud),
      listarParticipaciones: record("participaciones", []),
      listarTodasSolicitudesPropias: record("solicitudesPropias", []),
      cancelarSolicitud: record("cancelarSolicitud", {
        ...solicitud,
        estado: "CANCELLED",
      }),
      listarCreados: record("creados", {
        items: [desafio],
        total: 1,
        pagina: 1,
        limite: 10,
        paginas: 1,
      }),
      listarSolicitudesRecibidas: record("recibidas", {
        items: [solicitud],
        total: 1,
        pagina: 1,
        limite: 10,
        paginas: 1,
      }),
      resolverSolicitud: async (...args) => {
        calls.push(["resolver", ...args]);
        return {
          ...solicitud,
          estado: args[2] === "aprobar" ? "APPROVED" : "REJECTED",
        };
      },
      ...apiSolicitudes,
    },
    "@/api/personas": {
      resumen: record("resumen", []),
      obtenerPersona: record("obtenerPersona", persona),
      resultados: record("resultados", []),
      actualizarPersona: record("actualizarPersona", persona),
      completarPerfil: record("completarPerfil", persona),
      ...apiPersonas,
    },
    "@/api/checkins": {
      checkin: record("checkin", {}),
      deshacer: record("deshacer", {}),
      historial: record("historial", { items: [], paginas: 0 }),
    },
  };
  function load(name, parent = path.join(__dirname, "../../src")) {
    if (name in mocks) return mocks[name];
    if (name.startsWith("@expo-google-fonts/")) return {};
    let file = name.startsWith("@/")
      ? path.join(__dirname, "../../src", name.slice(2))
      : path.resolve(parent, name);
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory())
      file += fs.existsSync(file + ".tsx")
        ? ".tsx"
        : fs.existsSync(file + ".ts")
          ? ".ts"
          : "/index.ts";
    if (file.endsWith(path.join("utils", "fechas.ts")) && cache.has("fechas"))
      return cache.get("fechas");
    if (cache.has(file)) return cache.get(file);
    const result = {};
    cache.set(file, result);
    const js = ts.transpileModule(fs.readFileSync(file, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText;
    new Function("exports", "require", js)(result, (dep) =>
      load(dep, path.dirname(file)),
    );
    if (file.endsWith(path.join("utils", "fechas.ts"))) {
      result.hoy = () => "2026-11-06";
      result.estadoDe = (d) =>
        d.cancelado
          ? "CANCELADO"
          : d.fechaInicio > "2026-11-06"
            ? "PROGRAMADO"
            : d.fechaFin < "2026-11-06"
              ? "FINALIZADO"
              : "ACTIVO";
      cache.set("fechas", result);
    }
    return result;
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
  const render = (name, props = {}, named) => {
    cursor = 0;
    refCursor = 0;
    cargaCursor = 0;
    callbackCursor = 0;
    inicioFocos = focusEffects.length;
    const module = load(name);
    return expand((named ? module[named] : module.default)(props));
  };
  function aplicarFoco() {
    focusEffects.slice(inicioFocos).forEach((fn, index) => {
      if (focosAplicados[index]?.fn === fn) return;
      focosAplicados[index]?.limpiar?.();
      focosAplicados[index] = { fn, limpiar: fn() };
    });
  }
  return {
    aplicarFoco,
    load,
    render,
    calls,
    pending,
    expand,
    values,
    consultas,
    effects,
    focusEffects,
    cargas,
  };
}
function nodes(node) {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  return [node, ...nodes(node.props?.children)];
}
function text(node) {
  if (node == null || typeof node === "boolean") return "";
  if (Array.isArray(node)) return node.map(text).join("");
  return typeof node === "object" ? text(node.props.children) : String(node);
}
function action(tree, title) {
  return nodes(tree).find((n) => n.type === "Pressable" && text(n) === title);
}
module.exports = {
  harness,
  nodes,
  text,
  action,
  persona,
  desafio,
  posicion,
  detail,
  solicitud,
};

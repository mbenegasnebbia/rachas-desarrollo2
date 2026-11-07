const test = require("node:test");
const assert = require("node:assert/strict");
const {
  harness,
  nodes,
  text,
  action,
  persona,
  detail,
} = require("./helpers/ui.cjs");

test("Crear preserves validated payload and navigation; invalid form never calls API", async () => {
  const h = harness({
    states: ["Caminar", "", "SALUD", "2026-11-06", "2026-11-20", "10"],
  });
  const tree = h.render("@/app/(tabs)/crear.tsx");
  action(tree, "Crear desaf\u00edo").props.onPress();
  await Promise.all(h.pending);
  assert.deepEqual(h.calls[0], [
    "crear",
    {
      nombre: "Caminar",
      descripcion: "",
      categoria: "SALUD",
      fechaInicio: "2026-11-06",
      fechaFin: "2026-11-20",
      maxParticipantes: 10,
    },
  ]);
  assert.deepEqual(h.calls[1], [
    "push",
    { pathname: "/desafio/[id]", params: { id: "d1" } },
  ]);
  const bad = harness();
  action(
    bad.render("@/app/(tabs)/crear.tsx"),
    "Crear desaf\u00edo",
  ).props.onPress();
  await assert.rejects(bad.pending[0]);
  assert.equal(bad.calls.length, 0);
});

test("code entry keeps normalization and rejects wrong challenge code before API", async () => {
  const h = harness({ states: [" abc123 "] });
  const tree = h.render(
    "@/components/desafios/solicitarAccesoFormulario.tsx",
    {
      codigoEsperado: "ABC123",
      alSolicitar: (d) => h.calls.push(["requested", d.id]),
    },
    "SolicitarAccesoFormulario",
  );
  action(tree, "Solicitar acceso").props.onPress();
  await Promise.all(h.pending);
  assert.deepEqual(h.calls, [
    ["solicitar", "ABC123", "fake"],
    ["requested", "s1"],
  ]);
  const bad = harness({ states: ["ZZZZZZ"] });
  action(
    bad.render(
      "@/components/desafios/solicitarAccesoFormulario.tsx",
      { codigoEsperado: "ABC123", alSolicitar() {} },
      "SolicitarAccesoFormulario",
    ),
    "Solicitar acceso",
  ).props.onPress();
  await assert.rejects(bad.pending[0]);
  assert.equal(bad.calls.length, 0);
});

test("Perfil preserves edit and sign-out contracts", async () => {
  const h = harness({
    datos: { persona, resultados: [] },
    states: ["Ana nueva", persona.zonaHoraria, ""],
  });
  const tree = h.render("@/app/(tabs)/perfil.tsx");
  action(tree, "Guardar cambios").props.onPress();
  await Promise.all(h.pending);
  assert.deepEqual(h.calls[0], [
    "actualizarPersona",
    "p1",
    { nombre: "Ana nueva", zonaHoraria: persona.zonaHoraria },
  ]);
  action(tree, "Cerrar sesi\u00f3n").props.onPress();
  await Promise.all(h.pending);
  assert.ok(h.calls.some((c) => c[0] === "guardar" && c[1] === null));
  assert.deepEqual(h.calls.at(-1), ["replace", "/ingreso"]);
});

test("Ingreso keeps Firebase entry, initial Persona payload and completed-profile redirect", async () => {
  const login = harness({ session: { persona: null, usuarioFirebase: null } });
  action(
    login.render("@/app/ingreso.tsx"),
    "Continuar con Google",
  ).props.onPress();
  await Promise.all(login.pending);
  assert.deepEqual(login.calls, [["ingresar"]]);
  const setup = harness({
    session: { persona: { ...persona, perfilCompleto: false } },
    states: ["ana", "Ana", persona.zonaHoraria],
  });
  action(
    setup.render("@/app/ingreso.tsx"),
    "Guardar perfil y continuar",
  ).props.onPress();
  await Promise.all(setup.pending);
  assert.deepEqual(setup.calls[0], [
    "completarPerfil",
    { alias: "ana", nombre: "Ana", zonaHoraria: persona.zonaHoraria },
  ]);
  assert.equal(harness().render("@/app/ingreso.tsx").type, "Redirect");
});

test("Detalle retains realtime subscription identity, metrics and one virtualized scroller", () => {
  const h = harness({ datos: detail });
  const tree = h.render("@/app/desafio/[id].tsx");
  assert.ok(
    h.calls.some(
      (c) =>
        c[0] === "realtime" && c[1] === "d1" && c[2] === "p1" && c[3] === true,
    ),
  );
  const list = nodes(tree).find((n) => n.type === "FlatList");
  assert.deepEqual(list.props.data, []);
  const header = h.expand(list.props.ListHeaderComponent);
  assert.match(text(header), /37/);
  assert.equal(nodes(tree).filter((n) => n.type === "ScrollView").length, 0);
});

test("vector fire uses the exact accent/dark-ink tokens and no emoji text", () => {
  const h = harness(),
    tema = h.load("@/theme").tema;
  const tree = h.render(
    "@/components/ui/iconoCircular",
    { icono: "fuego", tono: "acento" },
    "IconoCircular",
  );
  assert.equal(tree.props.style.backgroundColor, "#FF641F");
  const path = nodes(tree).find((n) => n.type === "Path");
  assert.equal(path.props.stroke, "#191B19");
  assert.equal(path.props.strokeWidth, tema.iconos.trazo);
  assert.ok(path.props.d.length > 20);
  assert.equal(
    nodes(tree).some((n) => n.type === "Text"),
    false,
  );
});

test("expandible sections expose state and toggle content without network", () => {
  const h = harness();
  let tree = h.render(
    "@/components/ui/seccionExpandible",
    { titulo: "Participantes", children: "Listado" },
    "SeccionExpandible",
  );
  assert.equal(text(tree).includes("Listado"), false);
  nodes(tree)
    .find((n) => n.type === "Pressable")
    .props.onPress();
  tree = h.render(
    "@/components/ui/seccionExpandible",
    { titulo: "Participantes", children: "Listado" },
    "SeccionExpandible",
  );
  assert.equal(
    nodes(tree).find((n) => n.type === "Pressable").props.accessibilityState
      .expanded,
    true,
  );
  assert.match(text(tree), /Listado/);
});

test("calendar keeps 42 accessible dates and controlled selection", () => {
  const h = harness({ states: [true, "2026-11"] });
  const tree = h.render(
    "@/components/ui/fechaSelector",
    {
      etiqueta: "Inicio",
      valor: "2026-11-06",
      cambiar: (d) => h.calls.push(["date", d]),
    },
    "FechaSelector",
  );
  const dates = nodes(tree).filter(
    (n) =>
      n.type === "Pressable" &&
      n.props.accessibilityState?.selected !== undefined,
  );
  assert.equal(dates.length, 42);
  dates[10].props.onPress();
  assert.match(h.calls[0][1], /^2026-\d{2}-\d{2}$/);
  assert.equal(h.values[0], false);
});

test("tabs keep all four routes, vector icons and non-overlay keyboard-aware layout", () => {
  const h = harness();
  const tree = h.render("@/app/(tabs)/_layout.tsx");
  assert.deepEqual(
    nodes(tree)
      .filter((n) => n.type === "Tabs.Screen")
      .map((n) => n.props.name),
    ["index", "explorar", "crear", "perfil"],
  );
  assert.equal(tree.props.screenOptions.headerShown, false);
  assert.equal(tree.props.screenOptions.tabBarHideOnKeyboard, true);
  assert.notEqual(tree.props.screenOptions.tabBarStyle.position, "absolute");
});

test("form containers preserve refresh, safe areas and iOS keyboard avoidance", () => {
  const h = harness({ platform: "ios" }),
    refresh = () => {};
  const tree = h.render(
    "@/components/ui/pantalla",
    { children: "Campos", refrescar: refresh, cargando: true },
    "Pantalla",
  );
  assert.equal(tree.type, "SafeAreaView");
  assert.equal(
    nodes(tree).find((n) => n.type === "KeyboardAvoidingView").props.behavior,
    "padding",
  );
  const scroll = nodes(tree).find((n) => n.type === "ScrollView");
  assert.equal(scroll.props.keyboardShouldPersistTaps, "handled");
  assert.equal(scroll.props.refreshControl.props.onRefresh, refresh);
});

test("Explorar filters keep parameters and reset pagination when selection changes", async () => {
  const h = harness({
    datos: { items: [], paginas: 4 },
    states: ["SALUD", "ACTIVO", 3],
  });
  const tree = h.render("@/app/(tabs)/explorar.tsx");
  await h.consultas[0]();
  assert.deepEqual(h.calls.at(-1), ["listar", 3, "ACTIVO", "SALUD"]);
  action(tree, "ESTUDIO").props.onPress();
  assert.equal(h.values[0], "ESTUDIO");
  assert.equal(h.values[2], 1);
});

test("destructive challenge action still requires confirmation and preserves API route", async () => {
  const h = harness({ datos: detail });
  let tree = h.render("@/app/desafio/[id].tsx");
  let list = nodes(tree).find((n) => n.type === "FlatList");
  let footer = h.expand(list.props.ListFooterComponent);
  action(footer, "Cancelar desaf\u00edo").props.onPress();
  assert.equal(
    h.calls.some((c) => c[0] === "cancelar"),
    false,
  );
  tree = h.render("@/app/desafio/[id].tsx");
  list = nodes(tree).find((n) => n.type === "FlatList");
  footer = h.expand(list.props.ListFooterComponent);
  action(footer, "Confirmar").props.onPress();
  await Promise.all(h.pending);
  assert.ok(h.calls.some((c) => c[0] === "cancelar" && c[1] === "d1"));
  assert.deepEqual(h.calls.at(-1), ["replace", "/(tabs)"]);
});

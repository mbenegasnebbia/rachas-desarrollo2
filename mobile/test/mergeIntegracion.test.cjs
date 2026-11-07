const test = require("node:test");
const assert = require("node:assert/strict");
const { harness, nodes, text, action, persona, desafio, posicion, detail } = require("./helpers/ui.cjs");

test("root preserves fonts, Analytics, version gate and session in that order", () => {
  for (const fonts of [false, true]) {
    const h = harness({ fonts });
    const root = h.render("@/app/_layout.tsx");
    assert.equal(root.type, "Provider");
    assert.equal(root.props.value, fonts);
    const analytics = root.props.children;
    assert.equal(analytics.type, "AnalyticsProvider");
    assert.equal(analytics.props.children.type, "VersionGate");
    assert.equal(analytics.props.children.props.children.type, "SesionProvider");
    const stack = nodes(root).find((n) => n.type === "Stack");
    assert.equal(stack.props.screenOptions.headerTitleStyle.fontFamily, fonts ? "PlusJakartaSans_600SemiBold" : undefined);
    const back = nodes(stack).find((n) => n.type === "Stack.Screen" && n.props.name === "desafio/[id]");
    assert.deepEqual(back.props.options, { title: "", headerBackTitle: "Volver" });
  }
});

test("redesigned Perfil never enables Analytics implicitly and retains opt-in/opt-out", () => {
  for (const enabled of [false, true]) {
    const h = harness({ datos: { persona, resultados: [] }, analytics: { enabled } });
    const tree = h.render("@/app/(tabs)/perfil.tsx");
    assert.match(text(tree), /Tus datos/);
    const control = nodes(tree).find((n) => n.type === "Switch");
    assert.equal(control.props.value, enabled);
    assert.equal(control.props.disabled, false);
    assert.deepEqual(h.calls, []);
    control.props.onValueChange(!enabled);
    assert.deepEqual(h.calls, [["consent", !enabled]]);
  }
  for (const analytics of [{ ready: false }, { busy: true }]) {
    const h = harness({ datos: { persona, resultados: [] }, analytics: { ...analytics, error: "pendiente de sincronizar" } });
    const tree = h.render("@/app/(tabs)/perfil.tsx");
    assert.equal(nodes(tree).find((n) => n.type === "Switch").props.disabled, true);
    assert.match(text(tree), /pendiente de sincronizar/);
  }
});

test("Inicio retains timezone-aware summary and check-in inside the redesigned list", async () => {
  const h = harness({
    session: { persona: { ...persona, zonaHoraria: "America/Lima" } },
    datos: [{ ...posicion, desafio, estado: "ACTIVO" }],
  });
  const tree = h.render("@/app/(tabs)/index.tsx");
  await h.consultas[0]();
  assert.deepEqual(h.calls.shift(), ["resumen", "America/Lima"]);
  const list = nodes(tree).find((n) => n.type === "FlatList");
  const row = h.expand(list.props.renderItem({ item: list.props.data[0] }));
  action(row, "Hacer check-in de hoy").props.onPress();
  await Promise.all(h.pending);
  assert.deepEqual(h.calls, [
    ["checkin", "d1", { fecha: "2026-11-06", zonaHoraria: "America/Lima" }],
    ["refresh"],
  ]);
  action(h.expand(list.props.ListFooterComponent), "Explorar desaf\u00edos").props.onPress();
  assert.deepEqual(h.calls.at(-1), ["navigate", "/(tabs)/explorar"]);
});

test("Detalle retains timezone, yesterday, note and numeric value with the new ranking layout", async () => {
  const h = harness({
    datos: detail,
    session: { persona: { ...persona, zonaHoraria: "America/Lima" } },
    states: [1, "AYER", "Nota privada", "2,5", ""],
  });
  const tree = h.render("@/app/desafio/[id].tsx");
  const list = nodes(tree).find((n) => n.type === "FlatList");
  assert.deepEqual(list.props.data, []);
  action(h.expand(list.props.ListHeaderComponent), "Guardar check-in").props.onPress();
  await Promise.all(h.pending);
  assert.ok(h.calls.some((c) => c[0] === "checkin"));
  assert.deepEqual(h.calls.find((c) => c[0] === "checkin"), [
    "checkin", "d1",
    { zonaHoraria: "America/Lima", fecha: "2026-11-05", nota: "Nota privada", valor: 2.5 },
  ]);
  assert.equal(h.calls.some((c) => c[0] === "track"), false);
});

test("mandatory update keeps content blocked and analytics notice requires confirmed opt-in", () => {
  const policy = { minimumVersion: "1.2.0", recommendedVersion: "1.3.0", updateUrl: null, instructions: "Actualizar" };
  for (const analytics of [
    { enabled: false, ready: true, busy: false },
    { enabled: true, ready: false, busy: false },
    { enabled: true, ready: true, busy: true },
    { enabled: true, ready: true, busy: false },
  ]) {
    const h = harness({ versionGate: false, analytics, states: [policy, "", false, "", false] });
    const tree = h.render("@/components/versionGate", { children: "CONTENIDO PRIVADO" }, "VersionGate");
    assert.doesNotMatch(text(tree), /CONTENIDO PRIVADO/);
    assert.ok(action(tree, "Actualizar"));
    h.effects.at(-1)();
    const tracked = h.calls.filter((c) => c[0] === "track");
    assert.equal(tracked.length, analytics.enabled && analytics.ready && !analytics.busy ? 1 : 0);
    if (tracked.length) assert.deepEqual(tracked[0], [
      "track", "aviso_actualizacion_mostrado", { tipo: "obligatoria", version_objetivo: "1.2.0" },
    ]);
  }
});

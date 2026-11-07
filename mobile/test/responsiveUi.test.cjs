const test = require("node:test");
const assert = require("node:assert/strict");
const {
  harness,
  nodes,
  text,
  action,
  persona,
  posicion,
  desafio,
  detail,
} = require("./helpers/ui.cjs");

test("the shared compact breakpoint applies to every typography role and keeps touch targets", () => {
  const { temaParaAncho } = harness().load("@/theme");
  for (const width of [320, 375, 376, 440, 768, 1440]) {
    const t = temaParaAncho(width);
    assert.equal(t.compacto, width <= 375);
    assert.equal(t.tipografia.pantallaTitulo.fontSize, width <= 375 ? 25 : 32);
    assert.equal(t.tipografia.desafioTitulo.fontSize, width <= 375 ? 20 : 24);
    assert.equal(t.tipografia.estadistica.fontSize, width <= 375 ? 26 : 32);
    assert.ok(t.medidas.altoBoton >= 44);
    assert.equal(t.medidas.toqueMinimo, 44);
    assert.equal(t.medidas.anchoContenido, 760);
  }
  assert.ok(
    temaParaAncho(320, 1.8).medidas.baseEstadistica >
      temaParaAncho(320).medidas.baseEstadistica,
  );
});

test("first visible name handles whitespace, missing names and preserves the stored name", () => {
  const { primerNombreVisible } = harness().load("@/utils/personas");
  for (const [name, expected] of [
    [undefined, ""],
    [null, ""],
    ["  ", ""],
    [" Martina Benegas Nebbia ", "Martina"],
    ["Ana\u00a0Mar\u00eda", "Ana"],
    ["Jean-Luc Martin", "Jean-Luc"],
  ]) {
    assert.equal(primerNombreVisible(name), expected);
  }
  const full = Object.freeze({ ...persona, nombre: "Martina Benegas Nebbia" });
  const h = harness({ session: { persona: full } });
  const list = nodes(h.render("@/app/(tabs)/index.tsx")).find(
    (n) => n.type === "FlatList",
  );
  const header = h.expand(list.props.ListHeaderComponent);
  assert.match(text(header), /Hoy cuenta, Martina\./);
  assert.doesNotMatch(text(header), /Benegas/);
  assert.equal(full.nombre, "Martina Benegas Nebbia");
  const profile = harness({
    session: { persona: full },
    datos: { persona: full, resultados: [] },
  });
  const inputs = nodes(profile.render("@/app/(tabs)/perfil.tsx")).filter(
    (n) => n.type === "TextInput",
  );
  assert.equal(inputs[0].props.value, full.nombre);
});

test("empty names get a generic greeting without an empty comma", () => {
  const h = harness({ session: { persona: { ...persona, nombre: "" } } });
  const list = nodes(h.render("@/app/(tabs)/index.tsx")).find(
    (n) => n.type === "FlatList",
  );
  assert.match(
    text(h.expand(list.props.ListHeaderComponent)),
    /Hoy tambi\u00e9n cuenta\./,
  );
});

test("Home renders one copy of each metric and the completed state has no check-in button", () => {
  const h = harness({
    width: 320,
    datos: [{ ...posicion, desafio, estado: "ACTIVO", checkinHoy: true }],
  });
  const list = nodes(h.render("@/app/(tabs)/index.tsx")).find(
    (n) => n.type === "FlatList",
  );
  const row = h.expand(list.props.renderItem({ item: list.props.data[0] }));
  for (const value of [4, 37, 2]) {
    assert.equal(
      nodes(row).filter((n) => n.type === "Text" && text(n) === String(value))
        .length,
      1,
    );
  }
  assert.match(text(row), /Hoy ya cumpliste/);
  assert.equal(nodes(row).filter((n) => n.type === "Pressable").length, 1);
});

test("navigation active area is a circle, hides labels and adds the bottom safe area", () => {
  for (const width of [320, 440]) {
    const h = harness({ width, bottomInset: 34 });
    const tree = h.render("@/app/(tabs)/_layout.tsx");
    const opts = tree.props.screenOptions;
    assert.equal(opts.tabBarShowLabel, false);
    assert.equal(opts.tabBarActiveBackgroundColor, "transparent");
    assert.equal(opts.tabBarStyle.height, (width <= 375 ? 76 : 80) + 34);
    for (const screen of nodes(tree).filter((n) => n.type === "Tabs.Screen")) {
      assert.ok(screen.props.options.tabBarAccessibilityLabel);
      const icon = h.expand(screen.props.options.tabBarIcon({ focused: true }));
      assert.equal(icon.props.style.width, icon.props.style.height);
      assert.equal(icon.props.style.width, width <= 375 ? 52 : 56);
      assert.equal(icon.props.style.backgroundColor, "#FF641F");
      assert.equal(
        nodes(icon).find((n) => n.type === "Path").props.stroke,
        "#191B19",
      );
    }
  }
});

test("Detalle prioritizes check-in and progress before ranking, with secondary sections afterward", () => {
  const h = harness({ width: 320, datos: detail });
  const list = nodes(h.render("@/app/desafio/[id].tsx")).find(
    (n) => n.type === "FlatList",
  );
  const header = text(h.expand(list.props.ListHeaderComponent));
  assert.ok(header.indexOf("Caminar") < header.indexOf("Tu check-in"));
  assert.ok(header.indexOf("Tu check-in") < header.indexOf("Tu progreso"));
  assert.ok(header.indexOf("Tu progreso") < header.indexOf("Ranking"));
  assert.equal(header.includes("Alientos"), false);
  const footer = text(h.expand(list.props.ListFooterComponent));
  assert.ok(
    footer.indexOf("Mand\u00e1 un aliento") < footer.indexOf("Participantes"),
  );
  assert.ok(
    footer.indexOf("Participantes") < footer.indexOf("Invitar personas"),
  );
  assert.ok(
    footer.indexOf("Invitar personas") <
      footer.indexOf("Historial de actividad"),
  );
});

test("completed today permits yesterday check-in and preserves its date and payload", async () => {
  const data = {
    ...detail,
    tabla: { items: [{ ...posicion, checkinHoy: true }], ganador: null },
  };
  const h = harness({ datos: data });
  let list = nodes(h.render("@/app/desafio/[id].tsx")).find(
    (n) => n.type === "FlatList",
  );
  let header = h.expand(list.props.ListHeaderComponent);
  assert.match(text(header), /Hoy ya cumpliste/);
  assert.equal(action(header, "Guardar check-in"), undefined);
  assert.ok(action(header, "Deshacer check-in de hoy"));
  action(header, "AYER").props.onPress();
  list = nodes(h.render("@/app/desafio/[id].tsx")).find(
    (n) => n.type === "FlatList",
  );
  header = h.expand(list.props.ListHeaderComponent);
  action(header, "Guardar check-in").props.onPress();
  await Promise.all(h.pending);
  assert.ok(
    h.calls.some(
      (c) =>
        c[0] === "checkin" &&
        c[2].fecha === "2026-11-05" &&
        c[2].nota === undefined &&
        c[2].valor === undefined,
    ),
  );
});

test("nonparticipants and scheduled challenges never get the check-in form", () => {
  for (const d of [
    { ...desafio, participantes: [] },
    { ...desafio, fechaInicio: "2026-11-10" },
  ]) {
    const h = harness({ datos: { ...detail, desafio: d } });
    const list = nodes(h.render("@/app/desafio/[id].tsx")).find(
      (n) => n.type === "FlatList",
    );
    assert.equal(
      action(h.expand(list.props.ListHeaderComponent), "Guardar check-in"),
      undefined,
    );
  }
});

test("expanded participants stay in the same styled card as the heading", () => {
  const h = harness({ width: 320 });
  let tree = h.render(
    "@/components/ui/seccionExpandible",
    { titulo: "Participantes", children: "Ana @ana" },
    "SeccionExpandible",
  );
  nodes(tree)
    .find((n) => n.type === "Pressable")
    .props.onPress();
  tree = h.render(
    "@/components/ui/seccionExpandible",
    { titulo: "Participantes", children: "Ana @ana" },
    "SeccionExpandible",
  );
  assert.match(text(tree), /Participantes.*Ana @ana/);
  assert.equal(tree.props.style[0].borderRadius, 24);
  assert.equal(tree.props.style[0].backgroundColor, "#FFFFFF");
});

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  harness,
  nodes,
  text,
  action,
  desafio,
  detail,
} = require("./helpers/ui.cjs");
const estilos = (value) =>
  Object.assign(
    {},
    ...[value].flat(Infinity).filter((s) => s && typeof s === "object"),
  );

test("invitation is an independent green card without dropdown, with white copy buttons", () => {
  for (const width of [320, 440]) {
    const h = harness({ width });
    const tree = h.render(
      "@/components/desafios/invitacion",
      { desafio, participa: true, vigente: true },
      "Invitacion",
    );
    assert.equal(estilos(tree.props.style).backgroundColor, "#E4FBEA");
    assert.match(text(tree), /Invitar personas/);
    assert.match(text(tree), /ABC123/);
    assert.equal(
      nodes(tree).some(
        (n) => n.props.accessibilityState?.expanded !== undefined,
      ),
      false,
    );
    const buttons = nodes(tree).filter((n) => n.type === "Pressable");
    assert.equal(buttons.length, 2);
    for (const b of buttons) {
      const style = b.props.style({ pressed: false });
      assert.equal(style.backgroundColor, "#FFFFFF");
      assert.ok(style.minHeight >= 44);
    }
  }
});
test("invitation controls are hidden for a nonparticipant", () => {
  const h = harness();
  assert.equal(
    h.render(
      "@/components/desafios/invitacion",
      { desafio, participa: false, vigente: true },
      "Invitacion",
    ),
    null,
  );
});
test("native invitation retains the existing share message and uses a white button", async () => {
  const h = harness({ platform: "ios" });
  const tree = h.render(
    "@/components/desafios/invitacion",
    { desafio, participa: true, vigente: true },
    "Invitacion",
  );
  const share = action(tree, "Compartir invitaci\u00f3n");
  assert.equal(
    share.props.style({ pressed: false }).backgroundColor,
    "#FFFFFF",
  );
  share.props.onPress();
  await Promise.all(h.pending);
  assert.match(h.calls[0][1].message, /Caminar.*ABC123/);
});
test("Detalle orders invitation before its separate collapsed participant card", () => {
  const h = harness({ datos: detail });
  const footer = () => {
    const list = nodes(h.render("@/app/desafio/[id].tsx")).find(
      (n) => n.type === "FlatList",
    );
    return h.expand(list.props.ListFooterComponent);
  };
  let tree = footer(),
    contenido = text(tree);
  assert.ok(
    contenido.indexOf("Mand\u00e1 un aliento") <
      contenido.indexOf("Invitar personas"),
  );
  assert.ok(
    contenido.indexOf("Invitar personas") < contenido.indexOf("Participantes"),
  );
  assert.ok(
    contenido.indexOf("Participantes") <
      contenido.indexOf("Historial de actividad"),
  );
  const control = nodes(tree).find(
    (n) =>
      n.type === "Pressable" &&
      text(n).startsWith("Participantes") &&
      n.props.accessibilityState?.expanded === false,
  );
  assert.ok(control);
  control.props.onPress();
  tree = footer();
  assert.ok(
    nodes(tree).find(
      (n) =>
        n.type === "Pressable" &&
        text(n).startsWith("Participantes") &&
        n.props.accessibilityState?.expanded === true,
    ),
  );
  assert.match(text(tree), /Ana.*@ana/);
  assert.ok(action(tree, "Copiar c\u00f3digo"));
});
test("selection chips use shared purple tokens and preserve selection callbacks and default green", () => {
  const changed = [],
    h = harness();
  const tree = h.render(
    "@/components/ui",
    {
      valores: ["A", "B"],
      valor: "A",
      variante: "seleccion",
      cambiar: (v) => changed.push(v),
    },
    "Opciones",
  );
  const selected = action(tree, "A"),
    inactive = action(tree, "B");
  assert.equal(selected.props.style.backgroundColor, "#BE9BFF");
  assert.equal(estilos(selected.props.children.props.style).color, "#24133D");
  assert.equal(inactive.props.style.backgroundColor, "#F5F5F5");
  assert.equal(estilos(inactive.props.children.props.style).color, "#191B19");
  inactive.props.onPress();
  assert.deepEqual(changed, ["B"]);
  const original = h.render(
    "@/components/ui",
    { valores: ["HOY", "AYER"], valor: "HOY", cambiar() {} },
    "Opciones",
  );
  assert.equal(action(original, "HOY").props.style.backgroundColor, "#18E65B");
});
test("Explorar states are orange while categories stay purple and Crear/Mis creados stays green", () => {
  const h = harness({
    states: ["SALUD", "ACTIVO", 1],
    datos: { items: [], paginas: 0 },
  });
  const explorar = h.render("@/app/(tabs)/explorar.tsx");
  assert.equal(
    action(explorar, "SALUD").props.style.backgroundColor,
    "#BE9BFF",
  );
  assert.equal(
    action(explorar, "ACTIVO").props.style.backgroundColor,
    "#FF641F",
  );
  const crear = harness().render("@/app/(tabs)/crear.tsx");
  assert.equal(action(crear, "SALUD").props.style.backgroundColor, "#BE9BFF");
  assert.equal(action(crear, "Crear").props.style.backgroundColor, "#18E65B");
  assert.ok(action(crear, "Mis creados"));
});

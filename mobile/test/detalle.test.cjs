const test = require("node:test");
const assert = require("node:assert/strict");
const {
  harness,
  nodes,
  text,
  action,
  desafio,
  detail,
  posicion,
} = require("./helpers/ui.cjs");
const connected = () => ({
  estado: "Conectado",
  error: "",
  aviso: "",
  enEspera: false,
  enviando: false,
  alientos: [],
  enviar() {},
  reconectar() {},
});
test("Alientos is orange, always visible and sends the same emoji without a healthy connection label", async () => {
  const h = harness({ width: 320 }),
    sent = [];
  const realtime = {
    ...connected(),
    enviar: (emoji) => sent.push(emoji),
    alientos: [{ id: "a", emoji: "\ud83d\udc4f", nombre: "Ana" }],
  };
  const tree = h.render(
    "@/components/desafios/alientos",
    { activo: true, realtime },
    "Alientos",
  );
  assert.equal(tree.props.style[1].backgroundColor, "#FFE0D0");
  assert.match(text(tree), /Un empujoncito para el equipo/);
  assert.match(text(tree), /Ana envi\u00f3 un aliento/);
  assert.equal(text(tree).includes("Conectado"), false);
  assert.equal(action(tree, "Reconectar"), undefined);
  const buttons = nodes(tree).filter((n) => n.type === "Pressable");
  assert.equal(buttons.length, 6);
  assert.ok(buttons.every((n) => n.props.disabled === false));
  buttons[0].props.onPress();
  assert.deepEqual(sent, ["\ud83d\udc4f"]);
});
test("Alientos keeps inactive, disconnected, sending and cooldown guards", () => {
  for (const [activo, patch] of [
    [false, {}],
    [true, { estado: "Reconectando" }],
    [true, { enviando: true }],
    [true, { enEspera: true }],
  ]) {
    const h = harness(),
      realtime = { ...connected(), ...patch };
    const tree = h.render(
      "@/components/desafios/alientos",
      { activo, realtime },
      "Alientos",
    );
    const buttons = nodes(tree).filter((n) =>
      n.props.accessibilityLabel?.startsWith("Enviar aliento"),
    );
    assert.equal(buttons.length, 6);
    assert.ok(buttons.every((n) => n.props.disabled));
    if (patch.enEspera) assert.match(text(tree), /10 segundos/);
    if (patch.estado) assert.ok(action(tree, "Reconectar"));
  }
});
test("invitation is visible immediately and copies the original code and message with a local clipboard", async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "navigator"),
    copied = [];
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { clipboard: { writeText: async (value) => copied.push(value) } },
  });
  try {
    const h = harness(),
      props = { desafio, vigente: true, participa: true };
    let tree = h.render(
      "@/components/desafios/invitacion",
      props,
      "Invitacion",
    );
    assert.ok(action(tree, "Copiar c\u00f3digo"));
    assert.equal(
      nodes(tree).some(
        (n) => n.props.accessibilityState?.expanded !== undefined,
      ),
      false,
    );
    action(tree, "Copiar c\u00f3digo").props.onPress();
    await Promise.all(h.pending);
    action(tree, "Copiar mensaje de invitaci\u00f3n").props.onPress();
    await Promise.all(h.pending);
    assert.equal(copied[0], "ABC123");
    assert.match(copied[1], /Caminar.*ABC123/);
    assert.equal(
      nodes(tree).some((n) => text(n).includes("Copiar enlace")),
      false,
    );
  } finally {
    if (descriptor) Object.defineProperty(globalThis, "navigator", descriptor);
    else Reflect.deleteProperty(globalThis, "navigator");
  }
});
test("history is collapsed, retains notes/points and its existing page query", async () => {
  const h = harness({
    datos: {
      ...detail,
      historia: {
        items: [
          {
            id: "c1",
            fecha: "2026-11-06",
            puntos: 10,
            nota: "Mi nota",
            valor: 3,
          },
        ],
        paginas: 4,
      },
    },
  });
  const footer = () => {
    const tree = h.render("@/app/desafio/[id].tsx");
    const list = nodes(tree).find((n) => n.type === "FlatList");
    return h.expand(list.props.ListFooterComponent);
  };
  let tree = footer();
  assert.equal(text(tree).includes("Mi nota"), false);
  nodes(tree)
    .find(
      (n) =>
        n.type === "Pressable" && text(n).startsWith("Historial de actividad"),
    )
    .props.onPress();
  tree = footer();
  assert.match(text(tree), /Mi nota/);
  assert.match(text(tree), /10 puntos/);
  action(tree, "Siguiente").props.onPress();
  footer();
  await h.consultas.at(-1)();
  assert.ok(
    h.calls.some(
      (c) =>
        c[0] === "historial" && c[1] === "d1" && c[2] === "p1" && c[3] === 2,
    ),
  );
});
test("completed check-in still undoes through the same endpoint and refreshes", async () => {
  const h = harness({
    datos: {
      ...detail,
      tabla: { items: [{ ...posicion, checkinHoy: true }], ganador: null },
    },
  });
  const tree = h.render("@/app/desafio/[id].tsx"),
    list = nodes(tree).find((n) => n.type === "FlatList");
  action(
    h.expand(list.props.ListHeaderComponent),
    "Deshacer check-in de hoy",
  ).props.onPress();
  await Promise.all(h.pending);
  const calls = h.calls.filter((c) => c[0] !== "realtime");
  assert.deepEqual(calls, [["deshacer", "d1"], ["refresh"]]);
});

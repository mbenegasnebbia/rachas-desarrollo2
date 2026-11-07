const test = require("node:test");
const assert = require("node:assert/strict");
const jsx = require("react/jsx-runtime");
const {
  harness,
  nodes,
  text,
  action,
  solicitud,
  persona,
  desafio,
  posicion,
} = require("./helpers/ui.cjs");
const tick = () => new Promise((resolve) => setImmediate(resolve));

test("fresh approved/rejected responses must beat a stale pending snapshot", () => {
  for (const estado of ["APPROVED", "REJECTED", "CANCELLED"]) {
    const h = harness({
      states: ["ABC123", "ABC123", { ...solicitud, estado }, null],
    });
    const tree = h.render(
      "@/components/desafios/solicitarAccesoFormulario",
      { solicitudes: [solicitud] },
      "SolicitarAccesoFormulario",
    );
    assert.equal(action(tree, "Solicitud pendiente"), undefined);
    assert.match(
      text(tree),
      estado === "APPROVED"
        ? /aprobada/
        : estado === "REJECTED"
          ? /rechazada/
          : /cancelada/,
    );
  }
});
test("cancellation error remains visible when concurrent approval removes the last pending row", async () => {
  const h = harness({
    accionReal: true,
    apiSolicitudes: {
      cancelarSolicitud: () =>
        Promise.reject(Error("La solicitud ya fue resuelta")),
    },
  });
  const props = {
    solicitudes: [solicitud],
    cargando: false,
    error: "",
    alCancelar() {},
    refrescar: async () => {
      props.solicitudes = [{ ...solicitud, estado: "APPROVED" }];
    },
  };
  const path = "@/components/desafios/solicitudesPendientes";
  action(
    h.render(path, props, "SolicitudesPendientes"),
    "Cancelar solicitud",
  ).props.onPress();
  await tick();
  assert.match(
    text(h.render(path, props, "SolicitudesPendientes")),
    /La solicitud ya fue resuelta/,
  );
});
test("pull-to-refresh in Explorar refreshes pending requests as well as the catalog", async () => {
  let lecturas = 0;
  const h = harness({
    cargaReal: true,
    focoEstable: true,
    apiSolicitudes: {
      listarTodasSolicitudesPropias: async () => {
        lecturas++;
        return [solicitud];
      },
    },
  });
  const path = "@/app/(tabs)/explorar.tsx";
  h.render(path);
  h.aplicarFoco();
  await tick();
  let tree = h.render(path);
  h.aplicarFoco();
  await tick();
  const antes = lecturas;
  const scroll = nodes(tree).find((n) => n.type === "ScrollView");
  await scroll.props.refreshControl.props.onRefresh();
  tree = h.render(path);
  h.aplicarFoco();
  await tick();
  assert.ok(tree);
  assert.equal(lecturas, antes + 1);
});
test("a load for account B must never expose the previous account A snapshot or error", async () => {
  const h = harness({ focoEstable: true });
  const hooks = h.load("./hooks/useCarga.ts");
  hooks.Prueba = ({ cuenta, consulta }) =>
    jsx.jsx("View", { carga: hooks.useCarga(consulta, cuenta) });
  const a = async () => ["privado-de-A"],
    b = async () => ["de-B"];
  const path = "./hooks/useCarga.ts";
  h.render(path, { cuenta: "A", consulta: a }, "Prueba");
  h.aplicarFoco();
  await tick();
  assert.deepEqual(
    h.render(path, { cuenta: "A", consulta: a }, "Prueba").props.carga.datos,
    ["privado-de-A"],
  );
  const tree = h.render(path, { cuenta: "B", consulta: b }, "Prueba");
  assert.equal(tree.props.carga.datos, null);
  assert.equal(tree.props.carga.error, "");
  h.aplicarFoco();
  await tick();
  assert.deepEqual(
    h.render(path, { cuenta: "B", consulta: b }, "Prueba").props.carga.datos,
    ["de-B"],
  );
});

test("late account A responses cannot replace account B after a context switch", async () => {
  let finish;
  const h = harness({ focoEstable: true }),
    hooks = h.load("./hooks/useCarga.ts");
  hooks.Prueba = ({ cuenta, consulta }) =>
    jsx.jsx("View", { carga: hooks.useCarga(consulta, cuenta) });
  const a = () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
    b = async () => ["B"];
  const path = "./hooks/useCarga.ts";
  h.render(path, { cuenta: "A", consulta: a }, "Prueba");
  h.aplicarFoco();
  h.render(path, { cuenta: "B", consulta: b }, "Prueba");
  h.aplicarFoco();
  await tick();
  finish(["A"]);
  await tick();
  assert.deepEqual(
    h.render(path, { cuenta: "B", consulta: b }, "Prueba").props.carga.datos,
    ["B"],
  );
});
test("an error from A is hidden before B starts fetching", async () => {
  const h = harness({ focoEstable: true }),
    hooks = h.load("./hooks/useCarga.ts");
  hooks.Prueba = ({ cuenta, consulta }) =>
    jsx.jsx("View", { carga: hooks.useCarga(consulta, cuenta) });
  const a = () => Promise.reject(Error("Error privado de A")),
    b = async () => [];
  const path = "./hooks/useCarga.ts";
  h.render(path, { cuenta: "A", consulta: a }, "Prueba");
  h.aplicarFoco();
  await tick();
  assert.equal(
    h.render(path, { cuenta: "A", consulta: a }, "Prueba").props.carga.error,
    "Error privado de A",
  );
  const next = h.render(path, { cuenta: "B", consulta: b }, "Prueba").props
    .carga;
  assert.equal(next.error, "");
  assert.equal(next.datos, null);
  assert.equal(next.cargando, true);
});
test("Inicio refetches and hides private summary when accounts have the same timezone", async () => {
  const session = { persona, usuarioFirebase: { uid: "uid-A" } },
    reads = [];
  const h = harness({
    cargaReal: true,
    focoEstable: true,
    session,
    apiPersonas: {
      resumen: async (_zona, uid) => {
        reads.push(uid);
        return [
          { ...posicion, desafio: { ...desafio, id: uid }, estado: "ACTIVO" },
        ];
      },
    },
  });
  const path = "@/app/(tabs)/index.tsx";
  h.render(path);
  h.aplicarFoco();
  await tick();
  let tree = h.render(path);
  assert.equal(
    nodes(tree).find((n) => n.type === "FlatList").props.data[0].desafio.id,
    "uid-A",
  );
  session.persona = { ...persona, id: "p2", nombre: "B" };
  session.usuarioFirebase = { uid: "uid-B" };
  tree = h.render(path);
  assert.deepEqual(
    nodes(tree).find((n) => n.type === "FlatList").props.data,
    [],
  );
  h.aplicarFoco();
  await tick();
  tree = h.render(path);
  assert.equal(
    nodes(tree).find((n) => n.type === "FlatList").props.data[0].desafio.id,
    "uid-B",
  );
  assert.deepEqual(reads, ["uid-A", "uid-B"]);
});

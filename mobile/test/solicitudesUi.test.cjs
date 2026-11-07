const test = require("node:test");
const assert = require("node:assert/strict");
const {
  harness,
  nodes,
  text,
  action,
  persona,
  desafio,
  posicion,
  solicitud,
} = require("./helpers/ui.cjs");
const tick = () => new Promise((resolve) => setImmediate(resolve));
const form = "@/components/desafios/solicitarAccesoFormulario";
const admin = "@/components/desafios/solicitudesRecibidas";
const pendientes = "@/components/desafios/solicitudesPendientes";
const page = (items) => ({
  items,
  total: items.length,
  pagina: 1,
  limite: 10,
  paginas: items.length ? 1 : 0,
});

test("request is explicit, shows pending and blocks duplicate sends without navigating", async () => {
  let release,
    calls = 0;
  const h = harness({
    states: [" abc123 "],
    accionReal: true,
    apiSolicitudes: {
      solicitarAcceso: () => {
        calls++;
        return new Promise((resolve) => {
          release = resolve;
        });
      },
    },
  });
  let tree = h.render(form, {}, "SolicitarAccesoFormulario");
  const button = action(tree, "Solicitar acceso");
  button.props.onPress();
  button.props.onPress();
  assert.equal(calls, 1);
  tree = h.render(form, {}, "SolicitarAccesoFormulario");
  assert.ok(nodes(tree).some((n) => n.props.accessibilityState?.busy));
  release(solicitud);
  await tick();
  tree = h.render(form, {}, "SolicitarAccesoFormulario");
  assert.match(
    text(tree),
    /Solicitud enviada\. El creador del desaf\u00edo tiene que aprobar tu ingreso/,
  );
  assert.equal(action(tree, "Solicitud pendiente").props.disabled, true);
  assert.equal(action(tree, "Ver desaf\u00edo"), undefined);
  assert.equal(
    h.calls.some((c) => c[0] === "push"),
    false,
  );
});
test("rejected/cancelled requests show their existing state with no resend or access", () => {
  for (const estado of ["REJECTED", "CANCELLED"]) {
    const h = harness({
      states: ["ABC123", "ABC123", { ...solicitud, estado }, null],
    });
    const tree = h.render(form, {}, "SolicitarAccesoFormulario");
    assert.match(text(tree), /Por ahora no pod\u00e9s volver/);
    const button = action(
      tree,
      estado === "REJECTED" ? "Solicitud rechazada" : "Solicitud cancelada",
    );
    assert.equal(button.props.disabled, true);
    assert.equal(action(tree, "Ver desaf\u00edo"), undefined);
  }
});
test("a refreshed approval or local cancellation replaces stale pending feedback", () => {
  const h = harness({ states: ["ABC123", "ABC123", solicitud, null] });
  let tree = h.render(
    form,
    { solicitudes: [{ ...solicitud, estado: "APPROVED" }] },
    "SolicitarAccesoFormulario",
  );
  assert.ok(action(tree, "Ver desaf\u00edo"));
  action(tree, "Ver desaf\u00edo").props.onPress();
  assert.deepEqual(h.calls.at(-1), [
    "push",
    { pathname: "/desafio/[id]", params: { id: "d1" } },
  ]);
  tree = h.render(
    form,
    {
      solicitudes: [solicitud],
      actualizacion: { ...solicitud, estado: "CANCELLED" },
    },
    "SolicitarAccesoFormulario",
  );
  assert.ok(action(tree, "Solicitud cancelada"));
  assert.equal(action(tree, "Ver desaf\u00edo"), undefined);
});
test("existing participants are resolved only through their own participation endpoint", async () => {
  const h = harness({
    states: ["ABC123"],
    accionReal: true,
    apiSolicitudes: {
      solicitarAcceso: () =>
        Promise.reject(
          Object.assign(new Error("placeholder"), { status: 409 }),
        ),
    },
  });
  const { ApiError } = h.load("@/api/client");
  const withConflict = harness({
    states: ["ABC123"],
    accionReal: true,
    apiSolicitudes: {
      solicitarAcceso: () => Promise.reject(new ApiError(409, "Ya participas")),
      listarParticipaciones: async (...args) => {
        h.calls.push(["participaciones", ...args]);
        return [desafio];
      },
    },
  });
  action(
    withConflict.render(form, {}, "SolicitarAccesoFormulario"),
    "Solicitar acceso",
  ).props.onPress();
  await tick();
  const tree = withConflict.render(form, {}, "SolicitarAccesoFormulario");
  assert.match(text(tree), /Ya particip\u00e1s/);
  assert.deepEqual(h.calls, [["participaciones", "p1", "fake"]]);
  assert.ok(action(tree, "Ver desaf\u00edo"));
});
test("network failure remains retryable and never shows successful submission", async () => {
  const h = harness({
    states: ["ABC123"],
    accionReal: true,
    apiSolicitudes: { solicitarAcceso: () => Promise.reject(Error("Sin red")) },
  });
  action(
    h.render(form, {}, "SolicitarAccesoFormulario"),
    "Solicitar acceso",
  ).props.onPress();
  await tick();
  const tree = h.render(form, {}, "SolicitarAccesoFormulario");
  assert.match(text(tree), /Sin red/);
  assert.equal(action(tree, "Solicitar acceso").props.disabled, false);
  assert.doesNotMatch(text(tree), /Solicitud enviada/);
});
test("pending section hides resolved history and the empty section", () => {
  for (const solicitudes of [
    [],
    [{ ...solicitud, estado: "REJECTED" }],
    [{ ...solicitud, estado: "APPROVED" }],
  ]) {
    const h = harness();
    assert.equal(
      h.render(
        pendientes,
        {
          solicitudes,
          cargando: false,
          error: "",
          refrescar: async () => {},
          alCancelar() {},
        },
        "SolicitudesPendientes",
      ),
      null,
    );
  }
  const h = harness();
  const tree = h.render(
    pendientes,
    {
      solicitudes: [
        solicitud,
        { ...solicitud, id: "rechazada", estado: "REJECTED" },
      ],
      cargando: false,
      error: "",
      refrescar: async () => {},
      alCancelar() {},
    },
    "SolicitudesPendientes",
  );
  assert.match(text(tree), /Solicitudes pendientes/);
  assert.equal(nodes(tree).filter((n) => n.type === "Pressable").length, 1);
});
test("cancelling updates the result and removes the row even if it was the last pending", async () => {
  const changes = [],
    h = harness({ accionReal: true });
  const props = {
    solicitudes: [solicitud],
    cargando: false,
    error: "",
    refrescar: async () => changes.push("refresh"),
    alCancelar: (s) => changes.push(s.estado),
  };
  action(
    h.render(pendientes, props, "SolicitudesPendientes"),
    "Cancelar solicitud",
  ).props.onPress();
  await tick();
  const tree = h.render(pendientes, props, "SolicitudesPendientes");
  assert.match(text(tree), /Solicitud cancelada/);
  assert.doesNotMatch(text(tree), /Solicitudes pendientes/);
  assert.deepEqual(changes, ["CANCELLED", "refresh"]);
});
test("admin approval/rejection is guarded, shows busy and refreshes counts without double writes", async () => {
  for (const decision of ["aprobar", "rechazar"]) {
    let release,
      calls = 0,
      counts = 0;
    const h = harness({
      datos: page([solicitud]),
      accionReal: true,
      apiSolicitudes: {
        resolverSolicitud: () => {
          calls++;
          return new Promise((resolve) => {
            release = resolve;
          });
        },
      },
    });
    const props = {
      desafio,
      volver() {},
      alResolver: async () => {
        counts++;
      },
    };
    let tree = h.render(admin, props, "SolicitudesRecibidas");
    const button = action(
      tree,
      decision === "aprobar" ? "Aprobar" : "Rechazar",
    );
    button.props.onPress();
    button.props.onPress();
    assert.equal(calls, 1);
    tree = h.render(admin, props, "SolicitudesRecibidas");
    assert.ok(nodes(tree).some((n) => n.props.accessibilityState?.busy));
    release({
      ...solicitud,
      estado: decision === "aprobar" ? "APPROVED" : "REJECTED",
    });
    await tick();
    tree = h.render(admin, props, "SolicitudesRecibidas");
    assert.match(
      text(tree),
      decision === "aprobar" ? /Solicitud aprobada/ : /Solicitud rechazada/,
    );
    assert.equal(action(tree, "Aprobar"), undefined);
    assert.equal(counts, 1);
    assert.ok(h.calls.some((c) => c[0] === "refresh"));
  }
});
test("admin errors preserve the pending row and permit retry", async () => {
  const h = harness({
    datos: page([solicitud]),
    accionReal: true,
    apiSolicitudes: {
      resolverSolicitud: () =>
        Promise.reject(Error("El desafio ya esta completo")),
    },
  });
  const props = { desafio, volver() {}, alResolver: async () => {} };
  action(
    h.render(admin, props, "SolicitudesRecibidas"),
    "Aprobar",
  ).props.onPress();
  await tick();
  const tree = h.render(admin, props, "SolicitudesRecibidas");
  assert.match(text(tree), /El desafio ya esta completo/);
  assert.ok(action(tree, "Aprobar"));
  assert.doesNotMatch(text(tree), /Solicitud aprobada/);
});
test("non-creators have no admin controls or pending query", async () => {
  const h = harness({ session: { persona: { ...persona, id: "otra" } } });
  assert.equal(
    h.render(
      admin,
      { desafio, volver() {}, alResolver: async () => {} },
      "SolicitudesRecibidas",
    ),
    null,
  );
  await assert.rejects(h.consultas[0](), /Solo el creador/);
  assert.deepEqual(h.calls, []);
});
test("Mis creados scopes counters to owned challenges and never fabricates a zero on failure", async () => {
  const h = harness({
    datos: page([]),
    apiSolicitudes: {
      listarCreados: async () =>
        page([desafio, { ...desafio, id: "ajeno", creador: "otro" }]),
      listarSolicitudesRecibidas: () => Promise.reject(Error("offline")),
    },
  });
  h.render("@/components/desafios/misCreados", {}, "MisCreados");
  const result = await h.consultas[0]();
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].pendientes, null);
  h.cargas[0] = { datos: result };
  const tree = h.render("@/components/desafios/misCreados", {}, "MisCreados");
  assert.match(text(tree), /No pudimos consultar las solicitudes/);
  assert.doesNotMatch(text(tree), /0 solicitudes pendientes/);
});
test("Crear pills retain the tab and original draft when returning from Mis creados", () => {
  const h = harness({
    states: ["Mi borrador", "Texto", "SALUD", "2026-11-06", "2026-11-20", "10"],
  });
  let tree = h.render("@/app/(tabs)/crear.tsx");
  h.cargas[0] = { datos: page([]) };
  action(tree, "Mis creados").props.onPress();
  tree = h.render("@/app/(tabs)/crear.tsx");
  assert.equal(action(tree, "Crear desaf\u00edo"), undefined);
  assert.match(text(tree), /Todav\u00eda no creaste/);
  action(tree, "Crear").props.onPress();
  tree = h.render("@/app/(tabs)/crear.tsx");
  assert.equal(
    nodes(tree).find((n) => n.type === "TextInput").props.value,
    "Mi borrador",
  );
  assert.ok(action(tree, "Crear desaf\u00edo"));
});
test("focus refresh brings an approved challenge to Inicio using the existing summary mechanism", async () => {
  let resumen = [];
  const h = harness({
    cargaReal: true,
    apiPersonas: { resumen: async () => resumen },
  });
  h.render("@/app/(tabs)/index.tsx");
  const blur = h.focusEffects.at(-1)();
  await tick();
  let tree = h.render("@/app/(tabs)/index.tsx");
  assert.deepEqual(
    nodes(tree).find((n) => n.type === "FlatList").props.data,
    [],
  );
  blur();
  resumen = [{ ...posicion, desafio, estado: "ACTIVO" }];
  h.focusEffects.at(-1)();
  await tick();
  tree = h.render("@/app/(tabs)/index.tsx");
  assert.equal(
    nodes(tree).find((n) => n.type === "FlatList").props.data[0].desafio.id,
    "d1",
  );
});
test("new request cards keep shared responsive geometry at 320 and 440", () => {
  for (const width of [320, 440]) {
    const h = harness({ width, datos: page([solicitud]) });
    const tree = h.render(
      admin,
      { desafio, volver() {}, alResolver: async () => {} },
      "SolicitudesRecibidas",
    );
    for (const button of nodes(tree).filter((n) => n.type === "Pressable")) {
      const style = button.props.style({ pressed: false });
      assert.ok(style.minHeight >= 44);
      assert.equal(style.borderRadius, 999);
    }
  }
});

test("Explorar refreshes own requests on focus and removes approvals from pending without polling", async () => {
  let solicitudes = [solicitud];
  const h = harness({
    cargaReal: true,
    apiSolicitudes: {
      listarTodasSolicitudesPropias: async () => solicitudes,
    },
  });
  const route = "@/components/desafios/accesoDesafios";
  const props = { alSolicitar: async () => {} };
  h.render(route, props, "AccesoDesafios");
  const blur = h.focusEffects.at(-1)();
  await tick();
  let tree = h.render(route, props, "AccesoDesafios");
  assert.match(text(tree), /Solicitudes pendientes/);
  blur();
  solicitudes = [{ ...solicitud, estado: "APPROVED" }];
  h.focusEffects.at(-1)();
  await tick();
  tree = h.render(route, props, "AccesoDesafios");
  assert.doesNotMatch(text(tree), /Solicitudes pendientes/);
  assert.equal(action(tree, "Cancelar solicitud"), undefined);
});

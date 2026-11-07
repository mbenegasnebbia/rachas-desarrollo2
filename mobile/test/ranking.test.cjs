const test = require("node:test");
const assert = require("node:assert/strict");
const { harness, nodes, text, action } = require("./helpers/ui.cjs");
const items = Object.freeze(
  Array.from({ length: 1000 }, (_, index) =>
    Object.freeze({
      personaId: "p" + index,
      alias: "alias" + index,
      nombre: "Participante",
      posicion: index + 1,
      puntos: 7,
      rachaActual: 2,
      mejorRacha: 8,
      checkinHoy: false,
    }),
  ),
);
function setup(values = items, personaId = "p4") {
  const h = harness();
  const refresh = () => h.calls.push(["refresh"]);
  const render = (next = values) =>
    nodes(
      h.render(
        "@/components/desafios/rankingDesplegable",
        {
          tabla: { items: next, ganador: next[0] ?? null },
          personaId,
          encabezado: "detalle",
          pie: "acciones",
          refrescar: refresh,
          cargando: false,
        },
        "RankingDesplegable",
      ),
    ).find((n) => n.type === "FlatList").props;
  return { ...h, render, refresh };
}
test("collapsed ranking renders no list; expand top 3, then all, then collapse", () => {
  const h = setup();
  let list = h.render();
  assert.equal(list.data.length, 0);
  assert.match(text(h.expand(list.ListHeaderComponent)), /5\. @alias4/);
  action(h.expand(list.ListHeaderComponent), "Ranking").props.onPress();
  list = h.render();
  assert.deepEqual(list.data, items.slice(0, 3));
  action(
    h.expand(list.ListFooterComponent),
    "Ver ranking completo",
  ).props.onPress();
  list = h.render();
  assert.equal(list.data, items);
  action(h.expand(list.ListHeaderComponent), "Ranking").props.onPress();
  list = h.render();
  assert.equal(list.data.length, 0);
  action(h.expand(list.ListHeaderComponent), "Ranking").props.onPress();
  assert.deepEqual(h.render().data, items.slice(0, 3)); // collapse resets the full-list view
  assert.equal(h.calls.length, 0);
});
test("current user summary is available outside top 3; expanded own row is highlighted", () => {
  const h = setup(),
    list = h.render();
  assert.match(text(h.expand(list.ListHeaderComponent)), /@alias4.*7 puntos/);
  const own = h.expand(list.renderItem({ item: items[4] }));
  assert.ok(
    nodes(own).some((n) => n.props.accessibilityState?.selected === true),
  );
  assert.match(text(own), /Vos/);
  const other = h.expand(list.renderItem({ item: items[0] }));
  assert.equal(
    nodes(other).some((n) => n.props.accessibilityState?.selected === true),
    false,
  );
});
test("empty and short rankings expand safely without a redundant full-list action", () => {
  for (const length of [0, 1, 2, 3]) {
    const h = setup(items.slice(0, length), "p0");
    let list = h.render();
    assert.equal(list.data.length, 0);
    action(h.expand(list.ListHeaderComponent), "Ranking").props.onPress();
    list = h.render();
    assert.equal(list.data.length, length);
    assert.equal(
      action(h.expand(list.ListFooterComponent), "Ver ranking completo"),
      undefined,
    );
  }
});
test("live data updates preserve backend order, positions, refresh and stable identity", () => {
  const h = setup();
  let list = h.render();
  action(h.expand(list.ListHeaderComponent), "Ranking").props.onPress();
  list = h.render();
  action(
    h.expand(list.ListFooterComponent),
    "Ver ranking completo",
  ).props.onPress();
  const updated = [items[9], items[4], items[0], items[3]];
  list = h.render(updated);
  assert.equal(list.data, updated);
  assert.equal(list.onRefresh, h.refresh);
  assert.equal(list.extraData, "p4");
  assert.equal(list.keyExtractor(items[4]), "p4");
  assert.match(text(h.expand(list.ListHeaderComponent)), /detalle/);
  assert.match(text(h.expand(list.ListFooterComponent)), /acciones/);
});

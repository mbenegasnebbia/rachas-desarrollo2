const test = require("node:test");
const assert = require("node:assert/strict");
const { harness, nodes, text } = require("./helpers/ui.cjs");
for (const width of [320, 440]) {
  test(
    "metric summary has three centered equal columns at " + width + "px",
    () => {
      const h = harness({ width });
      const tree = h.render(
        "@/components/desafios/resumenMetricas",
        { racha: 4, puntos: 37, puesto: 2 },
        "ResumenMetricas",
      );
      assert.equal(tree.props.style.backgroundColor, "#F5F5F5");
      const columns = tree.props.children;
      assert.equal(columns.length, 3);
      for (const [i, column] of columns.entries()) {
        assert.equal(column.props.style.flexGrow, 1);
        assert.equal(column.props.style.flexBasis, 0);
        assert.equal(column.props.style.alignItems, "center");
        const circle = column.props.children[0];
        assert.equal(circle.props.style.width, 44);
        assert.equal(circle.props.style.height, 44);
        assert.equal(
          nodes(circle).find((n) => n.type === "Path").props.stroke,
          ["#852400", "#075C29", "#503078"][i],
        );
        const value = column.props.children[1];
        assert.equal(value.props.style[0].fontSize, 26);
        assert.equal(value.props.style[0].fontWeight, "800");
        assert.equal(text(value), String([4, 37, 2][i]));
        const label = column.props.children[2];
        assert.equal(label.props.style[0].fontSize, 12);
        assert.equal(label.props.style[0].fontWeight, "600");
        assert.equal(text(label), ["RACHA", "PUNTOS", "PUESTO"][i]);
      }
    },
  );
}

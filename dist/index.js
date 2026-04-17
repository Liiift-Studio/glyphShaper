import { useState as T, useEffect as W, useRef as E, useCallback as A } from "react";
import { jsxs as $, jsx as d } from "react/jsx-runtime";
const j = 2001684018;
function H(t) {
  return t.byteLength < 4 ? !1 : new DataView(t).getUint32(0, !1) === j;
}
async function N(t, n) {
  let r = t;
  if (H(t)) {
    if (!n)
      throw new Error(
        "[glyphshaper] WOFF2 input requires a woff2Decompressor. Pass one to parseFont(), or convert the font to TTF / OTF / WOFF first."
      );
    r = await n(t);
  }
  const { parse: o } = await import("opentype.js");
  return { _font: o(r) };
}
function Q(t, n) {
  var e;
  const r = t._font.charToGlyphIndex(n), o = t._font.glyphs.get(r);
  return (e = o == null ? void 0 : o.path) != null && e.commands ? o.path.commands.map((a) => ({ ...a })) : [];
}
function Y(t, n, r) {
  const o = t._font.charToGlyphIndex(n), e = t._font.glyphs.get(o);
  e != null && e.path && (e.path.commands = r);
}
function K(t) {
  const n = t._font.toArrayBuffer();
  return new Blob([n], { type: "font/opentype" });
}
const M = "glyphshaper-override";
function V(t, n, r, o = {}) {
  var x;
  r && URL.revokeObjectURL(r);
  const e = URL.createObjectURL(n), a = o.fontWeight ?? "normal", c = o.fontStyle ?? "normal";
  (x = document.getElementById(M)) == null || x.remove();
  const i = document.createElement("style");
  return i.id = M, i.textContent = [
    "@font-face {",
    `  font-family: ${JSON.stringify(t)};`,
    `  src: url(${JSON.stringify(e)}) format('opentype');`,
    `  font-weight: ${a};`,
    `  font-style: ${c};`,
    "}"
  ].join(`
`), document.head.appendChild(i), e;
}
function st(t) {
  var n;
  URL.revokeObjectURL(t), (n = document.getElementById(M)) == null || n.remove();
}
function X(t) {
  return t.map((n) => {
    switch (n.type) {
      case "M":
        return `M ${n.x} ${n.y}`;
      case "L":
        return `L ${n.x} ${n.y}`;
      case "C":
        return `C ${n.x1} ${n.y1} ${n.x2} ${n.y2} ${n.x} ${n.y}`;
      case "Q":
        return `Q ${n.x1} ${n.y1} ${n.x} ${n.y}`;
      case "Z":
        return "Z";
    }
  }).join(" ");
}
function lt(t) {
  const [n, r] = T({
    font: null,
    loading: !1,
    error: null
  });
  return W(() => {
    if (!t) {
      r({ font: null, loading: !1, error: null });
      return;
    }
    let o = !1;
    r((a) => ({ ...a, loading: !0, error: null }));
    async function e() {
      try {
        let a;
        if (typeof t == "string") {
          const i = await fetch(t);
          if (!i.ok) throw new Error(`HTTP ${i.status} fetching font`);
          a = await i.arrayBuffer();
        } else
          a = await t.arrayBuffer();
        if (o) return;
        const c = await N(a);
        if (o) return;
        r({ font: c, loading: !1, error: null });
      } catch (a) {
        if (o) return;
        r({
          font: null,
          loading: !1,
          error: a instanceof Error ? a.message : "Failed to load font"
        });
      }
    }
    return e(), () => {
      o = !0;
    };
  }, [
    typeof t == "string" ? t : t ? `${t.name}:${t.size}` : null
  ]), n;
}
const v = 360, h = 32, Z = 7, q = 5, B = 50;
function P(t, n, r, o, e) {
  return [
    h + (t - o) * r,
    h + (e - n) * r
  ];
}
function J(t, n, r, o, e) {
  return [
    (t - h) / r + o,
    e - (n - h) / r
  ];
}
function tt(t) {
  const n = [];
  for (let r = 0; r < t.length; r++) {
    const o = t[r];
    o.type === "M" || o.type === "L" ? n.push({ cmdIdx: r, field: "xy", kind: "anchor", x: o.x, y: o.y }) : o.type === "C" ? (n.push({ cmdIdx: r, field: "x1y1", kind: "handle", x: o.x1, y: o.y1 }), n.push({ cmdIdx: r, field: "x2y2", kind: "handle", x: o.x2, y: o.y2 }), n.push({ cmdIdx: r, field: "xy", kind: "anchor", x: o.x, y: o.y })) : o.type === "Q" && (n.push({ cmdIdx: r, field: "x1y1", kind: "handle", x: o.x1, y: o.y1 }), n.push({ cmdIdx: r, field: "xy", kind: "anchor", x: o.x, y: o.y }));
  }
  return n;
}
function nt(t) {
  const n = [];
  let r = 0, o = 0;
  for (const e of t)
    e.type === "M" || e.type === "L" ? (r = e.x, o = e.y) : e.type === "C" ? (n.push({ x1: r, y1: o, x2: e.x1, y2: e.y1 }), n.push({ x1: e.x2, y1: e.y2, x2: e.x, y2: e.y }), r = e.x, o = e.y) : e.type === "Q" && (n.push({ x1: r, y1: o, x2: e.x1, y2: e.y1 }), n.push({ x1: e.x1, y1: e.y1, x2: e.x, y2: e.y }), r = e.x, o = e.y);
  return n;
}
function et(t, n, r, o, e) {
  const a = Math.round(o), c = Math.round(e);
  return t.map((i, x) => x !== n ? i : r === "xy" && (i.type === "M" || i.type === "L") ? { ...i, x: a, y: c } : r === "xy" && (i.type === "C" || i.type === "Q") ? { ...i, x: a, y: c } : r === "x1y1" && (i.type === "C" || i.type === "Q") ? { ...i, x1: a, y1: c } : r === "x2y2" && i.type === "C" ? { ...i, x2: a, y2: c } : i);
}
function rt(t) {
  const n = /* @__PURE__ */ new Set();
  return t.split("").filter((r) => !r.trim() || n.has(r) ? !1 : (n.add(r), !0));
}
function ot({
  commands: t,
  font: n,
  char: r,
  onChange: o,
  onDragStart: e
}) {
  const a = E(null), c = E(null), i = n._font, x = i.charToGlyphIndex(r), p = i.glyphs.get(x), k = (p == null ? void 0 : p.leftSideBearing) ?? 0, S = (p == null ? void 0 : p.advanceWidth) ?? i.unitsPerEm, y = i.ascender, C = i.descender, D = S, I = y - C, R = v - 2 * h, u = Math.min(R / D, R / I), L = h + y * u, l = A((s) => {
    const g = a.current;
    if (!g) return [0, 0];
    const b = g.createSVGPoint();
    b.x = s.clientX, b.y = s.clientY;
    const m = b.matrixTransform(g.getScreenCTM().inverse());
    return J(m.x, m.y, u, k, y);
  }, [u, k, y]);
  function f(s, g, b) {
    s.stopPropagation(), s.target.setPointerCapture(s.pointerId), e(t), c.current = { cmdIdx: g, field: b };
  }
  function w(s) {
    if (!c.current) return;
    const [g, b] = l(s);
    o(et(t, c.current.cmdIdx, c.current.field, g, b));
  }
  function U() {
    c.current = null;
  }
  const O = X(t), _ = tt(t), z = nt(t);
  return /* @__PURE__ */ $(
    "svg",
    {
      ref: a,
      width: "100%",
      viewBox: `0 0 ${v} ${v}`,
      onPointerMove: w,
      onPointerUp: U,
      onPointerLeave: U,
      style: {
        display: "block",
        touchAction: "none",
        cursor: "default",
        // Maintain a 1:1 aspect ratio as width scales with the container
        aspectRatio: "1 / 1"
      },
      "aria-label": `Glyph path editor for character ${r}`,
      children: [
        /* @__PURE__ */ d(
          "line",
          {
            x1: h / 2,
            y1: L,
            x2: v - h / 2,
            y2: L,
            stroke: "rgba(255,255,255,0.08)",
            strokeWidth: 1
          }
        ),
        (() => {
          const [s] = P(S, 0, u, k, y);
          return /* @__PURE__ */ d(
            "line",
            {
              x1: s,
              y1: h / 2,
              x2: s,
              y2: v - h / 2,
              stroke: "rgba(255,255,255,0.08)",
              strokeWidth: 1,
              strokeDasharray: "4 4"
            }
          );
        })(),
        /* @__PURE__ */ d("g", { transform: `translate(${h + (0 - k) * u}, ${h + y * u}) scale(${u}, ${-u})`, children: t.length > 0 && /* @__PURE__ */ d(
          "path",
          {
            d: O,
            fill: "rgba(212,184,240,0.12)",
            stroke: "rgba(212,184,240,0.55)",
            strokeWidth: 2 / u,
            fillRule: "nonzero"
          }
        ) }),
        z.map((s, g) => {
          const [b, m] = P(s.x1, s.y1, u, k, y), [F, G] = P(s.x2, s.y2, u, k, y);
          return /* @__PURE__ */ d(
            "line",
            {
              x1: b,
              y1: m,
              x2: F,
              y2: G,
              stroke: "rgba(255,255,255,0.18)",
              strokeWidth: 1,
              strokeDasharray: "3 3"
            },
            g
          );
        }),
        _.map((s, g) => {
          const [b, m] = P(s.x, s.y, u, k, y), F = s.kind === "anchor" ? Z : q;
          return /* @__PURE__ */ d(
            "circle",
            {
              cx: b,
              cy: m,
              r: F,
              fill: s.kind === "anchor" ? "rgba(212,184,240,0.9)" : "rgba(0,0,0,0)",
              stroke: "rgba(212,184,240,0.75)",
              strokeWidth: 1.5,
              style: { cursor: "grab" },
              onPointerDown: (G) => f(G, s.cmdIdx, s.field)
            },
            g
          );
        }),
        t.length === 0 && /* @__PURE__ */ d(
          "text",
          {
            x: v / 2,
            y: v / 2,
            textAnchor: "middle",
            fill: "rgba(255,255,255,0.3)",
            fontSize: 12,
            fontFamily: "sans-serif",
            children: "No outlines for this character"
          }
        )
      ]
    }
  );
}
function ct({
  font: t,
  fontFamily: n,
  text: r = "Typography",
  children: o
}) {
  const [e, a] = T(null), [c, i] = T([]), [x, p] = T([]), k = E(null), S = rt(r), y = x.length > 0;
  function C() {
    if (x.length === 0) return;
    const l = x[x.length - 1];
    p((f) => f.slice(0, -1)), i(l);
  }
  function D(l) {
    p((f) => {
      const w = [...f, l];
      return w.length > B ? w.slice(-B) : w;
    });
  }
  const I = E(C);
  W(() => {
    I.current = C;
  }), W(() => {
    if (!e) return;
    function l(f) {
      (f.metaKey || f.ctrlKey) && !f.shiftKey && f.key === "z" && (f.preventDefault(), I.current());
    }
    return window.addEventListener("keydown", l), () => window.removeEventListener("keydown", l);
  }, [e]);
  function R(l) {
    t && (i(Q(t, l)), a(l), p([]));
  }
  function u() {
    a(null), i([]), p([]);
  }
  function L() {
    if (!t || !e) return;
    Y(t, e, c);
    const l = K(t), f = V(n, l, k.current ?? void 0);
    k.current = f, a(null), i([]), p([]);
  }
  return /* @__PURE__ */ $("div", { children: [
    /* @__PURE__ */ d("div", { style: { fontFamily: n }, children: o ?? /* @__PURE__ */ d("p", { children: r }) }),
    t && /* @__PURE__ */ d(
      "div",
      {
        role: "group",
        "aria-label": "Character palette — click to edit",
        style: { display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "16px" },
        children: S.map((l) => /* @__PURE__ */ d(
          "button",
          {
            onClick: () => R(l),
            "aria-pressed": e === l,
            style: {
              width: 32,
              height: 32,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: n,
              fontSize: 16,
              border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: 4,
              background: e === l ? "rgba(212,184,240,0.15)" : "transparent",
              cursor: "pointer",
              color: "inherit",
              transition: "background 0.15s"
            },
            children: l
          },
          l
        ))
      }
    ),
    e && t && /* @__PURE__ */ $(
      "div",
      {
        style: {
          marginTop: 16,
          padding: 16,
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 8
        },
        children: [
          /* @__PURE__ */ $("p", { style: { fontSize: 11, opacity: 0.5, marginBottom: 12, fontFamily: "sans-serif" }, children: [
            "Editing “",
            e,
            "” — drag filled circles (anchors) or outlined circles (handles) to reshape"
          ] }),
          /* @__PURE__ */ d(
            ot,
            {
              commands: c,
              font: t,
              char: e,
              onChange: i,
              onDragStart: D
            }
          ),
          /* @__PURE__ */ $("div", { style: { display: "flex", gap: 8, marginTop: 12, alignItems: "center" }, children: [
            /* @__PURE__ */ d(
              "button",
              {
                onClick: u,
                style: {
                  fontSize: 12,
                  padding: "4px 12px",
                  borderRadius: 20,
                  border: "1px solid rgba(255,255,255,0.3)",
                  background: "transparent",
                  color: "inherit",
                  opacity: 0.6,
                  cursor: "pointer"
                },
                children: "Cancel"
              }
            ),
            /* @__PURE__ */ d(
              "button",
              {
                onClick: C,
                disabled: !y,
                title: "Undo last drag (Ctrl+Z / Cmd+Z)",
                style: {
                  fontSize: 12,
                  padding: "4px 12px",
                  borderRadius: 20,
                  border: "1px solid rgba(255,255,255,0.3)",
                  background: "transparent",
                  color: "inherit",
                  opacity: y ? 0.7 : 0.25,
                  cursor: y ? "pointer" : "default",
                  transition: "opacity 0.15s"
                },
                children: "Undo"
              }
            ),
            /* @__PURE__ */ d(
              "button",
              {
                onClick: L,
                style: {
                  fontSize: 12,
                  padding: "4px 12px",
                  borderRadius: 20,
                  border: "1px solid rgba(212,184,240,0.7)",
                  background: "rgba(212,184,240,0.1)",
                  color: "inherit",
                  cursor: "pointer",
                  marginLeft: "auto"
                },
                children: "Apply to page"
              }
            )
          ] })
        ]
      }
    ),
    !t && /* @__PURE__ */ d("p", { style: { marginTop: 12, fontSize: 12, opacity: 0.4, fontFamily: "sans-serif" }, children: "No font loaded." })
  ] });
}
export {
  ct as GlyphShaperEditor,
  V as applyFontBlob,
  X as commandsToPathD,
  K as fontToBlob,
  Q as getGlyphCommands,
  N as parseFont,
  st as revokeFont,
  Y as setGlyphCommands,
  lt as useGlyphFont
};

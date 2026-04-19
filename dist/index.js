import { useState as P, useEffect as W, useRef as E, useCallback as A } from "react";
import { jsxs as $, jsx as u } from "react/jsx-runtime";
const j = 2001684018;
function H(t) {
  return t.byteLength < 4 ? !1 : new DataView(t).getUint32(0, !1) === j;
}
async function N(t, e) {
  let r = t;
  if (H(t)) {
    if (!e)
      throw new Error(
        "[glyphshaper] WOFF2 input requires a woff2Decompressor. Pass one to parseFont(), or convert the font to TTF / OTF / WOFF first."
      );
    r = await e(t);
  }
  const { parse: o } = await import("opentype.js");
  let n;
  try {
    n = o(r);
  } catch (l) {
    throw l instanceof Error && /not yet supported|lookup type/i.test(l.message) ? new Error(
      `This font uses an OpenType feature not yet supported by opentype.js (${l.message}). Try a different font — Inter, Roboto, and most system fonts work well.`
    ) : l;
  }
  const s = n.tables;
  return delete s.gsub, delete s.gpos, n.substitution = null, n.position = null, { _font: n };
}
function Q(t, e) {
  var n;
  const r = t._font.charToGlyphIndex(e), o = t._font.glyphs.get(r);
  return (n = o == null ? void 0 : o.path) != null && n.commands ? o.path.commands.map((s) => ({ ...s })) : [];
}
function Y(t, e, r) {
  const o = t._font.charToGlyphIndex(e), n = t._font.glyphs.get(o);
  n != null && n.path && (n.path.commands = r);
}
function K(t) {
  const e = t._font.toArrayBuffer();
  return new Blob([e], { type: "font/opentype" });
}
const M = "glyphshaper-override";
function V(t, e, r, o = {}) {
  var x;
  r && URL.revokeObjectURL(r);
  const n = URL.createObjectURL(e), s = o.fontWeight ?? "normal", l = o.fontStyle ?? "normal";
  (x = document.getElementById(M)) == null || x.remove();
  const i = document.createElement("style");
  return i.id = M, i.textContent = [
    "@font-face {",
    `  font-family: ${JSON.stringify(t)};`,
    `  src: url(${JSON.stringify(n)}) format('opentype');`,
    `  font-weight: ${s};`,
    `  font-style: ${l};`,
    "}"
  ].join(`
`), document.head.appendChild(i), n;
}
function at(t) {
  var e;
  URL.revokeObjectURL(t), (e = document.getElementById(M)) == null || e.remove();
}
function X(t) {
  return t.map((e) => {
    switch (e.type) {
      case "M":
        return `M ${e.x} ${e.y}`;
      case "L":
        return `L ${e.x} ${e.y}`;
      case "C":
        return `C ${e.x1} ${e.y1} ${e.x2} ${e.y2} ${e.x} ${e.y}`;
      case "Q":
        return `Q ${e.x1} ${e.y1} ${e.x} ${e.y}`;
      case "Z":
        return "Z";
    }
  }).join(" ");
}
function lt(t) {
  const [e, r] = P({
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
    r((s) => ({ ...s, loading: !0, error: null }));
    async function n() {
      try {
        let s;
        if (typeof t == "string") {
          const i = await fetch(t);
          if (!i.ok) throw new Error(`HTTP ${i.status} fetching font`);
          s = await i.arrayBuffer();
        } else
          s = await t.arrayBuffer();
        if (o) return;
        const l = await N(s);
        if (o) return;
        r({ font: l, loading: !1, error: null });
      } catch (s) {
        if (o) return;
        r({
          font: null,
          loading: !1,
          error: s instanceof Error ? s.message : "Failed to load font"
        });
      }
    }
    return n(), () => {
      o = !0;
    };
  }, [
    typeof t == "string" ? t : t ? `${t.name}:${t.size}` : null
  ]), e;
}
const m = 360, h = 32, Z = 7, q = 5, U = 50;
function L(t, e, r, o, n) {
  return [
    h + (t - o) * r,
    h + (n - e) * r
  ];
}
function J(t, e, r, o, n) {
  return [
    (t - h) / r + o,
    n - (e - h) / r
  ];
}
function tt(t) {
  const e = [];
  for (let r = 0; r < t.length; r++) {
    const o = t[r];
    o.type === "M" || o.type === "L" ? e.push({ cmdIdx: r, field: "xy", kind: "anchor", x: o.x, y: o.y }) : o.type === "C" ? (e.push({ cmdIdx: r, field: "x1y1", kind: "handle", x: o.x1, y: o.y1 }), e.push({ cmdIdx: r, field: "x2y2", kind: "handle", x: o.x2, y: o.y2 }), e.push({ cmdIdx: r, field: "xy", kind: "anchor", x: o.x, y: o.y })) : o.type === "Q" && (e.push({ cmdIdx: r, field: "x1y1", kind: "handle", x: o.x1, y: o.y1 }), e.push({ cmdIdx: r, field: "xy", kind: "anchor", x: o.x, y: o.y }));
  }
  return e;
}
function et(t) {
  const e = [];
  let r = 0, o = 0;
  for (const n of t)
    n.type === "M" || n.type === "L" ? (r = n.x, o = n.y) : n.type === "C" ? (e.push({ x1: r, y1: o, x2: n.x1, y2: n.y1 }), e.push({ x1: n.x2, y1: n.y2, x2: n.x, y2: n.y }), r = n.x, o = n.y) : n.type === "Q" && (e.push({ x1: r, y1: o, x2: n.x1, y2: n.y1 }), e.push({ x1: n.x1, y1: n.y1, x2: n.x, y2: n.y }), r = n.x, o = n.y);
  return e;
}
function nt(t, e, r, o, n) {
  const s = Math.round(o), l = Math.round(n);
  return t.map((i, x) => x !== e ? i : r === "xy" && (i.type === "M" || i.type === "L") ? { ...i, x: s, y: l } : r === "xy" && (i.type === "C" || i.type === "Q") ? { ...i, x: s, y: l } : r === "x1y1" && (i.type === "C" || i.type === "Q") ? { ...i, x1: s, y1: l } : r === "x2y2" && i.type === "C" ? { ...i, x2: s, y2: l } : i);
}
function rt(t) {
  const e = /* @__PURE__ */ new Set();
  return t.split("").filter((r) => !r.trim() || e.has(r) ? !1 : (e.add(r), !0));
}
function ot({
  commands: t,
  font: e,
  char: r,
  onChange: o,
  onDragStart: n
}) {
  const s = E(null), l = E(null), i = e._font, x = i.charToGlyphIndex(r), p = i.glyphs.get(x), k = (p == null ? void 0 : p.leftSideBearing) ?? 0, I = (p == null ? void 0 : p.advanceWidth) ?? i.unitsPerEm, y = i.ascender, v = i.descender, D = I, S = y - v, T = m - 2 * h, d = Math.min(T / D, T / S), R = h + y * d, c = A((a) => {
    const g = s.current;
    if (!g) return [0, 0];
    const b = g.createSVGPoint();
    b.x = a.clientX, b.y = a.clientY;
    const w = b.matrixTransform(g.getScreenCTM().inverse());
    return J(w.x, w.y, d, k, y);
  }, [d, k, y]);
  function f(a, g, b) {
    a.stopPropagation(), a.target.setPointerCapture(a.pointerId), n(t), l.current = { cmdIdx: g, field: b };
  }
  function C(a) {
    if (!l.current) return;
    const [g, b] = c(a);
    o(nt(t, l.current.cmdIdx, l.current.field, g, b));
  }
  function O() {
    l.current = null;
  }
  const B = X(t), _ = tt(t), z = et(t);
  return /* @__PURE__ */ $(
    "svg",
    {
      ref: s,
      width: "100%",
      viewBox: `0 0 ${m} ${m}`,
      onPointerMove: C,
      onPointerUp: O,
      onPointerLeave: O,
      style: {
        display: "block",
        touchAction: "none",
        cursor: "default",
        // Maintain a 1:1 aspect ratio as width scales with the container
        aspectRatio: "1 / 1"
      },
      "aria-label": `Glyph path editor for character ${r}`,
      children: [
        /* @__PURE__ */ u(
          "line",
          {
            x1: h / 2,
            y1: R,
            x2: m - h / 2,
            y2: R,
            stroke: "rgba(255,255,255,0.08)",
            strokeWidth: 1
          }
        ),
        (() => {
          const [a] = L(I, 0, d, k, y);
          return /* @__PURE__ */ u(
            "line",
            {
              x1: a,
              y1: h / 2,
              x2: a,
              y2: m - h / 2,
              stroke: "rgba(255,255,255,0.08)",
              strokeWidth: 1,
              strokeDasharray: "4 4"
            }
          );
        })(),
        /* @__PURE__ */ u("g", { transform: `translate(${h + (0 - k) * d}, ${h + y * d}) scale(${d}, ${-d})`, children: t.length > 0 && /* @__PURE__ */ u(
          "path",
          {
            d: B,
            fill: "rgba(212,184,240,0.12)",
            stroke: "rgba(212,184,240,0.55)",
            strokeWidth: 2 / d,
            fillRule: "nonzero"
          }
        ) }),
        z.map((a, g) => {
          const [b, w] = L(a.x1, a.y1, d, k, y), [F, G] = L(a.x2, a.y2, d, k, y);
          return /* @__PURE__ */ u(
            "line",
            {
              x1: b,
              y1: w,
              x2: F,
              y2: G,
              stroke: "rgba(255,255,255,0.18)",
              strokeWidth: 1,
              strokeDasharray: "3 3"
            },
            g
          );
        }),
        _.map((a, g) => {
          const [b, w] = L(a.x, a.y, d, k, y), F = a.kind === "anchor" ? Z : q;
          return /* @__PURE__ */ u(
            "circle",
            {
              cx: b,
              cy: w,
              r: F,
              fill: a.kind === "anchor" ? "rgba(212,184,240,0.9)" : "rgba(0,0,0,0)",
              stroke: "rgba(212,184,240,0.75)",
              strokeWidth: 1.5,
              style: { cursor: "grab" },
              onPointerDown: (G) => f(G, a.cmdIdx, a.field)
            },
            g
          );
        }),
        t.length === 0 && /* @__PURE__ */ u(
          "text",
          {
            x: m / 2,
            y: m / 2,
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
  fontFamily: e,
  text: r = "Typography",
  children: o
}) {
  const [n, s] = P(null), [l, i] = P([]), [x, p] = P([]), k = E(null), I = rt(r), y = x.length > 0;
  function v() {
    if (x.length === 0) return;
    const c = x[x.length - 1];
    p((f) => f.slice(0, -1)), i(c);
  }
  function D(c) {
    p((f) => {
      const C = [...f, c];
      return C.length > U ? C.slice(-U) : C;
    });
  }
  const S = E(v);
  W(() => {
    S.current = v;
  }), W(() => {
    if (!n) return;
    function c(f) {
      (f.metaKey || f.ctrlKey) && !f.shiftKey && f.key === "z" && (f.preventDefault(), S.current());
    }
    return window.addEventListener("keydown", c), () => window.removeEventListener("keydown", c);
  }, [n]);
  function T(c) {
    t && (i(Q(t, c)), s(c), p([]));
  }
  function d() {
    s(null), i([]), p([]);
  }
  function R() {
    if (!t || !n) return;
    Y(t, n, l);
    const c = K(t), f = V(e, c, k.current ?? void 0);
    k.current = f, s(null), i([]), p([]);
  }
  return /* @__PURE__ */ $("div", { children: [
    /* @__PURE__ */ u("div", { style: { fontFamily: e }, children: o ?? /* @__PURE__ */ u("p", { children: r }) }),
    t && /* @__PURE__ */ u(
      "div",
      {
        role: "group",
        "aria-label": "Character palette — click to edit",
        style: { display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "16px" },
        children: I.map((c) => /* @__PURE__ */ u(
          "button",
          {
            onClick: () => T(c),
            "aria-pressed": n === c,
            style: {
              width: 32,
              height: 32,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: e,
              fontSize: 16,
              border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: 4,
              background: n === c ? "rgba(212,184,240,0.15)" : "transparent",
              cursor: "pointer",
              color: "inherit",
              transition: "background 0.15s"
            },
            children: c
          },
          c
        ))
      }
    ),
    n && t && /* @__PURE__ */ $(
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
            n,
            "” — drag filled circles (anchors) or outlined circles (handles) to reshape"
          ] }),
          /* @__PURE__ */ u(
            ot,
            {
              commands: l,
              font: t,
              char: n,
              onChange: i,
              onDragStart: D
            }
          ),
          /* @__PURE__ */ $("div", { style: { display: "flex", gap: 8, marginTop: 12, alignItems: "center" }, children: [
            /* @__PURE__ */ u(
              "button",
              {
                onClick: d,
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
            /* @__PURE__ */ u(
              "button",
              {
                onClick: v,
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
            /* @__PURE__ */ u(
              "button",
              {
                onClick: R,
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
    !t && /* @__PURE__ */ u("p", { style: { marginTop: 12, fontSize: 12, opacity: 0.4, fontFamily: "sans-serif" }, children: "No font loaded." })
  ] });
}
export {
  ct as GlyphShaperEditor,
  V as applyFontBlob,
  X as commandsToPathD,
  K as fontToBlob,
  Q as getGlyphCommands,
  N as parseFont,
  at as revokeFont,
  Y as setGlyphCommands,
  lt as useGlyphFont
};

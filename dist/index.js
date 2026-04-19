import { useState as W, useEffect as S, useRef as L, useCallback as H } from "react";
import { jsxs as T, jsx as y } from "react/jsx-runtime";
const N = 2001684018;
function A(t) {
  return t.byteLength < 4 ? !1 : new DataView(t).getUint32(0, !1) === N;
}
async function Q(t, n) {
  let r = t;
  if (A(t)) {
    if (!n)
      throw new Error(
        "[glyphshaper] WOFF2 input requires a woff2Decompressor. Pass one to parseFont(), or convert the font to TTF / OTF / WOFF first."
      );
    r = await n(t);
  }
  const { parse: o } = await import("opentype.js");
  let e;
  try {
    e = o(r);
  } catch (l) {
    throw l instanceof Error && /not yet supported|lookup type/i.test(l.message) ? new Error(
      `This font uses an OpenType feature not yet supported by opentype.js (${l.message}). Try a different font — Inter, Roboto, and most system fonts work well.`
    ) : l;
  }
  const i = e.tables;
  return delete i.gsub, delete i.gpos, e.substitution = null, e.position = null, { _font: e };
}
function z(t, n) {
  var e;
  const r = t._font.charToGlyphIndex(n), o = t._font.glyphs.get(r);
  return (e = o == null ? void 0 : o.path) != null && e.commands ? o.path.commands.map((i) => ({ ...i })) : [];
}
function Y(t, n, r) {
  const o = t._font.charToGlyphIndex(n), e = t._font.glyphs.get(o);
  e != null && e.path && (e.path.commands = r);
}
function K(t) {
  const n = t._font.toArrayBuffer();
  return new Blob([n], { type: "font/opentype" });
}
const _ = "glyphshaper-override";
function V(t, n, r, o = {}) {
  var u;
  r && URL.revokeObjectURL(r);
  const e = URL.createObjectURL(n), i = o.fontWeight ?? "normal", l = o.fontStyle ?? "normal";
  (u = document.getElementById(_)) == null || u.remove();
  const s = document.createElement("style");
  return s.id = _, s.textContent = [
    "@font-face {",
    `  font-family: ${JSON.stringify(t)};`,
    `  src: url(${JSON.stringify(e)}) format('opentype');`,
    `  font-weight: ${i};`,
    `  font-style: ${l};`,
    "}"
  ].join(`
`), document.head.appendChild(s), e;
}
function at(t) {
  var n;
  URL.revokeObjectURL(t), (n = document.getElementById(_)) == null || n.remove();
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
  const [n, r] = W({
    font: null,
    loading: !1,
    error: null
  });
  return S(() => {
    if (!t) {
      r({ font: null, loading: !1, error: null });
      return;
    }
    let o = !1;
    r((i) => ({ ...i, loading: !0, error: null }));
    async function e() {
      try {
        let i;
        if (typeof t == "string") {
          const s = await fetch(t);
          if (!s.ok) throw new Error(`HTTP ${s.status} fetching font`);
          i = await s.arrayBuffer();
        } else
          i = await t.arrayBuffer();
        if (o) return;
        const l = await Q(i);
        if (o) return;
        r({ font: l, loading: !1, error: null });
      } catch (i) {
        if (o) return;
        r({
          font: null,
          loading: !1,
          error: i instanceof Error ? i.message : "Failed to load font"
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
const $ = 360, x = 32, Z = 7, q = 5, j = 50;
function G(t, n, r, o, e) {
  return [
    x + (t - o) * r,
    x + (e - n) * r
  ];
}
function J(t, n, r, o, e) {
  return [
    (t - x) / r + o,
    e - (n - x) / r
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
  const i = Math.round(o), l = Math.round(e);
  return t.map((s, u) => u !== n ? s : r === "xy" && (s.type === "M" || s.type === "L") ? { ...s, x: i, y: l } : r === "xy" && (s.type === "C" || s.type === "Q") ? { ...s, x: i, y: l } : r === "x1y1" && (s.type === "C" || s.type === "Q") ? { ...s, x1: i, y1: l } : r === "x2y2" && s.type === "C" ? { ...s, x2: i, y2: l } : s);
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
  const i = L(null), l = L(null), s = n._font, u = s.charToGlyphIndex(r), h = s.glyphs.get(u), g = (h == null ? void 0 : h.leftSideBearing) ?? 0, k = (h == null ? void 0 : h.advanceWidth) ?? s.unitsPerEm, f = s.ascender, w = s.descender, C = k, E = f - w, P = $ - 2 * x, d = Math.min(P / C, P / E), I = x + f * d, M = H((a) => {
    const b = i.current;
    if (!b) return [0, 0];
    const m = b.getScreenCTM();
    if (!m) return [0, 0];
    const v = b.createSVGPoint();
    v.x = a.clientX, v.y = a.clientY;
    const R = v.matrixTransform(m.inverse());
    return J(R.x, R.y, d, g, f);
  }, [d, g, f]);
  function D(a, b, m) {
    a.stopPropagation(), a.target.setPointerCapture(a.pointerId), e(t), l.current = { cmdIdx: b, field: m };
  }
  function O(a) {
    if (!l.current) return;
    const [b, m] = M(a);
    o(et(t, l.current.cmdIdx, l.current.field, b, m));
  }
  function F() {
    l.current = null;
  }
  const U = X(t), c = tt(t), p = nt(t);
  return /* @__PURE__ */ T(
    "svg",
    {
      ref: i,
      width: "100%",
      viewBox: `0 0 ${$} ${$}`,
      onPointerMove: O,
      onPointerUp: F,
      onPointerLeave: F,
      style: {
        display: "block",
        touchAction: "none",
        cursor: "default",
        // Maintain a 1:1 aspect ratio as width scales with the container
        aspectRatio: "1 / 1"
      },
      "aria-label": `Glyph path editor for character ${r}`,
      children: [
        /* @__PURE__ */ y(
          "line",
          {
            x1: x / 2,
            y1: I,
            x2: $ - x / 2,
            y2: I,
            stroke: "rgba(255,255,255,0.08)",
            strokeWidth: 1
          }
        ),
        (() => {
          const [a] = G(k, 0, d, g, f);
          return /* @__PURE__ */ y(
            "line",
            {
              x1: a,
              y1: x / 2,
              x2: a,
              y2: $ - x / 2,
              stroke: "rgba(255,255,255,0.08)",
              strokeWidth: 1,
              strokeDasharray: "4 4"
            }
          );
        })(),
        /* @__PURE__ */ y("g", { transform: `translate(${x + (0 - g) * d}, ${x + f * d}) scale(${d}, ${-d})`, children: t.length > 0 && /* @__PURE__ */ y(
          "path",
          {
            d: U,
            fill: "rgba(212,184,240,0.12)",
            stroke: "rgba(212,184,240,0.55)",
            strokeWidth: 2 / d,
            fillRule: "nonzero"
          }
        ) }),
        p.map((a, b) => {
          const [m, v] = G(a.x1, a.y1, d, g, f), [R, B] = G(a.x2, a.y2, d, g, f);
          return /* @__PURE__ */ y(
            "line",
            {
              x1: m,
              y1: v,
              x2: R,
              y2: B,
              stroke: "rgba(255,255,255,0.18)",
              strokeWidth: 1,
              strokeDasharray: "3 3"
            },
            b
          );
        }),
        c.map((a, b) => {
          const [m, v] = G(a.x, a.y, d, g, f), R = a.kind === "anchor" ? Z : q;
          return /* @__PURE__ */ y(
            "circle",
            {
              cx: m,
              cy: v,
              r: R,
              fill: a.kind === "anchor" ? "rgba(212,184,240,0.9)" : "rgba(0,0,0,0)",
              stroke: "rgba(212,184,240,0.75)",
              strokeWidth: 1.5,
              style: { cursor: "grab" },
              onPointerDown: (B) => D(B, a.cmdIdx, a.field)
            },
            b
          );
        }),
        t.length === 0 && /* @__PURE__ */ y(
          "text",
          {
            x: $ / 2,
            y: $ / 2,
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
  children: o,
  selectedChar: e,
  onClose: i,
  onApply: l,
  hidePalette: s = !1
}) {
  const [u, h] = W(null), [g, k] = W([]), [f, w] = W([]), C = L(null), E = L(null), P = rt(r), d = f.length > 0;
  S(() => {
    E.current = u;
  }, [u]), S(() => {
    if (e === void 0 || !t) return;
    const c = E.current;
    e === null ? c !== null && (h(null), k([]), w([])) : e !== c && (k(z(t, e)), h(e), w([]));
  }, [e, t]);
  function I() {
    if (f.length === 0) return;
    const c = f[f.length - 1];
    w((p) => p.slice(0, -1)), k(c);
  }
  function M(c) {
    w((p) => {
      const a = [...p, c];
      return a.length > j ? a.slice(-j) : a;
    });
  }
  const D = L(I);
  S(() => {
    D.current = I;
  }), S(() => {
    if (!u) return;
    function c(p) {
      (p.metaKey || p.ctrlKey) && !p.shiftKey && p.key === "z" && (p.preventDefault(), D.current());
    }
    return window.addEventListener("keydown", c), () => window.removeEventListener("keydown", c);
  }, [u]);
  function O(c) {
    t && (k(z(t, c)), h(c), w([]));
  }
  function F() {
    h(null), k([]), w([]), i == null || i();
  }
  function U() {
    if (!t || !u) return;
    Y(t, u, g);
    const c = K(t), p = V(n, c, C.current ?? void 0);
    C.current = p, l == null || l(u, [...g]), h(null), k([]), w([]), i == null || i();
  }
  return /* @__PURE__ */ T("div", { children: [
    (o != null || !s) && /* @__PURE__ */ y("div", { style: { fontFamily: n }, children: o ?? /* @__PURE__ */ y("p", { children: r }) }),
    t && !s && /* @__PURE__ */ y(
      "div",
      {
        role: "group",
        "aria-label": "Character palette — click to edit",
        style: { display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "16px" },
        children: P.map((c) => /* @__PURE__ */ y(
          "button",
          {
            onClick: () => O(c),
            "aria-pressed": u === c,
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
              background: u === c ? "rgba(212,184,240,0.15)" : "transparent",
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
    u && t && /* @__PURE__ */ T(
      "div",
      {
        style: {
          marginTop: 16,
          padding: 16,
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 8
        },
        children: [
          /* @__PURE__ */ T("p", { style: { fontSize: 11, opacity: 0.5, marginBottom: 12, fontFamily: "sans-serif" }, children: [
            "Editing “",
            u,
            "” — drag filled circles (anchors) or outlined circles (handles) to reshape"
          ] }),
          /* @__PURE__ */ y(
            ot,
            {
              commands: g,
              font: t,
              char: u,
              onChange: k,
              onDragStart: M
            }
          ),
          /* @__PURE__ */ T("div", { style: { display: "flex", gap: 8, marginTop: 12, alignItems: "center" }, children: [
            /* @__PURE__ */ y(
              "button",
              {
                onClick: F,
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
            /* @__PURE__ */ y(
              "button",
              {
                onClick: I,
                disabled: !d,
                title: "Undo last drag (Ctrl+Z / Cmd+Z)",
                style: {
                  fontSize: 12,
                  padding: "4px 12px",
                  borderRadius: 20,
                  border: "1px solid rgba(255,255,255,0.3)",
                  background: "transparent",
                  color: "inherit",
                  opacity: d ? 0.7 : 0.25,
                  cursor: d ? "pointer" : "default",
                  transition: "opacity 0.15s"
                },
                children: "Undo"
              }
            ),
            /* @__PURE__ */ y(
              "button",
              {
                onClick: U,
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
    !t && /* @__PURE__ */ y("p", { style: { marginTop: 12, fontSize: 12, opacity: 0.4, fontFamily: "sans-serif" }, children: "No font loaded." })
  ] });
}
export {
  ct as GlyphShaperEditor,
  V as applyFontBlob,
  X as commandsToPathD,
  K as fontToBlob,
  z as getGlyphCommands,
  Q as parseFont,
  at as revokeFont,
  Y as setGlyphCommands,
  lt as useGlyphFont
};

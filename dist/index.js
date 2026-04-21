import { useState as D, useEffect as R, useRef as M, useCallback as N } from "react";
import { jsxs as T, jsx as f } from "react/jsx-runtime";
const Q = 2001684018;
function A(t) {
  return t.byteLength < 4 ? !1 : new DataView(t).getUint32(0, !1) === Q;
}
async function X(t, n) {
  let o = t;
  if (A(t)) {
    if (!n)
      throw new Error(
        "[glyphshaper] WOFF2 input requires a woff2Decompressor. Pass one to parseFont(), or convert the font to TTF / OTF / WOFF first."
      );
    o = await n(t);
  }
  const { parse: r } = await import("opentype.js");
  let e;
  try {
    e = r(o);
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
  const o = t._font.charToGlyphIndex(n), r = t._font.glyphs.get(o);
  return (e = r == null ? void 0 : r.path) != null && e.commands ? r.path.commands.map((i) => ({ ...i })) : [];
}
function j(t) {
  let n = 1 / 0, o = -1 / 0;
  for (const r of t) {
    if (r.type === "Z") continue;
    const e = r.type === "C" ? [r.x1, r.x2, r.x] : r.type === "Q" ? [r.x1, r.x] : [r.x];
    for (const i of e)
      i < n && (n = i), i > o && (o = i);
  }
  return n === 1 / 0 ? null : { xMin: n, xMax: o };
}
function Y(t, n, o) {
  const r = t._font.charToGlyphIndex(n), e = t._font.glyphs.get(r);
  if (!(e != null && e.path)) return;
  const i = j(e.path.commands), l = i !== null ? (e.advanceWidth ?? 0) - i.xMax : 0;
  if (e.path.commands = o, e.advanceWidth !== void 0) {
    const a = j(o);
    a !== null && (e.leftSideBearing = Math.round(a.xMin), e.advanceWidth = Math.max(0, Math.round(a.xMax + l)));
  }
}
function Z(t) {
  const n = t._font.toArrayBuffer();
  return new Blob([n], { type: "font/opentype" });
}
const _ = "glyphshaper-override";
function K(t, n, o, r = {}) {
  var u;
  o && URL.revokeObjectURL(o);
  const e = URL.createObjectURL(n), i = r.fontWeight ?? "normal", l = r.fontStyle ?? "normal";
  (u = document.getElementById(_)) == null || u.remove();
  const a = document.createElement("style");
  return a.id = _, a.textContent = [
    "@font-face {",
    `  font-family: ${JSON.stringify(t)};`,
    `  src: url(${JSON.stringify(e)}) format('opentype');`,
    `  font-weight: ${i};`,
    `  font-style: ${l};`,
    "}"
  ].join(`
`), document.head.appendChild(a), e;
}
function lt(t) {
  var n;
  URL.revokeObjectURL(t), (n = document.getElementById(_)) == null || n.remove();
}
function V(t) {
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
function ct(t) {
  const [n, o] = D({
    font: null,
    loading: !1,
    error: null
  });
  return R(() => {
    if (!t) {
      o({ font: null, loading: !1, error: null });
      return;
    }
    let r = !1;
    o((i) => ({ ...i, loading: !0, error: null }));
    async function e() {
      try {
        let i;
        if (typeof t == "string") {
          const a = await fetch(t);
          if (!a.ok) throw new Error(`HTTP ${a.status} fetching font`);
          i = await a.arrayBuffer();
        } else
          i = await t.arrayBuffer();
        if (r) return;
        const l = await X(i);
        if (r) return;
        o({ font: l, loading: !1, error: null });
      } catch (i) {
        if (r) return;
        o({
          font: null,
          loading: !1,
          error: i instanceof Error ? i.message : "Failed to load font"
        });
      }
    }
    return e(), () => {
      r = !0;
    };
  }, [
    typeof t == "string" ? t : t ? `${t.name}:${t.size}` : null
  ]), n;
}
const $ = 360, x = 32, q = 7, J = 5, H = 50;
function B(t, n, o, r, e) {
  return [
    x + (t - r) * o,
    x + (e - n) * o
  ];
}
function tt(t, n, o, r, e) {
  return [
    (t - x) / o + r,
    e - (n - x) / o
  ];
}
function nt(t) {
  const n = [];
  for (let o = 0; o < t.length; o++) {
    const r = t[o];
    r.type === "M" || r.type === "L" ? n.push({ cmdIdx: o, field: "xy", kind: "anchor", x: r.x, y: r.y }) : r.type === "C" ? (n.push({ cmdIdx: o, field: "x1y1", kind: "handle", x: r.x1, y: r.y1 }), n.push({ cmdIdx: o, field: "x2y2", kind: "handle", x: r.x2, y: r.y2 }), n.push({ cmdIdx: o, field: "xy", kind: "anchor", x: r.x, y: r.y })) : r.type === "Q" && (n.push({ cmdIdx: o, field: "x1y1", kind: "handle", x: r.x1, y: r.y1 }), n.push({ cmdIdx: o, field: "xy", kind: "anchor", x: r.x, y: r.y }));
  }
  return n;
}
function et(t) {
  const n = [];
  let o = 0, r = 0;
  for (const e of t)
    e.type === "M" || e.type === "L" ? (o = e.x, r = e.y) : e.type === "C" ? (n.push({ x1: o, y1: r, x2: e.x1, y2: e.y1 }), n.push({ x1: e.x2, y1: e.y2, x2: e.x, y2: e.y }), o = e.x, r = e.y) : e.type === "Q" && (n.push({ x1: o, y1: r, x2: e.x1, y2: e.y1 }), n.push({ x1: e.x1, y1: e.y1, x2: e.x, y2: e.y }), o = e.x, r = e.y);
  return n;
}
function rt(t, n, o, r, e) {
  const i = Math.round(r), l = Math.round(e);
  return t.map((a, u) => u !== n ? a : o === "xy" && (a.type === "M" || a.type === "L") ? { ...a, x: i, y: l } : o === "xy" && (a.type === "C" || a.type === "Q") ? { ...a, x: i, y: l } : o === "x1y1" && (a.type === "C" || a.type === "Q") ? { ...a, x1: i, y1: l } : o === "x2y2" && a.type === "C" ? { ...a, x2: i, y2: l } : a);
}
function ot(t) {
  const n = /* @__PURE__ */ new Set();
  return t.split("").filter((o) => !o.trim() || n.has(o) ? !1 : (n.add(o), !0));
}
function it({
  commands: t,
  font: n,
  char: o,
  onChange: r,
  onDragStart: e
}) {
  const i = M(null), l = M(null), a = n._font, u = a.charToGlyphIndex(o), h = a.glyphs.get(u), g = (h == null ? void 0 : h.leftSideBearing) ?? 0, k = (h == null ? void 0 : h.advanceWidth) ?? a.unitsPerEm, y = a.ascender, v = a.descender, C = k, L = y - v, E = $ - 2 * x, d = Math.min(E / C, E / L), I = x + y * d, F = N((s) => {
    const b = i.current;
    if (!b) return [0, 0];
    const m = b.getScreenCTM();
    if (!m) return [0, 0];
    const w = b.createSVGPoint();
    w.x = s.clientX, w.y = s.clientY;
    const S = w.matrixTransform(m.inverse());
    return tt(S.x, S.y, d, g, y);
  }, [d, g, y]);
  function P(s, b, m) {
    s.stopPropagation(), s.target.setPointerCapture(s.pointerId), e(t), l.current = { cmdIdx: b, field: m };
  }
  function G(s) {
    if (!l.current) return;
    const [b, m] = F(s);
    r(rt(t, l.current.cmdIdx, l.current.field, b, m));
  }
  function W() {
    l.current = null;
  }
  const O = V(t), c = nt(t), p = et(t);
  return /* @__PURE__ */ T(
    "svg",
    {
      ref: i,
      width: "100%",
      viewBox: `0 0 ${$} ${$}`,
      onPointerMove: G,
      onPointerUp: W,
      onPointerLeave: W,
      style: {
        display: "block",
        touchAction: "none",
        cursor: "default",
        // Maintain a 1:1 aspect ratio as width scales with the container
        aspectRatio: "1 / 1"
      },
      "aria-label": `Glyph path editor for character ${o}`,
      children: [
        /* @__PURE__ */ f(
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
          const [s] = B(k, 0, d, g, y);
          return /* @__PURE__ */ f(
            "line",
            {
              x1: s,
              y1: x / 2,
              x2: s,
              y2: $ - x / 2,
              stroke: "rgba(255,255,255,0.08)",
              strokeWidth: 1,
              strokeDasharray: "4 4"
            }
          );
        })(),
        /* @__PURE__ */ f("g", { transform: `translate(${x + (0 - g) * d}, ${x + y * d}) scale(${d}, ${-d})`, children: t.length > 0 && /* @__PURE__ */ f(
          "path",
          {
            d: O,
            fill: "rgba(212,184,240,0.12)",
            stroke: "rgba(212,184,240,0.55)",
            strokeWidth: 2 / d,
            fillRule: "nonzero"
          }
        ) }),
        p.map((s, b) => {
          const [m, w] = B(s.x1, s.y1, d, g, y), [S, U] = B(s.x2, s.y2, d, g, y);
          return /* @__PURE__ */ f(
            "line",
            {
              x1: m,
              y1: w,
              x2: S,
              y2: U,
              stroke: "rgba(255,255,255,0.18)",
              strokeWidth: 1,
              strokeDasharray: "3 3"
            },
            b
          );
        }),
        c.map((s, b) => {
          const [m, w] = B(s.x, s.y, d, g, y), S = s.kind === "anchor" ? q : J;
          return /* @__PURE__ */ f(
            "circle",
            {
              cx: m,
              cy: w,
              r: S,
              fill: s.kind === "anchor" ? "rgba(212,184,240,0.9)" : "rgba(0,0,0,0)",
              stroke: "rgba(212,184,240,0.75)",
              strokeWidth: 1.5,
              style: { cursor: "grab" },
              onPointerDown: (U) => P(U, s.cmdIdx, s.field)
            },
            b
          );
        }),
        t.length === 0 && /* @__PURE__ */ f(
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
function ut({
  font: t,
  fontFamily: n,
  text: o = "Typography",
  children: r,
  selectedChar: e,
  onClose: i,
  onApply: l,
  hidePalette: a = !1
}) {
  const [u, h] = D(null), [g, k] = D([]), [y, v] = D([]), C = M(null), L = M(null), E = ot(o), d = y.length > 0;
  R(() => {
    L.current = u;
  }, [u]), R(() => {
    if (e === void 0 || !t) return;
    const c = L.current;
    e === null ? c !== null && (h(null), k([]), v([])) : e !== c && (k(z(t, e)), h(e), v([]));
  }, [e, t]);
  function I() {
    if (y.length === 0) return;
    const c = y[y.length - 1];
    v((p) => p.slice(0, -1)), k(c);
  }
  function F(c) {
    v((p) => {
      const s = [...p, c];
      return s.length > H ? s.slice(-H) : s;
    });
  }
  const P = M(I);
  R(() => {
    P.current = I;
  }), R(() => {
    if (!u) return;
    function c(p) {
      (p.metaKey || p.ctrlKey) && !p.shiftKey && p.key === "z" && (p.preventDefault(), P.current());
    }
    return window.addEventListener("keydown", c), () => window.removeEventListener("keydown", c);
  }, [u]);
  function G(c) {
    t && (k(z(t, c)), h(c), v([]));
  }
  function W() {
    h(null), k([]), v([]), i == null || i();
  }
  function O() {
    if (!t || !u) return;
    Y(t, u, g);
    const c = Z(t), p = K(n, c, C.current ?? void 0);
    C.current = p, l == null || l(u, [...g]), h(null), k([]), v([]), i == null || i();
  }
  return /* @__PURE__ */ T("div", { children: [
    (r != null || !a) && /* @__PURE__ */ f("div", { style: { fontFamily: n }, children: r ?? /* @__PURE__ */ f("p", { children: o }) }),
    t && !a && /* @__PURE__ */ f(
      "div",
      {
        role: "group",
        "aria-label": "Character palette — click to edit",
        style: { display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "16px" },
        children: E.map((c) => /* @__PURE__ */ f(
          "button",
          {
            onClick: () => G(c),
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
          /* @__PURE__ */ f(
            it,
            {
              commands: g,
              font: t,
              char: u,
              onChange: k,
              onDragStart: F
            }
          ),
          /* @__PURE__ */ T("div", { style: { display: "flex", gap: 8, marginTop: 12, alignItems: "center" }, children: [
            /* @__PURE__ */ f(
              "button",
              {
                onClick: W,
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
            /* @__PURE__ */ f(
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
            /* @__PURE__ */ f(
              "button",
              {
                onClick: O,
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
    !t && /* @__PURE__ */ f("p", { style: { marginTop: 12, fontSize: 12, opacity: 0.4, fontFamily: "sans-serif" }, children: "No font loaded." })
  ] });
}
export {
  ut as GlyphShaperEditor,
  it as GlyphSvgEditor,
  K as applyFontBlob,
  V as commandsToPathD,
  Z as fontToBlob,
  z as getGlyphCommands,
  X as parseFont,
  lt as revokeFont,
  Y as setGlyphCommands,
  ct as useGlyphFont
};

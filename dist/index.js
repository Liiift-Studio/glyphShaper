import { useState as F, useEffect as R, useRef as C, useCallback as N } from "react";
import { jsxs as M, jsx as d } from "react/jsx-runtime";
const V = 2001684018;
function Y(t) {
  return t.byteLength < 4 ? !1 : new DataView(t).getUint32(0, !1) === V;
}
async function Q(t, n) {
  let o = t;
  if (Y(t)) {
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
  } catch (a) {
    throw a instanceof Error && /not yet supported|lookup type/i.test(a.message) ? new Error(
      `This font uses an OpenType feature not yet supported by opentype.js (${a.message}). Try a different font — Inter, Roboto, and most system fonts work well.`
    ) : a;
  }
  const i = e.tables;
  return delete i.gsub, delete i.gpos, e.substitution = null, e.position = null, !!i.fvar && typeof console < "u" && console.warn(
    "[glyphshaper] This font has variable-font axes (fvar table). After applyFontBlob() the injected override is a static snapshot — opentype.js does not re-serialise gvar/fvar/avar/HVAR/MVAR/STAT. CSS font-variation-settings will have no effect on the overridden family."
  ), { _font: e };
}
function z(t, n) {
  var e;
  const o = t._font.charToGlyphIndex(n);
  if (o === 0) return [];
  const r = t._font.glyphs.get(o);
  return (e = r == null ? void 0 : r.path) != null && e.commands ? r.path.commands.map((i) => ({ ...i })) : [];
}
function _(t) {
  let n = 1 / 0, o = -1 / 0;
  for (const r of t) {
    if (r.type === "Z") continue;
    const e = r.type === "C" ? [r.x1, r.x2, r.x] : r.type === "Q" ? [r.x1, r.x] : [r.x];
    for (const i of e)
      i < n && (n = i), i > o && (o = i);
  }
  return n === 1 / 0 ? null : { xMin: n, xMax: o };
}
function X(t, n, o) {
  const r = t._font.charToGlyphIndex(n);
  if (r === 0) return;
  const e = t._font.glyphs.get(r);
  if (!(e != null && e.path)) return;
  const i = _(e.path.commands), c = i !== null ? (e.advanceWidth ?? 0) - i.xMax : 0;
  if (e.path.commands = o, e.advanceWidth !== void 0) {
    const a = _(o);
    a !== null && (e.leftSideBearing = Math.round(a.xMin), e.advanceWidth = Math.max(0, Math.round(a.xMax + c)));
  }
}
function Z(t) {
  const n = t._font.toArrayBuffer();
  return new Blob([n], { type: "font/opentype" });
}
const O = "glyphshaper-override";
function j(t) {
  return t.replace(/[^a-zA-Z0-9 .\-]/g, "");
}
function K(t, n, o, r = {}) {
  var y;
  o && URL.revokeObjectURL(o);
  const e = URL.createObjectURL(n), i = j(String(r.fontWeight ?? "normal")), c = j(String(r.fontStyle ?? "normal")), a = typeof window < "u" ? window.scrollY : 0;
  (y = document.getElementById(O)) == null || y.remove();
  const u = document.createElement("style");
  return u.id = O, u.textContent = [
    "@font-face {",
    `  font-family: ${JSON.stringify(t)};`,
    `  src: url(${JSON.stringify(e)}) format('opentype');`,
    `  font-weight: ${i};`,
    `  font-style: ${c};`,
    "  font-display: swap;",
    "}"
  ].join(`
`), document.head.appendChild(u), typeof window < "u" && requestAnimationFrame(() => {
    Math.abs(window.scrollY - a) > 2 && window.scrollTo({ top: a, behavior: "instant" });
  }), e;
}
function q(t) {
  var n;
  URL.revokeObjectURL(t), (n = document.getElementById(O)) == null || n.remove();
}
function J(t) {
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
      default:
        return "";
    }
  }).filter(Boolean).join(" ");
}
function ut(t) {
  const [n, o] = F({
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
        const c = await Q(i);
        if (r) return;
        o({ font: c, loading: !1, error: null });
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
const S = 360, g = 32, tt = 7, nt = 5, H = 50;
function D(t, n, o, r, e) {
  return [
    g + (t - r) * o,
    g + (e - n) * o
  ];
}
function et(t, n, o, r, e) {
  return [
    (t - g) / o + r,
    e - (n - g) / o
  ];
}
function rt(t) {
  const n = [];
  for (let o = 0; o < t.length; o++) {
    const r = t[o];
    r.type === "M" || r.type === "L" ? n.push({ cmdIdx: o, field: "xy", kind: "anchor", x: r.x, y: r.y }) : r.type === "C" ? (n.push({ cmdIdx: o, field: "x1y1", kind: "handle", x: r.x1, y: r.y1 }), n.push({ cmdIdx: o, field: "x2y2", kind: "handle", x: r.x2, y: r.y2 }), n.push({ cmdIdx: o, field: "xy", kind: "anchor", x: r.x, y: r.y })) : r.type === "Q" && (n.push({ cmdIdx: o, field: "x1y1", kind: "handle", x: r.x1, y: r.y1 }), n.push({ cmdIdx: o, field: "xy", kind: "anchor", x: r.x, y: r.y }));
  }
  return n;
}
function ot(t) {
  const n = [];
  let o = 0, r = 0;
  for (const e of t)
    e.type === "M" || e.type === "L" ? (o = e.x, r = e.y) : e.type === "C" ? (n.push({ x1: o, y1: r, x2: e.x1, y2: e.y1 }), n.push({ x1: e.x2, y1: e.y2, x2: e.x, y2: e.y }), o = e.x, r = e.y) : e.type === "Q" && (n.push({ x1: o, y1: r, x2: e.x1, y2: e.y1 }), n.push({ x1: e.x1, y1: e.y1, x2: e.x, y2: e.y }), o = e.x, r = e.y);
  return n;
}
function it(t, n, o, r, e) {
  const i = Math.round(r), c = Math.round(e);
  return t.map((a, u) => u !== n ? a : o === "xy" && (a.type === "M" || a.type === "L") ? { ...a, x: i, y: c } : o === "xy" && (a.type === "C" || a.type === "Q") ? { ...a, x: i, y: c } : o === "x1y1" && (a.type === "C" || a.type === "Q") ? { ...a, x1: i, y1: c } : o === "x2y2" && a.type === "C" ? { ...a, x2: i, y2: c } : a);
}
function at(t) {
  const n = /* @__PURE__ */ new Set();
  return t.split("").filter((o) => !o.trim() || n.has(o) ? !1 : (n.add(o), !0));
}
function st({
  commands: t,
  font: n,
  char: o,
  onChange: r,
  onDragStart: e
}) {
  const i = C(null), c = C(null), a = n._font, u = a.charToGlyphIndex(o), y = a.glyphs.get(u), b = (y == null ? void 0 : y.leftSideBearing) ?? 0, v = (y == null ? void 0 : y.advanceWidth) ?? a.unitsPerEm, h = a.ascender, m = a.descender, k = v, E = h - m, P = S - 2 * g, f = Math.min(P / k, P / E), T = g + h * f, W = N((s) => {
    const p = i.current;
    if (!p) return [0, 0];
    const w = p.getScreenCTM();
    if (!w) return [0, 0];
    const $ = p.createSVGPoint();
    $.x = s.clientX, $.y = s.clientY;
    const I = $.matrixTransform(w.inverse());
    return et(I.x, I.y, f, b, h);
  }, [f, b, h]);
  function L(s, p, w) {
    s.isPrimary && (s.stopPropagation(), s.target.setPointerCapture(s.pointerId), e(t), c.current = { cmdIdx: p, field: w });
  }
  function A(s) {
    if (!c.current) return;
    const [p, w] = W(s);
    r(it(t, c.current.cmdIdx, c.current.field, p, w));
  }
  function B() {
    c.current = null;
  }
  const G = J(t), l = rt(t), x = ot(t);
  return /* @__PURE__ */ M(
    "svg",
    {
      ref: i,
      width: "100%",
      viewBox: `0 0 ${S} ${S}`,
      onPointerMove: A,
      onPointerUp: B,
      onPointerLeave: B,
      style: {
        display: "block",
        touchAction: "none",
        cursor: "default",
        // Maintain a 1:1 aspect ratio as width scales with the container
        aspectRatio: "1 / 1"
      },
      "aria-label": `Glyph path editor for character ${o}`,
      children: [
        /* @__PURE__ */ d(
          "line",
          {
            x1: g / 2,
            y1: T,
            x2: S - g / 2,
            y2: T,
            stroke: "rgba(255,255,255,0.08)",
            strokeWidth: 1
          }
        ),
        (() => {
          const [s] = D(v, 0, f, b, h);
          return /* @__PURE__ */ d(
            "line",
            {
              x1: s,
              y1: g / 2,
              x2: s,
              y2: S - g / 2,
              stroke: "rgba(255,255,255,0.08)",
              strokeWidth: 1,
              strokeDasharray: "4 4"
            }
          );
        })(),
        /* @__PURE__ */ d("g", { transform: `translate(${g + (0 - b) * f}, ${g + h * f}) scale(${f}, ${-f})`, children: t.length > 0 && /* @__PURE__ */ d(
          "path",
          {
            d: G,
            fill: "rgba(212,184,240,0.12)",
            stroke: "rgba(212,184,240,0.55)",
            strokeWidth: 2 / f,
            fillRule: "nonzero"
          }
        ) }),
        x.map((s, p) => {
          const [w, $] = D(s.x1, s.y1, f, b, h), [I, U] = D(s.x2, s.y2, f, b, h);
          return /* @__PURE__ */ d(
            "line",
            {
              x1: w,
              y1: $,
              x2: I,
              y2: U,
              stroke: "rgba(255,255,255,0.18)",
              strokeWidth: 1,
              strokeDasharray: "3 3"
            },
            p
          );
        }),
        l.map((s, p) => {
          const [w, $] = D(s.x, s.y, f, b, h), I = s.kind === "anchor" ? tt : nt;
          return /* @__PURE__ */ d(
            "circle",
            {
              role: "button",
              "aria-label": `${s.kind === "anchor" ? "Anchor" : "Handle"} point ${p + 1} of ${l.length}`,
              tabIndex: 0,
              cx: w,
              cy: $,
              r: I,
              fill: s.kind === "anchor" ? "rgba(212,184,240,0.9)" : "rgba(0,0,0,0)",
              stroke: "rgba(212,184,240,0.75)",
              strokeWidth: 1.5,
              style: { cursor: "grab" },
              onPointerDown: (U) => L(U, s.cmdIdx, s.field)
            },
            p
          );
        }),
        t.length === 0 && /* @__PURE__ */ d(
          "text",
          {
            x: S / 2,
            y: S / 2,
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
function ft({
  font: t,
  fontFamily: n,
  text: o = "Typography",
  children: r,
  selectedChar: e,
  onClose: i,
  onApply: c,
  hidePalette: a = !1
}) {
  const [u, y] = F(null), [b, v] = F([]), [h, m] = F([]), k = C(null), E = C(null), P = at(o), f = h.length > 0;
  R(() => () => {
    k.current && (q(k.current), k.current = null);
  }, []), R(() => {
    E.current = u;
  }, [u]), R(() => {
    if (e === void 0 || !t) return;
    const l = E.current;
    e === null ? l !== null && (y(null), v([]), m([])) : e !== l && (v(z(t, e)), y(e), m([]));
  }, [e, t]);
  function T() {
    if (h.length === 0) return;
    const l = h[h.length - 1];
    m((x) => x.slice(0, -1)), v(l);
  }
  function W(l) {
    m((x) => {
      const s = [...x, l];
      return s.length > H ? s.slice(-H) : s;
    });
  }
  const L = C(T);
  R(() => {
    L.current = T;
  }), R(() => {
    if (!u) return;
    function l(x) {
      var p;
      const s = (p = x.target) == null ? void 0 : p.tagName;
      s === "INPUT" || s === "TEXTAREA" || (x.metaKey || x.ctrlKey) && !x.shiftKey && x.key === "z" && (x.preventDefault(), L.current());
    }
    return window.addEventListener("keydown", l), () => window.removeEventListener("keydown", l);
  }, [u]);
  function A(l) {
    t && (v(z(t, l)), y(l), m([]));
  }
  function B() {
    y(null), v([]), m([]), i == null || i();
  }
  function G() {
    if (!t || !u) return;
    X(t, u, b);
    const l = Z(t), x = K(n, l, k.current ?? void 0);
    k.current = x, c == null || c(u, [...b]), y(null), v([]), m([]), i == null || i();
  }
  return /* @__PURE__ */ M("div", { children: [
    (r != null || !a) && /* @__PURE__ */ d("div", { style: { fontFamily: n }, children: r ?? /* @__PURE__ */ d("p", { children: o }) }),
    t && !a && /* @__PURE__ */ d(
      "div",
      {
        role: "group",
        "aria-label": "Character palette — click to edit",
        style: { display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "16px" },
        children: P.map((l) => /* @__PURE__ */ d(
          "button",
          {
            onClick: () => A(l),
            "aria-pressed": u === l,
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
              background: u === l ? "rgba(212,184,240,0.15)" : "transparent",
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
    u && t && /* @__PURE__ */ M(
      "div",
      {
        style: {
          marginTop: 16,
          padding: 16,
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 8
        },
        children: [
          /* @__PURE__ */ M("p", { style: { fontSize: 11, opacity: 0.5, marginBottom: 12, fontFamily: "sans-serif" }, children: [
            "Editing “",
            u,
            "” — drag filled circles (anchors) or outlined circles (handles) to reshape"
          ] }),
          /* @__PURE__ */ d(
            st,
            {
              commands: b,
              font: t,
              char: u,
              onChange: v,
              onDragStart: W
            }
          ),
          /* @__PURE__ */ M("div", { style: { display: "flex", gap: 8, marginTop: 12, alignItems: "center" }, children: [
            /* @__PURE__ */ d(
              "button",
              {
                onClick: B,
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
                onClick: T,
                disabled: !f,
                title: "Undo last drag (Ctrl+Z / Cmd+Z)",
                style: {
                  fontSize: 12,
                  padding: "4px 12px",
                  borderRadius: 20,
                  border: "1px solid rgba(255,255,255,0.3)",
                  background: "transparent",
                  color: "inherit",
                  opacity: f ? 0.7 : 0.25,
                  cursor: f ? "pointer" : "default",
                  transition: "opacity 0.15s"
                },
                children: "Undo"
              }
            ),
            /* @__PURE__ */ d(
              "button",
              {
                onClick: G,
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
  ft as GlyphShaperEditor,
  st as GlyphSvgEditor,
  K as applyFontBlob,
  J as commandsToPathD,
  Z as fontToBlob,
  z as getGlyphCommands,
  Q as parseFont,
  q as revokeFont,
  X as setGlyphCommands,
  ut as useGlyphFont
};

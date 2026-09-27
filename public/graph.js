/* ============================================================
   GRAPH — grafo de dependencias del hero (canvas 2D, sin librerías)
   Capas como un call graph: autor → proyectos → frameworks → lenguajes
   → infra. Cada arista sale de la pila declarada de cada proyecto en
   data.js (mainProjects[].stack). Los pulsos son "llamadas" que se
   propagan de nodo en nodo. Respeta prefers-reduced-motion (grafo
   estático) y se pausa fuera de pantalla o con la pestaña oculta.
   ============================================================ */
(function () {
  "use strict";
  var zone = document.getElementById("graphZone");
  var canvas = document.getElementById("heroGraph");
  if (!zone || !canvas || !canvas.getContext) return;
  /* Opus: swap visible .graph-ph placeholder for live canvas (reserved box was never empty void) */
  zone.classList.add("is-live");
  var ph = document.getElementById("graphPh");
  if (ph) ph.setAttribute("hidden", "");
  var ctx = canvas.getContext("2d");
  if (!ctx) return;
  var traceEl = document.getElementById("graphTraceV");
  var reduce = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  var PADX = 36, PADY = 28; // el lienzo desborda la zona para que el brillo no se corte

  var RGB = {
    root: [246, 241, 232],
    proj: [240, 200, 135],
    fw: [111, 211, 196],
    lang: [169, 158, 224],
    infra: [229, 138, 96]
  };
  var KINDS = ["root", "proj", "fw", "lang", "infra"];
  var TXT = {
    es: {
      head: ["main()", "// proyectos", "// frameworks · libs", "// lenguajes · runtime", "// infra · datos"],
      kind: { root: "Engineer", proj: "Project", fw: "Framework", lang: "Language", infra: "Infra" },
      uses: "usa", usedBy: "usado por"
    },
    en: {
      head: ["main()", "// projects", "// frameworks · libs", "// languages · runtime", "// infra · data"],
      kind: { root: "Engineer", proj: "Project", fw: "Framework", lang: "Language", infra: "Infra" },
      uses: "uses", usedBy: "used by"
    }
  };
  var lang = document.documentElement.lang === "en" ? "en" : "es";

  /* m: se conserva en el grafo compacto (móvil) */
  var NODES = [
    { id: "root", l: "@stevenvo780", k: "root", m: 1 },
    { id: "cauce", l: "cauce-v3", k: "proj", m: 1 },
    { id: "agora", l: "agora", k: "proj", m: 1 },
    { id: "humanizar", l: "humanizar", k: "proj", m: 1 },
    { id: "st", l: "st-lang", k: "proj", m: 1 },
    { id: "autologic", l: "auto.logic", k: "proj", m: 1 },
    { id: "epo", l: "preontologicas", k: "proj", m: 1 },
    { id: "mcp", l: "MCP", k: "fw", m: 1 },
    { id: "llm", l: "multi-LLM", k: "fw", m: 1 },
    { id: "next", l: "Next.js", k: "fw", m: 1 },
    { id: "react", l: "React", k: "fw" },
    { id: "redux", l: "Redux", k: "fw" },
    { id: "express", l: "Express", k: "fw", m: 1 },
    { id: "socket", l: "socket.io", k: "fw" },
    { id: "zod", l: "Zod", k: "fw" },
    { id: "nest", l: "NestJS", k: "fw", m: 1 },
    { id: "typeorm", l: "TypeORM", k: "fw" },
    { id: "sat", l: "SAT · CDCL", k: "fw", m: 1 },
    { id: "torch", l: "PyTorch", k: "fw", m: 1 },
    { id: "numpy", l: "numpy · scipy", k: "fw" },
    { id: "ts", l: "TypeScript", k: "lang", m: 1 },
    { id: "node", l: "Node.js", k: "lang", m: 1 },
    { id: "py", l: "Python", k: "lang", m: 1 },
    { id: "cuda", l: "CUDA", k: "lang" },
    { id: "pg", l: "PostgreSQL", k: "infra", m: 1 },
    { id: "mysql", l: "MySQL", k: "infra" },
    { id: "redis", l: "Redis", k: "infra", m: 1 },
    { id: "docker", l: "Docker", k: "infra", m: 1 },
    { id: "run", l: "Cloud Run", k: "infra", m: 1 }
  ];
  var EDGES = [
    ["root", "cauce"], ["root", "agora"], ["root", "humanizar"], ["root", "st"], ["root", "autologic"], ["root", "epo"],
    // Cauce V3: orquestación agéntica · servidores MCP · multi-LLM (stack de Agentes/MCP)
    ["cauce", "mcp"], ["cauce", "llm"],
    // Ágora: Next.js 15 · React 18 · Redux · Express/TypeScript (Cloud Run) · socket.io · Docker PTY · Zod · MCP
    ["agora", "next"], ["agora", "react"], ["agora", "redux"], ["agora", "express"], ["agora", "socket"],
    ["agora", "zod"], ["agora", "mcp"], ["agora", "run"], ["agora", "docker"],
    // Humanizar: NestJS · TypeORM · PostgreSQL · MySQL · Redis · Next.js · React 18 PWA
    ["humanizar", "nest"], ["humanizar", "typeorm"], ["humanizar", "next"], ["humanizar", "react"],
    ["humanizar", "pg"], ["humanizar", "mysql"], ["humanizar", "redis"],
    // ST: TypeScript · SAT solver CDCL
    ["st", "sat"], ["st", "ts"],
    // auto.logic: TypeScript
    ["autologic", "ts"],
    // Estructuras Pre-Ontológicas: Python · numpy/scipy · PyTorch/CUDA
    ["epo", "torch"], ["epo", "numpy"], ["epo", "py"],
    // dependencias propias de cada tecnología
    ["nest", "ts"], ["nest", "node"], ["typeorm", "ts"], ["next", "node"], ["express", "node"], ["express", "ts"],
    ["socket", "node"], ["zod", "ts"], ["sat", "ts"], ["torch", "py"], ["torch", "cuda"], ["numpy", "py"]
  ];

  var byId = {};
  NODES.forEach(function (n, i) { n.ph = i * 1.37; n.f = 0; byId[n.id] = n; });

  /* ---------- estado ---------- */
  var nodes = [], edges = [], OUT = {}, IN = {};
  var W = 0, H = 0, dpr = 1, vertical = false, lastW = -1, lastMode = null;
  var headers = [];
  var pulses = [];
  var hover = null, hoverSet = null;
  var running = false, visible = true, raf = 0, lastTs = 0, clock = 0, nextFire = 0.6, booted = false;
  var lastTraceAt = -10;
  var minFrame = 0;
  var FONT = "500 11px 'JetBrains Mono', ui-monospace, monospace";
  var FONT_H = "400 10px 'JetBrains Mono', ui-monospace, monospace";

  /* ---------- sprites de brillo (mucho más baratos que shadowBlur) ---------- */
  var sprites = {};
  KINDS.forEach(function (k) {
    var c = document.createElement("canvas");
    c.width = c.height = 64;
    var g = c.getContext("2d");
    var rg = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    var v = RGB[k];
    rg.addColorStop(0, "rgba(" + v + ",1)");
    rg.addColorStop(0.25, "rgba(" + v + ",0.55)");
    rg.addColorStop(1, "rgba(" + v + ",0)");
    g.fillStyle = rg;
    g.fillRect(0, 0, 64, 64);
    sprites[k] = c;
  });

  function rgba(k, a) { var v = RGB[k]; return "rgba(" + v[0] + "," + v[1] + "," + v[2] + "," + a + ")"; }

  function rr(x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) { ctx.roundRect(x, y, w, h, r); return; }
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  /* ---------- layout por capas (heurística de baricentro, a lo Sugiyama) ---------- */
  function layout() {
    var r = zone.getBoundingClientRect();
    var w = Math.round(r.width);
    if (!w) return false;
    var mode = w < 620 ? "v" : "h";
    if (mode === "v" && w === lastW && lastMode === "v") return false;
    if (mode !== lastMode && mode === "h") zone.style.height = "";
    lastW = w; lastMode = mode; vertical = mode === "v";

    nodes = NODES.filter(function (n) { return !vertical || n.m; });
    var keep = {}; nodes.forEach(function (n) { keep[n.id] = 1; });
    edges = [];
    OUT = {}; IN = {};
    nodes.forEach(function (n) { OUT[n.id] = []; IN[n.id] = []; });
    EDGES.forEach(function (p) {
      if (!keep[p[0]] || !keep[p[1]]) return;
      var e = { s: byId[p[0]], t: byId[p[1]], len: 100 };
      edges.push(e); OUT[p[0]].push(e); IN[p[1]].push(e);
    });

    ctx.font = FONT;
    nodes.forEach(function (n) { n.w = Math.ceil(ctx.measureText(n.l).width) + 28; n.h = 22; });

    var layers = KINDS.map(function (k) { return nodes.filter(function (n) { return n.k === k; }); });
    // orden por baricentro de los padres
    layers.forEach(function (L, li) {
      L.forEach(function (n, i) { n.ord = (i + 0.5) / L.length; });
      if (li < 2) return;
      L.forEach(function (n) {
        var ps = IN[n.id]; if (!ps.length) { n.bary = n.ord; return; }
        var s = 0; ps.forEach(function (e) { s += e.s.ord; }); n.bary = s / ps.length;
      });
      L.sort(function (a, b) { return a.bary - b.bary; });
      L.forEach(function (n, i) { n.ord = (i + 0.5) / L.length; });
    });

    headers = [];
    if (!vertical) {
      // En la rejilla de dos columnas la altura la da el hero; apilado (una columna) la fija el grafo.
      var stacked = window.matchMedia && window.matchMedia("(max-width: 1100px)").matches;
      if (stacked) {
        /* Opus: floor 400 ≡ CSS clamp(400px,52vw,500px) — was 340 (vertical LH +60 push lineage) */
        H = Math.round(Math.min(500, Math.max(400, w * 0.52)));
        zone.style.height = H + "px";
      } else {
        if (zone.style.height) zone.style.height = "";
        H = Math.max(300, Math.round(zone.getBoundingClientRect().height));
      }
      W = w;
      var top = 34, bottom = H - 10;
      var rootW = layers[0][0].w;
      var lastMax = Math.max.apply(null, layers[4].map(function (n) { return n.w; }));
      var x0 = rootW / 2 + 2, x4 = W - lastMax / 2 - 2;
      layers.forEach(function (L, li) {
        var x = x0 + (x4 - x0) * (li / 4);
        var avail = bottom - top;
        var sp = Math.min(li === 0 ? 0 : 50, avail / Math.max(1, L.length));
        var start = top + (avail - sp * (L.length - 1)) / 2;
        L.forEach(function (n, i) { n.bx = x; n.by = L.length === 1 ? top + avail / 2 : start + sp * i; });
        headers.push({ x: x, y: 12, a: "center", li: li });
      });
    } else {
      W = w;
      var y = 6, gap = 8, rowH = 32;
      layers.forEach(function (L, li) {
        headers.push({ x: 0, y: y + 6, a: "left", li: li });
        y += 22;
        var rows = [], cur = [], cw = 0;
        L.forEach(function (n) {
          if (cur.length && cw + gap + n.w > W) { rows.push(cur); cur = []; cw = 0; }
          cw += (cur.length ? gap : 0) + n.w; cur.push(n);
        });
        if (cur.length) rows.push(cur);
        rows.forEach(function (row) {
          var tw = row.reduce(function (s, n) { return s + n.w; }, 0) + gap * (row.length - 1);
          var x = (W - tw) / 2;
          row.forEach(function (n) { n.bx = x + n.w / 2; n.by = y + 11; x += n.w + gap; });
          y += rowH;
        });
        y += 12;
      });
      H = Math.round(y);
      /* Opus: CSS already reserves final H (400@LH412). Only grow — never shrink; inject = layout no-op when reserve ≥ H. */
      var reserved = Math.round(zone.getBoundingClientRect().height);
      if (H > reserved) zone.style.height = H + "px";
    }

    dpr = Math.min(window.devicePixelRatio || 1, 2);
    minFrame = (vertical || (navigator.hardwareConcurrency || 8) <= 4) ? 1000 / 32 : 0;
    canvas.width = Math.round((W + PADX * 2) * dpr);
    canvas.height = Math.round((H + PADY * 2) * dpr);
    if (vertical) { canvas.style.height = (H + PADY * 2) + "px"; }
    else { canvas.style.height = ""; }
    nodes.forEach(function (n) { n.x = n.bx; n.y = n.by; });
    edges.forEach(function (e) { geom(e); e.len = approxLen(e); });
    return true;
  }

  /* ---------- geometría de aristas (bezier cúbica) ---------- */
  function geom(e) {
    var s = e.s, t = e.t;
    if (!vertical) {
      e.x0 = s.x + s.w / 2; e.y0 = s.y; e.x3 = t.x - t.w / 2; e.y3 = t.y;
      var dx = (e.x3 - e.x0) * 0.5;
      e.x1 = e.x0 + dx; e.y1 = e.y0; e.x2 = e.x3 - dx; e.y2 = e.y3;
    } else {
      e.x0 = s.x; e.y0 = s.y + s.h / 2; e.x3 = t.x; e.y3 = t.y - t.h / 2;
      var dy = (e.y3 - e.y0) * 0.5;
      e.x1 = e.x0; e.y1 = e.y0 + dy; e.x2 = e.x3; e.y2 = e.y3 - dy;
    }
  }
  function pt(e, u) {
    var v = 1 - u, a = v * v * v, b = 3 * v * v * u, c = 3 * v * u * u, d = u * u * u;
    return [a * e.x0 + b * e.x1 + c * e.x2 + d * e.x3, a * e.y0 + b * e.y1 + c * e.y2 + d * e.y3];
  }
  function approxLen(e) {
    var L = 0, p = pt(e, 0);
    for (var i = 1; i <= 10; i++) { var q = pt(e, i / 10); L += Math.hypot(q[0] - p[0], q[1] - p[1]); p = q; }
    return Math.max(20, L);
  }

  /* ---------- propagación de "llamadas" ---------- */
  function spawn(e, path, wait) {
    if (pulses.length > 70) return;
    pulses.push({ e: e, u: 0, wait: wait || 0, path: path, v: 150 + Math.random() * 60 });
  }
  function emit(n, path) {
    var outs = OUT[n.id];
    if (!outs || !outs.length) { reportTrace(path); return; }
    var chosen = outs.filter(function () { return Math.random() < 0.45; });
    if (!chosen.length) chosen = [outs[Math.floor(Math.random() * outs.length)]];
    chosen.forEach(function (e, i) { spawn(e, path, i * 0.09); });
  }
  function reportTrace(path) {
    if (!traceEl || hover || clock - lastTraceAt < 1.6) return;
    lastTraceAt = clock;
    var txt = path.map(function (id) { return byId[id].l; }).join("  →  ");
    traceEl.classList.add("is-swap");
    setTimeout(function () { traceEl.textContent = txt; traceEl.classList.remove("is-swap"); }, 220);
  }

  /* ---------- hover: resalta ancestros y descendientes ---------- */
  function closure(n) {
    var set = {}; set[n.id] = 1;
    var q = [n];
    while (q.length) { var a = q.shift(); (OUT[a.id] || []).forEach(function (e) { if (!set[e.t.id]) { set[e.t.id] = 1; q.push(e.t); } }); }
    q = [n];
    while (q.length) { var b = q.shift(); (IN[b.id] || []).forEach(function (e) { if (!set[e.s.id]) { set[e.s.id] = 1; q.push(e.s); } }); }
    return set;
  }
  function inspect(n) {
    if (!traceEl) return;
    var T = TXT[lang];
    var ins = (IN[n.id] || []).map(function (e) { return e.s.l; });
    var outs = (OUT[n.id] || []).map(function (e) { return e.t.l; });
    var s = n.l + ": " + T.kind[n.k];
    if (outs.length) s += "   " + T.uses + " → " + outs.join(", ");
    else if (ins.length) s += "   " + T.usedBy + " ← " + ins.join(", ");
    traceEl.classList.remove("is-swap");
    traceEl.textContent = s;
  }
  function hit(mx, my) {
    for (var i = nodes.length - 1; i >= 0; i--) {
      var n = nodes[i];
      if (Math.abs(mx - n.x) <= n.w / 2 + 4 && Math.abs(my - n.y) <= n.h / 2 + 5) return n;
    }
    return null;
  }
  canvas.addEventListener("pointermove", function (ev) {
    var r = zone.getBoundingClientRect();
    var n = hit(ev.clientX - r.left, ev.clientY - r.top);
    if (n === hover) return;
    hover = n; hoverSet = n ? closure(n) : null;
    canvas.style.cursor = n && n.k === "proj" ? "pointer" : "";
    if (n) { n.f = 1; inspect(n); }
    if (!running) draw();
  });
  canvas.addEventListener("pointerleave", function () {
    hover = null; hoverSet = null; canvas.style.cursor = "";
    if (!running) draw();
  });
  canvas.addEventListener("click", function (ev) {
    var r = zone.getBoundingClientRect();
    var n = hit(ev.clientX - r.left, ev.clientY - r.top);
    if (n && n.k === "proj") {
      var t = document.getElementById("projects");
      if (t) t.scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
    }
  });

  /* ---------- dibujo ---------- */
  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, PADX * dpr, PADY * dpr);
    ctx.clearRect(-PADX, -PADY, W + PADX * 2, H + PADY * 2);
    var T = TXT[lang];

    // cabeceras de capa, como comentarios de código
    ctx.font = FONT_H;
    ctx.textBaseline = "middle";
    headers.forEach(function (h) {
      ctx.textAlign = h.a;
      ctx.fillStyle = h.li === 0 ? "rgba(224,168,94,0.75)" : "rgba(143,163,168,0.62)";
      ctx.fillText(T.head[h.li], h.x, h.y);
    });

    // aristas
    ctx.lineWidth = 1;
    edges.forEach(function (e) {
      var on = hoverSet && hoverSet[e.s.id] && hoverSet[e.t.id];
      var a = hoverSet ? (on ? 0.75 : 0.04) : 0.2;
      var g = ctx.createLinearGradient(e.x0, e.y0, e.x3, e.y3);
      g.addColorStop(0, rgba(e.s.k, a));
      g.addColorStop(1, rgba(e.t.k, a * 0.8));
      ctx.strokeStyle = g;
      ctx.lineWidth = on ? 1.4 : 1;
      ctx.beginPath();
      ctx.moveTo(e.x0, e.y0);
      ctx.bezierCurveTo(e.x1, e.y1, e.x2, e.y2, e.x3, e.y3);
      ctx.stroke();
    });

    // pulsos (luz aditiva)
    ctx.globalCompositeOperation = "lighter";
    pulses.forEach(function (p) {
      if (p.wait > 0) return;
      var dim = hoverSet && !(hoverSet[p.e.s.id] && hoverSet[p.e.t.id]) ? 0.2 : 1;
      var k = p.e.t.k;
      for (var j = 5; j >= 0; j--) {
        var u = p.u - j * 0.028;
        if (u < 0) continue;
        var q = pt(p.e, u);
        var s = j === 0 ? 22 : 12 - j * 1.4;
        ctx.globalAlpha = (j === 0 ? 0.95 : 0.5 - j * 0.07) * dim;
        ctx.drawImage(sprites[k], q[0] - s / 2, q[1] - s / 2, s, s);
      }
    });
    ctx.globalAlpha = 1;

    // brillo de nodos recién "llamados"
    nodes.forEach(function (n) {
      if (n.f < 0.03) return;
      ctx.globalAlpha = n.f * (hoverSet && !hoverSet[n.id] ? 0.15 : 0.5);
      ctx.drawImage(sprites[n.k], n.x - n.w / 2 - 22, n.y - 34, n.w + 44, 68);
    });
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";

    // chips de nodo
    ctx.font = FONT;
    ctx.textAlign = "left";
    nodes.forEach(function (n) {
      var dimmed = hoverSet && !hoverSet[n.id];
      var hl = hoverSet && hoverSet[n.id];
      ctx.globalAlpha = dimmed ? 0.28 : 1;
      var x0 = n.x - n.w / 2, y0 = n.y - n.h / 2;
      rr(x0, y0, n.w, n.h, 6);
      ctx.fillStyle = n.k === "root" ? "rgba(20,30,33,0.96)" : "rgba(6,11,13,0.92)";
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = rgba(n.k, Math.min(1, (n.k === "root" ? 0.6 : 0.3) + n.f * 0.6 + (hl ? 0.35 : 0)));
      ctx.stroke();
      // puerto
      ctx.fillStyle = rgba(n.k, 0.95);
      ctx.beginPath(); ctx.arc(x0 + 10, n.y, 2.6, 0, Math.PI * 2); ctx.fill();
      // etiqueta
      var ta = 0.72 + n.f * 0.28 + (hl ? 0.28 : 0);
      ctx.fillStyle = n.k === "root" ? "rgba(246,241,232,1)" : "rgba(232,224,212," + Math.min(1, ta) + ")";
      ctx.fillText(n.l, x0 + 18, n.y + 0.5);
    });
    ctx.globalAlpha = 1;

    // anotación de tipo: raíz siempre, y el nodo bajo el puntero
    ctx.font = FONT_H;
    var r0 = nodes[0];
    if (r0 && r0.k === "root") {
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(111,211,196,0.8)";
      ctx.fillText(": " + T.kind.root, r0.x, r0.y + r0.h / 2 + 12);
    }
    if (hover && hover.k !== "root") {
      ctx.textAlign = "center";
      var label = ": " + T.kind[hover.k];
      var tw = ctx.measureText(label).width + 12;
      var ty = hover.y - hover.h / 2 - 12;
      rr(hover.x - tw / 2, ty - 8, tw, 16, 4);
      ctx.fillStyle = "rgba(5,9,11,0.92)"; ctx.fill();
      ctx.strokeStyle = rgba(hover.k, 0.6); ctx.stroke();
      ctx.fillStyle = rgba(hover.k, 1);
      ctx.fillText(label, hover.x, ty + 0.5);
    }
  }

  /* ---------- bucle ---------- */
  function tick(ts) {
    raf = 0;
    if (!running) return;
    // En pantallas pequeñas o equipos modestos basta con ~30 fps: la mitad de trabajo de raster.
    if (minFrame && lastTs && ts - lastTs < minFrame) { raf = requestAnimationFrame(tick); return; }
    var dt = lastTs ? Math.min(0.05, (ts - lastTs) / 1000) : 0.016;
    lastTs = ts;
    clock += dt;

    // flotación suave
    nodes.forEach(function (n) {
      var amp = n.k === "root" ? 0 : 1.6;
      if (vertical) { n.x = n.bx + Math.sin(clock * 0.7 + n.ph) * amp * 0.6; n.y = n.by; }
      else { n.x = n.bx; n.y = n.by + Math.sin(clock * 0.7 + n.ph) * amp; }
      n.f *= Math.pow(0.12, dt); // decae el destello
    });
    edges.forEach(geom);

    // arranque: todos los proyectos a la vez; luego una llamada cada 1,2–2 s
    var rootN = byId.root;
    if (!booted) {
      booted = true;
      rootN.f = 1;
      (OUT.root || []).forEach(function (e, i) { spawn(e, ["root"], 0.15 + i * 0.12); });
      nextFire = clock + 3.2;
    } else if (clock >= nextFire) {
      var outs = OUT.root || [];
      if (outs.length) { rootN.f = 1; spawn(outs[Math.floor(Math.random() * outs.length)], ["root"], 0); }
      if (Math.random() < 0.35 && outs.length) spawn(outs[Math.floor(Math.random() * outs.length)], ["root"], 0.25);
      nextFire = clock + 1.2 + Math.random() * 0.8;
    }

    for (var i = pulses.length - 1; i >= 0; i--) {
      var p = pulses[i];
      if (p.wait > 0) { p.wait -= dt; continue; }
      p.u += (p.v * dt) / p.e.len;
      if (p.u >= 1) {
        pulses.splice(i, 1);
        p.e.t.f = 1;
        emit(p.e.t, p.path.concat(p.e.t.id));
      }
    }

    draw();
    raf = requestAnimationFrame(tick);
  }

  function start() {
    if (reduce || running || !visible || document.hidden) return;
    running = true; lastTs = 0;
    raf = requestAnimationFrame(tick);
  }
  function stop() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  function relayout() {
    if (layout() || !running) draw();
  }

  var pendingLayout = 0;
  function scheduleLayout() {
    if (pendingLayout) return;
    pendingLayout = requestAnimationFrame(function () { pendingLayout = 0; lastW = -1; relayout(); });
  }

  // Inicio
  layout();
  draw();
  if (document.fonts && document.fonts.load) {
    document.fonts.load(FONT).then(function () { lastW = -1; relayout(); }, function () {});
  }
  if ("ResizeObserver" in window) {
    var lastSize = "";
    new ResizeObserver(function (entries) {
      var cr = entries[0].contentRect;
      var key = Math.round(cr.width) + "x" + (vertical ? "" : Math.round(cr.height));
      if (key === lastSize) return;
      lastSize = key;
      scheduleLayout();
    }).observe(zone);
  } else {
    window.addEventListener("resize", scheduleLayout);
  }
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (en) {
      visible = en[0].isIntersecting;
      if (visible) start(); else stop();
    }, { threshold: 0.02 }).observe(zone);
  }
  document.addEventListener("visibilitychange", function () { if (document.hidden) stop(); else start(); });
  start();

  window.CVGraph = {
    setLang: function (l) {
      lang = l === "en" ? "en" : "es";
      if (!running) draw();
    }
  };
})();

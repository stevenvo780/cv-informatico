/* ============================================================
   APP — render + ES/EN toggle (vanilla JS, no build step)
   Todo el contenido sale de data.js; aquí solo cambia la forma:
   editor que se escribe, branch graph de git, terminal, etc.
   ============================================================ */
(function () {
  "use strict";
  var D = window.CV_DATA;
  var lang = "es";
  var booted = false;
  var root = document.documentElement;
  root.classList.add("js");
  var reduceMotion = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  /* Rótulos de interfaz propios del rediseño (no son datos de la trayectoria) */
  var UI2 = {
    es: {
      ecoHome: "Inicio", ecoTech: "CV Informático", ecoPhilo: "CV Filósofo",
      ecoServices: "Servicios", ecoBlog: "Blog · Scholḗ", menu: "Menú",
      laneMain: "main · empleo y contratos", laneOwn: "own · proyecto propio y freelance",
      codeOk: "✓ 0 problemas", tech: "Tecnologías", techCount: "tecnologías",
      commit: "commit"
    },
    en: {
      ecoHome: "Home", ecoTech: "Tech CV", ecoPhilo: "Philosophy CV",
      ecoServices: "Services", ecoBlog: "Blog · Scholḗ", menu: "Menu",
      laneMain: "main · employment & contracts", laneOwn: "own · own venture & freelance",
      codeOk: "✓ 0 problems", tech: "Technologies", techCount: "technologies",
      commit: "commit"
    }
  };

  function el(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function pick(v) {
    if (v && typeof v === "object" && (("es" in v) || ("en" in v))) return v[lang];
    return v;
  }
  function t(key) {
    var a = UI2[lang][key];
    return a != null ? a : D.ui[lang][key];
  }
  function pad2(n) { return (n < 10 ? "0" : "") + n; }
  // Qualitative level mapping (no percentages shown): >=85 Advanced, 60-84 Intermediate, <60 Familiar
  function lvlBand(n) {
    if (n >= 85) return "advanced";
    if (n >= 60) return "intermediate";
    return "familiar";
  }
  function safeUrl(u) {
    // Allow http(s), mailto. Otherwise drop href.
    return /^(https?:|mailto:)/i.test(u) ? u : "#";
  }
  // Hash decorativo de 7 hex (FNV-1a) para el branch graph: no es un dato, solo forma.
  function hash7(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return ("0000000" + (h >>> 0).toString(16)).slice(-7);
  }

  /* ---------- i18n for [data-i18n] static nodes ---------- */
  function applyI18n() {
    document.querySelectorAll("[data-i18n]").forEach(function (n) {
      var v = t(n.getAttribute("data-i18n"));
      if (v != null) n.textContent = v;
    });
    root.lang = lang;
  }

  /* ---------- Download buttons swap by language ---------- */
  function applyDownloads() {
    var cv = "pdf/CV_tech_" + lang + ".pdf";
    var ats = "pdf/CV_tech_ats_" + lang + ".pdf";
    ["dl-cv", "dl-cv2"].forEach(function (id) { var n = el(id); if (n) n.setAttribute("href", cv); });
    ["dl-ats", "dl-ats2"].forEach(function (id) { var n = el(id); if (n) n.setAttribute("href", ats); });
    var ai = "pdf/CV_ai_" + lang + ".pdf";
    ["dl-ai", "dl-ai2"].forEach(function (id) { var n = el(id); if (n) n.setAttribute("href", ai); });
  }

  /* ---------- Hero: steven.ts que se escribe solo ---------- */
  var typing = null;
  function codeLines() {
    var u = D.ui[lang];
    var stack = ["Node.js", "NestJS", "PostgreSQL", "Docker", "Linux", "GCP"];
    var arr = [["tk-o", "["]];
    stack.forEach(function (s, i) {
      arr.push(["tk-s", '"' + s + '"']);
      arr.push(["tk-o", i < stack.length - 1 ? ", " : ""]);
    });
    arr.push(["tk-o", "],"]);
    function prop(k, v) { return [["", "  "], ["tk-p", k], ["tk-o", ": "], ["tk-s", '"' + v + '"'], ["tk-o", ","]]; }
    return [
      [["tk-k", "const "], ["tk-t", "steven"], ["tk-o", ": "], ["tk-t", "Engineer"], ["tk-o", " = {"]],
      prop("role", u.role),
      prop("location", u.heroChipLoc),
      prop("experience", u.heroChipExp),
      prop("availability", u.heroChipRemote),
      [["", "  "], ["tk-p", "stack"], ["tk-o", ": "]].concat(arr),
      [["tk-o", "};"]],
      [["tk-k", "export default "], ["tk-t", "steven"], ["tk-o", ";"]]
    ];
  }
  function renderCode(animate) {
    var host = el("heroCode"), status = el("heroCodeStatus");
    if (!host) return;
    if (typing) { cancelAnimationFrame(typing); typing = null; }
    var lines = codeLines();
    status.textContent = t("codeOk");
    // Render final state (so the box has its final height, and no-anim path is done)
    host.style.minHeight = "";
    host.innerHTML = lines.map(function (ln) {
      var indent = ln[0][1] === "  " ? " ln-in" : "";
      return '<span class="ln' + indent + '">' + ln.map(function (tk) {
        return tk[0] ? '<span class="' + tk[0] + '">' + esc(tk[1]) + "</span>" : esc(tk[1]);
      }).join("") + "</span>";
    }).join("");
    if (!animate || reduceMotion) { status.classList.add("is-on"); return; }
    host.style.minHeight = host.offsetHeight + "px";
    status.classList.remove("is-on");

    // Build a typing script: [lineEl, spanEl(or null), text]
    host.innerHTML = "";
    var script = [];
    lines.forEach(function (ln) {
      var lineEl = document.createElement("span");
      lineEl.className = "ln" + (ln[0][1] === "  " ? " ln-in" : "");
      host.appendChild(lineEl);
      ln.forEach(function (tk) {
        var target;
        if (tk[0]) { target = document.createElement("span"); target.className = tk[0]; }
        else { target = document.createElement("span"); }
        script.push({ line: lineEl, node: target, text: tk[1] });
      });
    });
    var caret = document.createElement("span");
    caret.className = "type-caret";
    var i = 0, c = 0, last = 0, cps = 95, acc = 0, curLine = null;
    function step(ts) {
      if (!last) last = ts;
      acc += (ts - last) / 1000 * cps; last = ts;
      while (acc >= 1 && i < script.length) {
        var s = script[i];
        if (c === 0) {
          s.line.appendChild(s.node);
          if (curLine !== s.line) {
            if (curLine) curLine.classList.remove("is-cur");
            curLine = s.line; curLine.classList.add("is-cur");
          }
        }
        if (c < s.text.length) { s.node.textContent += s.text.charAt(c); c++; acc -= 1; }
        if (c >= s.text.length) { i++; c = 0; }
        s.node.after(caret);
      }
      if (i < script.length) { typing = requestAnimationFrame(step); }
      else {
        typing = null;
        if (curLine) curLine.classList.remove("is-cur");
        caret.remove();
        var last2 = host.lastChild; if (last2) last2.appendChild(caret);
        status.classList.add("is-on");
      }
    }
    typing = requestAnimationFrame(function (ts) { last = ts; setTimeout(function () { typing = requestAnimationFrame(step); }, 450); });
  }

  /* ---------- Epigraphs ---------- */
  function renderEpigraphs() {
    el("epigraphs").innerHTML = D.epigraphs[lang]
      .map(function (e) { return '<p class="epigraph"><span>“' + esc(e) + '”</span></p>'; }).join("");
  }

  /* ---------- Capabilities ---------- */
  function renderCapabilities() {
    el("capabilities").innerHTML = D.capabilities[lang].map(function (c, i) {
      return '<div class="cap-card card glow reveal"><span class="cap-idx">mod.' + pad2(i + 1) + "</span><h4>" +
        esc(c.h) + "</h4><p>" + esc(c.p) + "</p></div>";
    }).join("");
  }

  /* ---------- Stack summary (tree) ---------- */
  function renderStack() {
    var rows = D.stack[lang];
    el("stackSummary").innerHTML = rows.map(function (r, i) {
      var br = i === rows.length - 1 ? "└──" : "├──";
      return '<div class="stack-row"><span class="br" aria-hidden="true">' + br + "</span><b>" + esc(r.k) +
        "</b><span class=\"v\">" + esc(r.v) + "</span></div>";
    }).join("");
  }

  /* ---------- Skills (grouped by qualitative level, no percentages) ---------- */
  function renderSkills() {
    var dict = D.ui[lang];
    var bandLabel = {
      advanced: dict.lvlAdvanced,
      intermediate: dict.lvlInter,
      familiar: dict.lvlFamiliar
    };
    var bandOrder = ["advanced", "intermediate", "familiar"];
    el("skillsGroups").innerHTML = D.skillCategories.map(function (cat) {
      // bucket the skills of this category by qualitative band, preserving every skill
      var buckets = { advanced: [], intermediate: [], familiar: [] };
      cat.skills.forEach(function (s) { buckets[lvlBand(s.lvl)].push(s[lang]); });
      var tiers = bandOrder.map(function (band) {
        if (!buckets[band].length) return "";
        var chips = buckets[band].map(function (name) {
          return '<span class="skill-chip">' + esc(name) + "</span>";
        }).join("");
        return '<div class="skill-tier tier-' + band + '">' +
          '<span class="tier-label">' + esc(bandLabel[band]) +
          ' <em>(' + buckets[band].length + ')</em></span>' +
          '<div class="skill-chips">' + chips + "</div></div>";
      }).join("");
      return '<div class="skill-group card glow reveal"><div class="skill-group-head"><h3><span class="kw" aria-hidden="true">module</span>' +
        esc(cat[lang]) + "</h3>" +
        '<span class="count">' + cat.skills.length + " " + t("techCount") + "</span></div>" +
        '<div class="skill-tiers">' + tiers + "</div></div>";
    }).join("");

    /* "Ver más": complete flat inventory, alphabetical, nothing trimmed */
    var all = [];
    D.skillCategories.forEach(function (cat) {
      cat.skills.forEach(function (s) { if (all.indexOf(s[lang]) === -1) all.push(s[lang]); });
    });
    all.sort(function (a, b) { return a.localeCompare(b, lang); });
    var host = el("skillsAllChips");
    if (host) {
      host.innerHTML = all.map(function (n) {
        return '<span class="skill-chip">' + esc(n) + "</span>";
      }).join("");
    }
    var sum = document.querySelector("#skillsAll > summary");
    if (sum) {
      sum.textContent = D.ui[lang].skillsAllOpen + " (" + all.length + ")";
    }
  }

  /* ---------- Experience: git branch graph ---------- */
  function renderExperience() {
    var featured = window.CV_RESUME.featuredOrgs.map(function (org) {
      return D.experience.find(function (e) { return e.org === org; });
    });
    function cards(entries) { return entries.map(function (e) {
      var tags = (e.tags || []).map(function (tg) {
        return '<span class="tag ' + (tg.t || "") + '">' + esc(tg[lang]) + "</span>";
      }).join("");
      var desc = pick(e.desc);
      var note = e.note ? pick(e.note) : "";
      var period = pick(e.period);
      var live = /actualidad|present/i.test(period);
      var h = hash7(e.org + "|" + (e.period && e.period.es) + "|" + (e.role && e.role.es));
      return '<article class="tl-item reveal' + (e.own ? " is-own" : "") + (live ? " is-live" : "") + '">' +
        '<span class="tl-dot" aria-hidden="true"></span><span class="tl-fork" aria-hidden="true"></span>' +
        '<div class="tl-card card glow">' +
          '<div class="tl-meta"><span class="tl-hash" aria-hidden="true">' + t("commit") + " " + h + "</span>" +
            (tags ? '<span class="tl-refs">' + tags + "</span>" : "") +
            '<span class="tl-period">' + esc(period) + "</span></div>" +
          '<div class="tl-head">' +
            '<h3 class="tl-role">' + esc(pick(e.role)) + "</h3>" +
            '<span class="tl-org">' + esc(e.org) + "</span>" +
          "</div>" +
          '<div class="tl-loc">' + esc(e.loc) + "</div>" +
          (desc ? '<p class="tl-desc">' + esc(desc) + "</p>" : "") +
          (e.tech ? '<p class="tl-tech"><b>' + t("tech") + "</b>" + esc(pick(e.tech)) + "</p>" : "") +
          (note ? '<p class="tl-note">' + esc(note) + "</p>" : "") +
        "</div></article>";
    }).join(""); }
    el("timeline").innerHTML = cards(featured);
    el("timeline-full").innerHTML = cards(D.experience);
  }

  /* ---------- Education ---------- */
  function renderEducation() {
    var html = D.education.map(function (e) {
      return '<div class="edu-card card glow reveal"><h4>' + esc(pick(e.prog)) + "</h4>" +
        '<span class="inst">' + esc(e.inst) + "</span>" +
        '<span class="meta">' + esc(pick(e.status)) + " · " + esc(e.period) + "</span></div>";
    }).join("");
    html += '<div class="edu-card edu-note card reveal"><p>' + esc(pick(D.educationNote)) + "</p></div>";
    el("education").innerHTML = html;
  }

  /* ---------- Languages ---------- */
  function renderLanguages() {
    el("languages").innerHTML = D.languages.map(function (l) {
      return '<div class="lang-card card reveal"><b>' + esc(pick(l.name)) + "</b><p>" + esc(pick(l.lvl)) + "</p></div>";
    }).join("");
  }

  /* ---------- Main projects ---------- */
  function renderMainProjects() {
    el("mainProjects").innerHTML = D.mainProjects.map(function (p, i) {
      var links = (p.links || []).map(function (lk) {
        return '<a class="pj-link" href="' + esc(safeUrl(lk.url)) + '" target="_blank" rel="noopener">' +
          esc(pick(lk.label)) + " ↗</a>";
      }).join("");
      var sub = (p.sub || []).map(function (s) {
        return '<div class="pj-sub-item"><b>' + esc(s.name) + ":</b> " + esc(s[lang]) +
          ' <a href="' + esc(safeUrl(s.url)) + '" target="_blank" rel="noopener" aria-label="' + esc(s.name) + '">↗</a></div>';
      }).join("");
      var stack = String(p.stack).split(" · ").map(function (s) { return "<span>" + esc(s) + "</span>"; }).join("");
      var note = p.noteLine ? '<p class="pj-note">' + esc(pick(p.noteLine)) + "</p>" : "";
      return '<div class="project-card card glow reveal' + (i === 0 ? " is-flagship" : "") + '">' +
        '<div class="pj-top"><span class="pj-idx">' + pad2(i + 1) + " /</span>" +
        '<p class="pj-status">' + esc(pick(p.status)) + "</p></div>" +
        "<h3>" + esc(p.name) + "</h3>" +
        '<p class="pj-desc">' + esc(pick(p.desc)) + "</p>" +
        '<p class="pj-stack">' + stack + "</p>" +
        note +
        (sub ? '<div class="pj-sub">' + sub + "</div>" : "") +
        (links ? '<div class="pj-links">' + links + "</div>" : "") +
        "</div>";
    }).join("");
  }

  /* ---------- Achievements ---------- */
  function renderAchievements() {
    el("achievements-grid").innerHTML = D.achievements.map(function (a, i) {
      return '<div class="ach-card card glow reveal"><span class="ach-idx">[' + pad2(i + 1) + ']</span><h4><a href="' + esc(safeUrl(a.url)) +
        '" target="_blank" rel="noopener">' + esc(a.name) + " ↗</a></h4>" +
        "<p>" + esc(a[lang]) + "</p></div>";
    }).join("");
  }

  /* ---------- Portfolio (tabs) ---------- */
  var portIdx = 0;
  function renderPortfolio() {
    var tabs = D.portfolio.map(function (g, i) {
      return '<button type="button" role="tab" aria-selected="' + (i === portIdx) + '" class="port-tab ' + (i === portIdx ? "active" : "") +
        '" data-pidx="' + i + '">' + esc(pick(g.cat)) + " (" + g.items.length + ")</button>";
    }).join("");
    el("portTabs").innerHTML = tabs;
    renderPortContent();
    el("portTabs").querySelectorAll(".port-tab").forEach(function (b) {
      b.addEventListener("click", function () {
        portIdx = parseInt(b.getAttribute("data-pidx"), 10);
        renderPortfolio();
      });
    });
  }
  function renderPortContent() {
    var g = D.portfolio[portIdx];
    el("portContent").innerHTML = g.items.map(function (it) {
      var badge = it.star ? '<span class="star-badge" aria-hidden="true">★</span>' : "";
      return '<div class="port-card ' + (it.star ? "star" : "") + '">' +
        "<h4><a href='" + esc(safeUrl(it.url)) + "' target='_blank' rel='noopener'>" +
        esc(it.name) + " ↗</a>" + badge + "</h4>" +
        "<p>" + esc(it[lang]) + "</p>" +
        '<a class="url" href="' + esc(safeUrl(it.url)) + '" target="_blank" rel="noopener">' + esc(it.url) + "</a>" +
        "</div>";
    }).join("");
  }

  /* ---------- Services ---------- */
  function renderServices() {
    var dict = D.ui[lang];
    var intro = '<p class="svc-intro">' + esc(dict.svcIntro) + "</p>";
    el("services-grid").innerHTML = intro + D.services.map(function (s) {
      var price = lang === "es" ? s.price : s.priceEn;
      var backed = s.backed
        ? '<span class="backed">' + esc(dict.backedBy) + " " + esc(s.backed) + "</span>" : "";
      return '<div class="svc-card card glow reveal"><h4>' + esc(s[lang]) + "</h4>" +
        '<span class="price">' + esc(price) + "</span>" + backed + "</div>";
    }).join("");
  }

  /* ---------- Contact (.env) ---------- */
  function renderContact() {
    el("contact-grid").innerHTML = D.contact.map(function (c) {
      var val = pick(c.value);
      var inner = c.url
        ? '<a href="' + esc(safeUrl(c.url)) + '"' +
            (/^mailto:/.test(c.url) ? "" : ' target="_blank" rel="noopener"') + ">" + esc(val) + "</a>"
        : '<span class="val">' + esc(val) + "</span>";
      return '<div class="contact-card"><span class="label">' + esc(pick(c.label)) + "</span>" + inner + "</div>";
    }).join("");
  }

  /* ---------- Reveal on scroll ---------- */
  var io = null;
  function observeReveals() {
    var nodes = document.querySelectorAll(".reveal:not(.is-in)");
    if (reduceMotion || !("IntersectionObserver" in window)) {
      nodes.forEach(function (n) { n.classList.add("is-in"); });
      return;
    }
    if (booted) {
      // Tras cambiar de idioma no se re-anima: se muestra de una vez.
      nodes.forEach(function (n) { n.classList.add("is-in"); });
      return;
    }
    if (!io) {
      io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) { en.target.classList.add("is-in"); io.unobserve(en.target); }
        });
      }, { rootMargin: "0px 0px -8% 0px", threshold: 0.06 });
    }
    nodes.forEach(function (n) { io.observe(n); });
  }

  /* ---------- Render all (lang toggle = sync full fill) ---------- */
  function renderAll() {
    applyI18n();
    applyDownloads();
    renderCode(false);
    renderEpigraphs();
    renderCapabilities();
    renderStack();
    renderSkills();
    renderExperience();
    renderEducation();
    renderLanguages();
    renderMainProjects();
    renderAchievements();
    renderPortfolio();
    renderServices();
    renderContact();
    observeReveals();
    if (window.CVGraph) window.CVGraph.setLang(lang);
  }

  /* ---------- Boot: light first paint, heavy DOM in idle slices (TBT) ----------
     698ebc6 sync renderAll + typewriter long-tasks ~445ms around LCP.
     Keep data.js defer (available at DCL). Skip typewriter on first boot;
     skip ES i18n walk (SSR) — safe TBT; restore sync renderCode (43eb52f idle
     deferral risked late hero-editor paint as mobile LCP).
     chunk below-fold fills via requestIdleCallback (short timeout — NOT 2.5s). */
  var heavyScheduled = false;
  var chromeReady = false;
  function runIdle(fn, timeout) {
    if ("requestIdleCallback" in window) requestIdleCallback(fn, { timeout: timeout || 400 });
    else setTimeout(fn, 0);
  }
  function scheduleHeavyBoot() {
    if (heavyScheduled) return;
    heavyScheduled = true;
    var steps = [
      function () { renderEpigraphs(); renderCapabilities(); },
      function () { renderStack(); renderSkills(); },
      function () { renderExperience(); },
      function () { renderEducation(); renderLanguages(); },
      function () { renderMainProjects(); renderAchievements(); },
      function () { renderPortfolio(); renderServices(); renderContact(); },
      function () {
        observeReveals();
        if (!chromeReady) { chromeReady = true; initChrome(); }
        if (window.CVGraph) window.CVGraph.setLang(lang);
      }
    ];
    var i = 0;
    function pump(deadline) {
      var budget = deadline && typeof deadline.timeRemaining === "function"
        ? deadline.timeRemaining()
        : 12;
      var start = performance.now();
      while (i < steps.length && (performance.now() - start < Math.max(8, budget))) {
        steps[i++]();
      }
      if (i < steps.length) runIdle(pump, 400);
    }
    runIdle(pump, 200);
  }

  /* ---------- Lang toggle ---------- */
  function setLang(next) {
    if (next === lang) return;
    lang = next;
    try { localStorage.setItem("cv-lang", lang); } catch (e) {}
    document.querySelectorAll(".lang-toggle button").forEach(function (b) {
      var active = b.getAttribute("data-lang") === lang;
      b.classList.toggle("active", active);
      b.setAttribute("aria-pressed", active ? "true" : "false");
    });
    renderAll();
  }

  /* ---------- Chrome: índice activo, progreso, luz de tarjetas, menú ---------- */
  function initChrome() {
    // Sección activa en el índice
    var links = {};
    document.querySelectorAll(".topnav a[href^='#']").forEach(function (a) { links[a.getAttribute("href").slice(1)] = a; });
    var nav = document.querySelector(".topnav");
    if ("IntersectionObserver" in window) {
      var secIO = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          Object.keys(links).forEach(function (k) { links[k].classList.remove("is-active"); links[k].removeAttribute("aria-current"); });
          var a = links[en.target.id];
          if (!a) return;
          a.classList.add("is-active"); a.setAttribute("aria-current", "location");
          if (nav && nav.scrollWidth > nav.clientWidth) {
            var l = a.offsetLeft - 12, r = a.offsetLeft + a.offsetWidth + 12;
            if (l < nav.scrollLeft || r > nav.scrollLeft + nav.clientWidth) nav.scrollTo({ left: l, behavior: reduceMotion ? "auto" : "smooth" });
          }
        });
      }, { rootMargin: "-42% 0px -52% 0px" });
      Object.keys(links).forEach(function (k) { var s = el(k); if (s) secIO.observe(s); });
    }

    // Barra de progreso de lectura
    var bar = el("scrollProgress"), ticking = false;
    function onScroll() {
      if (ticking) return; ticking = true;
      requestAnimationFrame(function () {
        ticking = false;
        var max = document.documentElement.scrollHeight - window.innerHeight;
        if (bar) bar.style.setProperty("--p", max > 0 ? Math.min(1, window.scrollY / max).toFixed(4) : "0");
      });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    // Luz que sigue al puntero en las tarjetas
    if (window.matchMedia && window.matchMedia("(hover: hover)").matches) {
      var pending = null, pe = null;
      document.addEventListener("pointermove", function (e) {
        pe = e;
        if (pending) return;
        pending = requestAnimationFrame(function () {
          pending = null;
          var c = pe.target && pe.target.closest ? pe.target.closest(".glow") : null;
          if (!c) return;
          var r = c.getBoundingClientRect();
          c.style.setProperty("--mx", (pe.clientX - r.left) + "px");
          c.style.setProperty("--my", (pe.clientY - r.top) + "px");
        });
      }, { passive: true });
    }

    // Menú del ecosistema (móvil): cerrar al elegir, al tocar fuera y con Escape
    var menu = document.querySelector(".eco-menu");
    if (menu) {
      document.addEventListener("click", function (e) {
        if (!menu.open) return;
        if (e.target.closest(".eco-menu-panel a") || !menu.contains(e.target)) menu.open = false;
      });
      document.addEventListener("keydown", function (e) {
        if (e.key !== "Escape" || !menu.open) return;
        var f = menu.contains(document.activeElement);
        menu.open = false;
        if (f) menu.querySelector("summary").focus();
      });
    }
  }

  /* ---------- Init (light path — no sync below-fold DOM / no typewriter) ---------- */
  function init() {
    try {
      var saved = localStorage.getItem("cv-lang");
      if (saved === "en" || saved === "es") lang = saved;
    } catch (e) {}
    // honor ?lang= or #en
    var qs = new URLSearchParams(window.location.search);
    if (qs.get("lang") === "en" || window.location.hash === "#en") lang = "en";
    if (qs.get("lang") === "es") lang = "es";

    document.querySelectorAll(".lang-toggle button").forEach(function (b) {
      var active = b.getAttribute("data-lang") === lang;
      b.classList.toggle("active", active);
      b.setAttribute("aria-pressed", active ? "true" : "false");
      b.addEventListener("click", function () { setLang(b.getAttribute("data-lang")); });
    });

    var y = el("year"); if (y) y.textContent = new Date().getFullYear();
    // SSR Spanish already in HTML — skip i18n walk on default ES (safe TBT).
    // EN/?lang=en still applies sync. Hero editor: sync renderCode (no idle — avoid late LCP).
    if (lang !== "es") {
      applyI18n();
      applyDownloads();
    } else {
      applyDownloads();
    }
    renderCode(false);
    booted = true;
    scheduleHeavyBoot();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else { init(); }
})();


/* =========================================================
   WAVE3 SEO/Perf: defer dependency graph (graph.js) post-LCP.
   canvas#heroGraph stays in DOM; early-return guard in graph.js
   requires the canvas. Hard floor 2.5s after window load.
   ========================================================= */
(function loadGraphPostLcp() {
  var done = false;
  function inject() {
    if (done) return;
    done = true;
    var s = document.createElement("script");
    s.src = "graph.js";
    s.defer = true;
    document.body.appendChild(s);
  }
  function afterLoad(fn) {
    if (document.readyState === "complete") fn();
    else window.addEventListener("load", fn, { once: true });
  }
  afterLoad(function () {
    setTimeout(inject, 2500);
  });
})();

/* ============================================================
   APP — render + ES/EN toggle (vanilla JS, no build step)
   ============================================================ */
(function () {
  "use strict";
  var D = window.CV_DATA;
  var lang = "es";

  function el(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function pick(v) {
    if (v && typeof v === "object" && (("es" in v) || ("en" in v))) return v[lang];
    return v;
  }
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

  /* ---------- i18n for [data-i18n] static nodes ---------- */
  function applyI18n() {
    var dict = D.ui[lang];
    document.querySelectorAll("[data-i18n]").forEach(function (n) {
      var key = n.getAttribute("data-i18n");
      if (dict[key] != null) n.textContent = dict[key];
    });
    document.documentElement.lang = lang;
  }

  /* ---------- Download buttons swap by language ---------- */
  function applyDownloads() {
    var cv = "pdf/CV_tech_" + lang + ".pdf";
    var ats = "pdf/CV_tech_ats_" + lang + ".pdf";
    ["dl-cv", "dl-cv2"].forEach(function (id) { var n = el(id); if (n) n.setAttribute("href", cv); });
    ["dl-ats", "dl-ats2"].forEach(function (id) { var n = el(id); if (n) n.setAttribute("href", ats); });
  }

  /* ---------- Epigraphs ---------- */
  function renderEpigraphs() {
    el("epigraphs").innerHTML = D.epigraphs[lang]
      .map(function (e) { return '<p class="epigraph">“' + esc(e) + '”</p>'; }).join("");
  }

  /* ---------- Capabilities ---------- */
  function renderCapabilities() {
    el("capabilities").innerHTML = D.capabilities[lang].map(function (c) {
      return '<div class="cap-card"><h4>' + esc(c.h) + "</h4><p>" + esc(c.p) + "</p></div>";
    }).join("");
  }

  /* ---------- Stack summary ---------- */
  function renderStack() {
    el("stackSummary").innerHTML = D.stack[lang].map(function (r) {
      return '<div class="stack-row"><b>' + esc(r.k) + "</b><span>" + esc(r.v) + "</span></div>";
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
      return '<div class="skill-group"><h3>' + esc(cat[lang]) + "</h3>" +
        '<span class="count">' + cat.skills.length + " " + (lang === "es" ? "tecnologías" : "technologies") + "</span>" +
        '<div class="skill-tiers">' + tiers + "</div></div>";
    }).join("");
  }

  /* ---------- Experience ---------- */
  function renderExperience() {
    var featured = window.CV_RESUME.featuredOrgs.map(function (org) {
      return D.experience.find(function (e) { return e.org === org; });
    });
    function cards(entries) { return entries.map(function (e) {
      var tags = (e.tags || []).map(function (t) {
        return '<span class="tag ' + (t.t || "") + '">' + esc(t[lang]) + "</span>";
      }).join("");
      var desc = pick(e.desc);
      var note = e.note ? pick(e.note) : "";
      return '<div class="tl-item ' + (e.own ? "is-own" : "") + '">' +
        '<div class="tl-head">' +
          '<span class="tl-role">' + esc(pick(e.role)) + "</span>" +
          '<span class="tl-org">' + esc(e.org) + "</span>" +
          '<span class="tl-period">' + esc(pick(e.period)) + "</span>" +
        "</div>" +
        '<div class="tl-loc tl-period">' + esc(e.loc) + "</div>" +
        (tags ? '<div class="tl-tags">' + tags + "</div>" : "") +
        (desc ? '<p class="tl-desc">' + esc(desc) + "</p>" : "") +
        (note ? '<p class="tl-note">' + esc(note) + "</p>" : "") +
        "</div>";
    }).join(""); }
    el("timeline").innerHTML = cards(featured);
    el("timeline-full").innerHTML = cards(D.experience);
  }

  /* ---------- Education ---------- */
  function renderEducation() {
    var html = D.education.map(function (e) {
      return '<div class="edu-card"><h4>' + esc(pick(e.prog)) + "</h4>" +
        '<span class="inst">' + esc(e.inst) + "</span>" +
        '<span class="meta">' + esc(pick(e.status)) + " · " + esc(e.period) + "</span></div>";
    }).join("");
    html += '<div class="edu-card" style="grid-column:1/-1"><p style="margin:0;color:var(--muted);font-size:13.5px">' +
      esc(pick(D.educationNote)) + "</p></div>";
    el("education").innerHTML = html;
  }

  /* ---------- Languages ---------- */
  function renderLanguages() {
    el("languages").innerHTML = D.languages.map(function (l) {
      return '<div class="lang-card"><b>' + esc(pick(l.name)) + "</b><p>" + esc(pick(l.lvl)) + "</p></div>";
    }).join("");
  }

  /* ---------- Main projects ---------- */
  function renderMainProjects() {
    var dict = D.ui[lang];
    el("mainProjects").innerHTML = D.mainProjects.map(function (p) {
      var links = (p.links || []).map(function (lk) {
        return '<a class="pj-link" href="' + esc(safeUrl(lk.url)) + '" target="_blank" rel="noopener">' +
          esc(pick(lk.label)) + " ↗</a>";
      }).join("");
      var sub = (p.sub || []).map(function (s) {
        return '<div class="pj-sub-item"><b>' + esc(s.name) + ":</b> " + esc(s[lang]) +
          ' <a href="' + esc(safeUrl(s.url)) + '" target="_blank" rel="noopener">↗</a></div>';
      }).join("");
      var note = p.noteLine ? '<p class="pj-note">' + esc(pick(p.noteLine)) + "</p>" : "";
      return '<div class="project-card">' +
        "<h3>" + esc(p.name) + "</h3>" +
        '<p class="pj-status">' + esc(pick(p.status)) + "</p>" +
        '<p class="pj-desc">' + esc(pick(p.desc)) + "</p>" +
        '<p class="pj-stack">' + esc(p.stack) + "</p>" +
        note +
        (sub ? '<div class="pj-sub">' + sub + "</div>" : "") +
        (links ? '<div class="pj-links">' + links + "</div>" : "") +
        "</div>";
    }).join("");
  }

  /* ---------- Achievements ---------- */
  function renderAchievements() {
    el("achievements-grid").innerHTML = D.achievements.map(function (a) {
      return '<div class="ach-card"><h4><a href="' + esc(safeUrl(a.url)) +
        '" target="_blank" rel="noopener">' + esc(a.name) + " ↗</a></h4>" +
        "<p>" + esc(a[lang]) + "</p></div>";
    }).join("");
  }

  /* ---------- Portfolio (tabs) ---------- */
  var portIdx = 0;
  function renderPortfolio() {
    var tabs = D.portfolio.map(function (g, i) {
      return '<button type="button" class="port-tab ' + (i === portIdx ? "active" : "") +
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
      var badge = it.star ? '<span class="star-badge">★</span>' : "";
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
    var intro = '<p class="svc-intro" style="grid-column:1/-1">' + esc(dict.svcIntro) + "</p>";
    el("services-grid").innerHTML = intro + D.services.map(function (s) {
      var price = lang === "es" ? s.price : s.priceEn;
      var backed = s.backed
        ? '<span class="backed">' + esc(dict.backedBy) + " " + esc(s.backed) + "</span>" : "";
      return '<div class="svc-card"><h4>' + esc(s[lang]) + "</h4>" +
        '<span class="price">' + esc(price) + "</span>" + backed + "</div>";
    }).join("");
  }

  /* ---------- Contact ---------- */
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

  /* ---------- Render all ---------- */
  function renderAll() {
    applyI18n();
    applyDownloads();
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

  /* ---------- Init ---------- */
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
    renderAll();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else { init(); }
})();

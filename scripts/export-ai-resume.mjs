/* Genera el "CV para IAs": una sola fuente (public/data.js) -> HTML+PDF con TODO.
   Pensado para parsers/ATS/bots que verifican literalmente cada skill y empresa.
   No reemplaza a los CV humanos (export-resumes.mjs); es el volcado completo. */
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ctx = { window: {} };
vm.runInNewContext(await fs.readFile(path.join(repo, 'public/data.js'), 'utf8'), ctx);
const D = ctx.window.CV_DATA;
const R = ctx.window.CV_RESUME;

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const CSS = `
@page { size: A4; margin: 10mm 12mm; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: Calibri, Carlito, Arial, sans-serif; color: #111; font-size: 9.3pt; line-height: 1.28; }
h1 { font-size: 18pt; }
h2 { font-size: 10.5pt; text-transform: uppercase; letter-spacing: .5px; border-bottom: .8pt solid #888; margin: 3mm 0 1.5mm; padding-bottom: .6mm; }
.role { font-size: 11pt; font-weight: 600; margin-top: 1mm; }
.contact { font-size: 9.2pt; color: #333; margin-top: 1.2mm; }
.line { margin-bottom: .8mm; }
.job { margin-bottom: 1.6mm; break-inside: avoid; }
.job-head { font-size: 9.8pt; font-weight: 700; }
.job-meta { font-size: 8.9pt; color: #444; font-style: italic; }
.job p { margin-top: .3mm; }
.proj { margin-bottom: 1.2mm; break-inside: avoid; }
.proj b { font-weight: 700; }
.small { font-size: 8.8pt; color: #333; }
`;

function jobs(lang) {
  return D.experience.map((e) => {
    const tags = (e.tags || []).map((t) => t[lang]).join(' · ');
    const note = e.note ? ` ${e.note[lang]}` : '';
    return `<div class="job">
      <div class="job-head">${esc(e.role[lang])} — ${esc(e.org)}</div>
      <div class="job-meta">${esc(e.period[lang])}${tags ? ' · ' + esc(tags) : ''} · ${esc(e.loc)}</div>
      <p>${esc(e.desc[lang])}${esc(note)}</p>
      ${e.tech ? `<div class="small">${lang === 'es' ? 'Tecnologías' : 'Technologies'}: ${esc(e.tech[lang])}</div>` : ''}
    </div>`;
  }).join('\n');
}

function skills(lang) {
  return D.skillCategories.map((c) =>
    `<div class="line"><b>${esc(c[lang])}:</b> ${esc(c.skills.map((s) => s[lang]).join(' · '))}</div>`
  ).join('\n');
}

function mainProjects(lang) {
  return (D.mainProjects || []).map((p) => {
    const links = (p.links || []).map((l) => l.url).join(' · ');
    return `<div class="proj"><b>${esc(p.name)}</b>${links ? ` · ${esc(links)}` : ''}
      <div>${esc(p.desc ? p.desc[lang] : '')}</div>
      ${p.stack ? `<div class="small">Stack: ${esc(p.stack)}</div>` : ''}</div>`;
  }).join('\n');
}

function portfolio(lang) {
  return (D.portfolio || []).map((group) => {
    const items = (group.items || []).map((i) => i.name).join(' · ');
    return `<div class="line small"><b>${esc(group.cat[lang])}:</b> ${esc(items)}</div>`;
  }).join('\n');
}

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
try {
  for (const lang of ['es', 'en']) {
    const t = D.ui[lang];
    const html = `<!doctype html><html lang="${lang}"><head><meta charset="utf-8">
<title>Steven Vallejo Ortiz — ${lang === 'es' ? 'CV completo' : 'full CV'}</title><style>${CSS}</style></head><body>
<h1>Steven Vallejo Ortiz</h1>
<div class="role">${esc(t.role)} — Backend · Cloud · ${lang === 'es' ? 'IA y agentes' : 'AI & agents'}</div>
<div class="contact">${esc(t.heroChipLoc)} · ${esc(t.heroChipRemote)}<br>
${D.contact.map((c) => esc(typeof c.value === 'string' ? c.value : (c.value ? c.value[lang] : ''))).filter(Boolean).join(' · ')}</div>
<h2>${lang === 'es' ? 'Perfil profesional' : 'Professional profile'}</h2>
<p>${esc(R.profile[lang])}</p>
<h2>${esc(t.skillsTitle)} (${D.skillCategories.reduce((a, c) => a + c.skills.length, 0)})</h2>
${skills(lang)}
<h2>${lang === 'es' ? 'Experiencia profesional (trayectoria completa)' : 'Professional experience (full history)'}</h2>
${jobs(lang)}
<h2>${esc(t.projTitle)}</h2>
${mainProjects(lang)}
<h2>${lang === 'es' ? 'Portafolio' : 'Portfolio'}</h2>
${portfolio(lang)}
<h2>${esc(t.eduTitle)} · ${esc(t.langTitle)}</h2>
${D.education.map((e) => `<div class="line">${esc(e.prog[lang])} — ${esc(e.inst)} · ${esc(e.period)}${e.status ? ' · ' + esc(e.status[lang]) : ''}</div>`).join('\n')}
<div class="line">${esc(t.langTitle)}: ${D.languages.map((l) => `${esc(l.name[lang])} — ${esc(l.lvl[lang])}`).join(' · ')}</div>
</body></html>`;

    const out = path.join(repo, `public/pdf/CV_ai_${lang}.pdf`);
    await fs.writeFile(path.join(repo, `public/pdf/CV_ai_${lang}.html`), html + '\n');
    const p = await browser.newPage();
    await p.setContent(html, { waitUntil: 'load' });
    await p.pdf({ path: out, format: 'A4', printBackground: true, preferCSSPageSize: true });
    console.log(JSON.stringify({ file: path.basename(out), bytes: (await fs.stat(out)).size }));
    await p.close();
  }
} finally {
  await browser.close();
}

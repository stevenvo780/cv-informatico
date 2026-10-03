// Offline initialization regression: real app.js, synthetic DOM and CV data only.
// Run: node --test scripts/test-language-init.cjs
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');

const app = readFileSync(join(__dirname, '../public/app.js'), 'utf8');
const profiles = { es: 'Perfil de prueba ES', en: 'Test profile EN' };

function element(attrs = {}, textContent = '') {
  const listeners = new Map();
  const classes = new Set();
  return {
    attrs, textContent, innerHTML: '', children: [],
    classList: {
      add(name) { classes.add(name); },
      remove(name) { classes.delete(name); },
      toggle(name, on) { if (on) classes.add(name); else classes.delete(name); },
      contains(name) { return classes.has(name); },
    },
    style: { setProperty() {} },
    getAttribute(name) { return attrs[name] ?? null; },
    setAttribute(name, value) { attrs[name] = value; },
    removeAttribute(name) { delete attrs[name]; },
    addEventListener(name, fn, options) {
      if (!listeners.has(name)) listeners.set(name, []);
      listeners.get(name).push({ fn, once: !!(options && options.once) });
    },
    dispatch(name) {
      const handlers = listeners.get(name) || [];
      listeners.set(name, handlers.filter(handler => !handler.once));
      handlers.forEach(handler => handler.fn());
    },
    querySelectorAll() { return []; },
    appendChild(child) { this.children.push(child); },
    focus() {},
  };
}

function boot(options = {}) {
  let saved = options.saved ?? null;
  const writes = [];
  const queries = [];
  const pending = [];
  const timeouts = [];
  const profile = element({ 'data-i18n': 'aboutProfile' }, options.profileText || '');
  const label = element({ 'data-i18n': 'role' }, 'SSR role ES');
  const buttons = ['es', 'en'].map(lang => element({ 'data-lang': lang }));
  const hosts = new Map([
    'year', 'heroCode', 'heroCodeStatus', 'epigraphs', 'capabilities', 'stackSummary',
    'skillsGroups', 'skillsAllChips', 'timeline', 'timeline-full', 'education',
    'languages', 'mainProjects', 'achievements-grid', 'portTabs', 'portContent',
    'services-grid', 'contact-grid', 'scrollProgress',
    'dl-cv', 'dl-cv2', 'dl-ats', 'dl-ats2', 'dl-ai', 'dl-ai2',
  ].map(id => [id, element()]));
  const root = Object.assign(element(), { lang: 'es', scrollHeight: 1000 });
  const document = Object.assign(element(), {
    readyState: options.loading ? 'loading' : 'complete',
    documentElement: root, body: element(),
    getElementById(id) { return hosts.get(id) || null; },
    querySelectorAll(selector) {
      queries.push(selector);
      if (selector === '[data-i18n]') return options.noProfile ? [label] : [profile, label];
      if (selector === '[data-i18n="aboutProfile"]') return options.noProfile ? [] : [profile];
      if (selector === '.lang-toggle button') return buttons;
      return [];
    },
    querySelector(selector) { return selector === '#skillsAll > summary' ? element() : null; },
    createElement() { return element(); },
  });
  const data = {
    ui: Object.fromEntries(['es', 'en'].map(lang => [lang, {
      aboutProfile: options.noTranslation ? undefined : profiles[lang],
      role: 'Role ' + lang, skillsAllOpen: 'All', svcIntro: 'Services',
    }])),
    epigraphs: { es: [], en: [] }, capabilities: { es: [], en: [] },
    stack: { es: [], en: [] }, skillCategories: [], experience: [], education: [],
    educationNote: { es: '', en: '' }, languages: [], mainProjects: [], achievements: [],
    portfolio: [{ cat: { es: 'Grupo', en: 'Group' }, items: [] }], services: [], contact: [],
  };
  const enqueue = fn => pending.push(fn);
  const window = Object.assign(element(), {
    CV_DATA: data, CV_RESUME: { featuredOrgs: [] },
    location: { search: options.search || '', hash: options.hash || '' },
    matchMedia: () => ({ matches: false }), innerHeight: 800, scrollY: 0,
  });
  if (!options.noIdle) window.requestIdleCallback = enqueue;
  const context = vm.createContext({
    window, document, URLSearchParams,
    localStorage: {
      getItem(key) {
        assert.equal(key, 'cv-lang');
        if (options.storageThrows) throw new Error('Storage unavailable');
        return saved;
      },
      setItem(key, value) {
        assert.equal(key, 'cv-lang');
        if (options.storageThrows) throw new Error('Storage unavailable');
        saved = value;
        writes.push(value);
      },
    },
    requestIdleCallback: enqueue, requestAnimationFrame: enqueue, cancelAnimationFrame() {},
    setTimeout(fn, delay) { timeouts.push(delay); return enqueue(fn); },
  });
  vm.runInContext(app, context, { filename: 'public/app.js', timeout: 1000 });
  return {
    profile, label, root, buttons, hosts, document, window, queries, writes, timeouts,
    initialize() {
      if (options.loading) {
        assert.equal(profile.textContent, options.profileText || '', 'wait for DOMContentLoaded');
        document.readyState = 'interactive';
        document.dispatch('DOMContentLoaded');
      }
    },
    flush() {
      document.readyState = 'complete';
      window.dispatch('load');
      let count = 0;
      while (pending.length) {
        assert.ok(++count < 100, 'deferred boot must terminate');
        pending.shift()();
      }
      return count;
    },
    click(lang) { buttons.find(button => button.attrs['data-lang'] === lang).dispatch('click'); },
  };
}

function assertLanguage(page, lang) {
  assert.equal(page.profile.textContent, profiles[lang], 'initial profile matches selected language');
  assert.equal(page.root.lang, lang);
  page.buttons.forEach(button => {
    const active = button.attrs['data-lang'] === lang;
    assert.equal(button.attrs['aria-pressed'], String(active));
    assert.equal(button.classList.contains('active'), active);
  });
  for (const kind of ['cv', 'ats', 'ai']) {
    const name = kind === 'cv' ? 'tech' : kind === 'ats' ? 'tech_ats' : 'ai';
    for (const suffix of ['', '2']) {
      assert.equal(page.hosts.get('dl-' + kind + suffix).attrs.href, 'pdf/CV_' + name + '_' + lang + '.pdf');
    }
  }
}

const cases = [
  ['default ES', {}, 'es'],
  ['saved ES', { saved: 'es' }, 'es'],
  ['explicit ES', { search: '?lang=es' }, 'es'],
  ['ES overrides saved EN', { search: '?lang=es', saved: 'en' }, 'es'],
  ['ES overrides EN hash', { search: '?lang=es', saved: 'en', hash: '#en' }, 'es'],
  ['explicit EN', { search: '?lang=en' }, 'en'],
  ['saved EN', { saved: 'en' }, 'en'],
  ['EN overrides saved ES', { search: '?lang=en', saved: 'es' }, 'en'],
  ['EN hash', { hash: '#en', saved: 'es' }, 'en'],
  ['invalid choices default ES', { search: '?lang=fr', saved: 'fr' }, 'es'],
  ['invalid URL retains saved EN', { search: '?lang=fr', saved: 'en' }, 'en'],
  ['unavailable storage defaults ES', { storageThrows: true }, 'es'],
  ['URL works without storage', { search: '?lang=en', storageThrows: true }, 'en'],
];

for (const loading of [false, true]) {
  for (const noIdle of [false, true]) {
    for (const [name, options, lang] of cases) {
      test(`${name}; ${loading ? 'DOMContentLoaded' : 'loaded'}; ${noIdle ? 'timeout' : 'idle'}`, () => {
        const page = boot({ ...options, loading, noIdle });
        page.initialize();
        assertLanguage(page, lang);
        assert.equal(page.queries.includes('[data-i18n]'), lang === 'en', 'keep ES initialization narrow');
        assert.equal(page.label.textContent, lang === 'es' ? 'SSR role ES' : 'Role en');
        assert.equal(page.hosts.get('heroCode').innerHTML, '', 'hero editor stays deferred');
        assert.equal(page.hosts.get('education').innerHTML, '', 'below-fold render stays deferred');
        assert.equal(page.document.body.children.length, 0, 'graph stays deferred');
        page.click(lang);
        assertLanguage(page, lang);
        assert.equal(page.writes.length, 0, 'same-language click leaves saved preference alone');
        assert.equal(page.flush(), 19, 'all existing boot slices finish');
        assertLanguage(page, lang);
        assert.ok(page.timeouts.includes(2500), 'graph retains 2.5s post-load delay');
        assert.equal(page.document.body.children.length, 1);
        assert.equal(page.document.body.children[0].src, 'graph.js');
        for (const next of ['en', 'es', 'en']) {
          page.click(next);
          assertLanguage(page, next);
        }
        assert.equal(page.flush(), 0, 'completed boot does not schedule another graph');
      });
    }
  }
}

test('switching language before deferred boot finishes keeps the latest profile', () => {
  const page = boot({ loading: true });
  page.initialize();
  assertLanguage(page, 'es');
  page.click('en');
  page.flush();
  assertLanguage(page, 'en');
  page.click('es');
  assertLanguage(page, 'es');
});

test('missing profile node is harmless', () => {
  const page = boot({ noProfile: true });
  page.initialize();
  page.flush();
  assert.equal(page.root.lang, 'es');
});

test('missing translation preserves existing content', () => {
  const page = boot({ noTranslation: true, profileText: 'Existing profile' });
  page.initialize();
  page.flush();
  assert.equal(page.profile.textContent, 'Existing profile');
});

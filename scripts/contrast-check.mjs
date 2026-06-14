/**
 * WCAG AA contrast check for cv-informatico
 * Uses puppeteer-core + local Chrome to verify color pairs against the live alias.
 * Exit 0 = 0 violations. Exit 1 = violations found.
 */
import puppeteer from 'puppeteer-core';

const TARGET_URL = process.argv[2] || 'https://informatico.stevenvallejo.com';
const CHROME_PATH = '/usr/bin/google-chrome';

// WCAG contrast ratio helpers
function luminance(r, g, b) {
  const [rs, gs, bs] = [r, g, b].map(c => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function contrastRatio(l1, l2) {
  const [bright, dark] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (bright + 0.05) / (dark + 0.05);
}

function parseRgb(color) {
  // handles rgb(r,g,b) and rgba(r,g,b,a)
  const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!m) return null;
  return { r: parseInt(m[1]), g: parseInt(m[2]), b: parseInt(m[3]) };
}

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const full = h.length === 3
    ? h.split('').map(c => c + c).join('')
    : h;
  return {
    r: parseInt(full.slice(0,2), 16),
    g: parseInt(full.slice(2,4), 16),
    b: parseInt(full.slice(4,6), 16),
  };
}

function resolveColor(colorStr) {
  if (!colorStr || colorStr === 'transparent' || colorStr === 'rgba(0, 0, 0, 0)') return null;
  if (colorStr.startsWith('rgb')) return parseRgb(colorStr);
  if (colorStr.startsWith('#')) return hexToRgb(colorStr);
  return null;
}

// WCAG AA thresholds
const NORMAL_TEXT_MIN = 4.5;
const LARGE_TEXT_MIN = 3.0; // >= 18pt or 14pt bold

async function main() {
  console.log(`Checking contrast on: ${TARGET_URL}`);

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    headless: true,
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await page.goto(TARGET_URL, { waitUntil: 'networkidle2', timeout: 30000 });

  // Extract all visible text nodes and their computed fg/bg colors
  const results = await page.evaluate(() => {
    const violations = [];
    const checks = [];

    function getEffectiveBg(el) {
      // Walk up the DOM to find a non-transparent background
      let node = el;
      while (node && node !== document.body.parentElement) {
        const bg = getComputedStyle(node).backgroundColor;
        if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
          return bg;
        }
        node = node.parentElement;
      }
      return 'rgb(11, 20, 23)'; // fallback: --bg
    }

    function getFontSize(el) {
      return parseFloat(getComputedStyle(el).fontSize);
    }

    function getFontWeight(el) {
      return parseInt(getComputedStyle(el).fontWeight);
    }

    function isLargeText(el) {
      const size = getFontSize(el);
      const weight = getFontWeight(el);
      // 18pt = 24px; 14pt bold = ~18.67px
      return size >= 24 || (size >= 18.67 && weight >= 700);
    }

    // Sample key elements: headings, body text, links, labels, tags
    const selectors = [
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'p', 'a', 'span', 'li', 'button',
      '.sec-no', '.tl-org', '.tl-role', '.muted',
      '.tier-label', '.skill-chip', '.tag', '.chip',
      '.hero-headline', '.hero-sub', '.hero-kicker',
      '.btn-primary', '.btn-secondary', '.btn-ghost',
      '.port-card h4 a', '.ach-card h4 a',
      '.lang-toggle button', '.topnav a',
    ];

    const seen = new Set();
    for (const sel of selectors) {
      try {
        const els = document.querySelectorAll(sel);
        els.forEach(el => {
          if (seen.has(el)) return;
          seen.add(el);
          const style = getComputedStyle(el);
          const display = style.display;
          const visibility = style.visibility;
          const opacity = parseFloat(style.opacity);
          if (display === 'none' || visibility === 'hidden' || opacity < 0.1) return;
          const rect = el.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) return;

          const fg = style.color;
          const bg = getEffectiveBg(el);
          const large = isLargeText(el);

          checks.push({
            selector: sel,
            text: (el.textContent || '').trim().slice(0, 60),
            fg,
            bg,
            large,
          });
        });
      } catch (_) {}
    }

    return checks;
  });

  // Compute contrast ratios in Node.js
  const violations = [];
  const passes = [];

  for (const item of results) {
    const fg = resolveColor(item.fg);
    const bg = resolveColor(item.bg);
    if (!fg || !bg) continue;

    const l1 = luminance(fg.r, fg.g, fg.b);
    const l2 = luminance(bg.r, bg.g, bg.b);
    const ratio = contrastRatio(l1, l2);
    const threshold = item.large ? LARGE_TEXT_MIN : NORMAL_TEXT_MIN;
    const pass = ratio >= threshold;

    const record = {
      selector: item.selector,
      text: item.text,
      fg: item.fg,
      bg: item.bg,
      ratio: ratio.toFixed(2),
      threshold,
      large: item.large,
    };

    if (!pass) {
      violations.push(record);
    } else {
      passes.push(record);
    }
  }

  await browser.close();

  console.log(`\nChecked ${results.length} elements, ${passes.length} pass, ${violations.length} violations.\n`);

  if (violations.length > 0) {
    console.error('WCAG AA VIOLATIONS:');
    for (const v of violations) {
      console.error(`  [FAIL] ${v.selector} | text="${v.text}" | fg=${v.fg} bg=${v.bg} | ratio=${v.ratio} (need ${v.threshold})`);
    }
    process.exit(1);
  } else {
    console.log('All checks PASS — 0 WCAG AA violations.');
    process.exit(0);
  }
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

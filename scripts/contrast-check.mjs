/**
 * WCAG AA contrast check for cv-informatico
 * Uses puppeteer-core + local Chrome to verify color pairs against the live alias.
 * Composites rgba transparent backgrounds onto their solid ancestor bg.
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

function contrastRatio(fg, bg) {
  const l1 = luminance(fg.r, fg.g, fg.b);
  const l2 = luminance(bg.r, bg.g, bg.b);
  const [bright, dark] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (bright + 0.05) / (dark + 0.05);
}

function parseColor(color) {
  // handles rgb(r,g,b) and rgba(r,g,b,a)
  const m = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/);
  if (!m) return null;
  return {
    r: parseInt(m[1]),
    g: parseInt(m[2]),
    b: parseInt(m[3]),
    a: m[4] !== undefined ? parseFloat(m[4]) : 1,
  };
}

// Alpha-composite src (with alpha) over dst (opaque)
function composite(src, dst) {
  const a = src.a ?? 1;
  return {
    r: Math.round(src.r * a + dst.r * (1 - a)),
    g: Math.round(src.g * a + dst.g * (1 - a)),
    b: Math.round(src.b * a + dst.b * (1 - a)),
    a: 1,
  };
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

  // Extract all visible text nodes and their computed fg/bg colors + bg stack
  const checks = await page.evaluate(() => {
    function getBgStack(el) {
      // Walk up DOM (starting from the element itself), collect background-color values
      const stack = [];
      let node = el;
      while (node && node !== document.documentElement) {
        const bg = getComputedStyle(node).backgroundColor;
        if (bg && bg !== 'rgba(0, 0, 0, 0)') {
          stack.push(bg);
        }
        node = node.parentElement;
      }
      // fallback: body bg
      stack.push(getComputedStyle(document.body).backgroundColor || 'rgb(11, 20, 23)');
      return stack;
    }

    function isLargeText(el) {
      const size = parseFloat(getComputedStyle(el).fontSize);
      const weight = parseInt(getComputedStyle(el).fontWeight);
      return size >= 24 || (size >= 18.67 && weight >= 700);
    }

    const selectors = [
      'h1', 'h2', 'h3', 'h4',
      'p', 'a', 'button',
      '.sec-no', '.tl-org', '.tl-role',
      '.tier-label', '.skill-chip', '.tag', '.chip',
      '.hero-headline', '.hero-sub', '.hero-kicker',
      '.btn-primary', '.btn-secondary', '.btn-ghost',
      '.port-card h4 a', '.ach-card h4 a',
      '.lang-toggle button', '.topnav a',
    ];

    const seen = new WeakSet();
    const results = [];

    for (const sel of selectors) {
      let els;
      try { els = document.querySelectorAll(sel); } catch (_) { continue; }
      els.forEach(el => {
        if (seen.has(el)) return;
        seen.add(el);
        const style = getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') return;
        if (parseFloat(style.opacity) < 0.1) return;
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;

        // Check if text is gradient (clip-to-text) — skip, not a plain fg color
        const bgClip = style.webkitBackgroundClip || style.backgroundClip;
        const bgImage = style.backgroundImage;
        if ((bgClip === 'text' || bgClip === '-webkit-text') && bgImage !== 'none') return;

        results.push({
          selector: sel,
          text: (el.textContent || '').trim().slice(0, 60),
          fg: style.color,
          bgStack: getBgStack(el),
          large: isLargeText(el),
        });
      });
    }

    return results;
  });

  // Compute contrast ratios in Node.js, compositing rgba backgrounds
  const violations = [];
  const passes = [];

  for (const item of checks) {
    const fg = parseColor(item.fg);
    if (!fg) continue;

    // Composite the bg stack from back to front to get effective opaque bg
    // bgStack[0] is closest ancestor, last is farthest (or body fallback)
    // We composite from the bottom up
    const stack = item.bgStack.map(parseColor).filter(Boolean);

    // Find first fully opaque layer (a >= 1) as the base
    let effectiveBg = { r: 11, g: 20, b: 23, a: 1 }; // fallback --bg
    // Reverse: start from deepest ancestor
    const reversed = [...stack].reverse();
    for (const layer of reversed) {
      if (layer.a >= 0.99) {
        effectiveBg = layer;
      } else {
        effectiveBg = composite(layer, effectiveBg);
      }
    }

    const fgOpaque = fg.a < 1 ? composite(fg, effectiveBg) : fg;
    const ratio = contrastRatio(fgOpaque, effectiveBg);
    const threshold = item.large ? LARGE_TEXT_MIN : NORMAL_TEXT_MIN;

    const record = {
      selector: item.selector,
      text: item.text,
      fg: item.fg,
      effectiveBg: `rgb(${effectiveBg.r},${effectiveBg.g},${effectiveBg.b})`,
      ratio: ratio.toFixed(2),
      threshold,
    };

    if (ratio < threshold) {
      violations.push(record);
    } else {
      passes.push(record);
    }
  }

  await browser.close();

  console.log(`\nChecked ${checks.length} elements: ${passes.length} pass, ${violations.length} violations.\n`);

  if (violations.length > 0) {
    console.error('WCAG AA VIOLATIONS:');
    for (const v of violations) {
      console.error(`  [FAIL] ${v.selector} | "${v.text}" | fg=${v.fg} bg=${v.effectiveBg} | ratio=${v.ratio} (need ${v.threshold})`);
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

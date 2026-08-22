/* UX audit of the Expo web build. For each config (color scheme × viewport
 * width) it does a FRESH page load (dynamic scheme switching repaints
 * unreliably), signs in as dev account 4, walks the main screens, and checks:
 *   - text contrast vs effective background
 *       UNREADABLE < 1.8:1  (the "invisible text" bug class — always listed)
 *       AA-FAIL    < 3:1    (counted, top offenders listed)
 *       WARN       < 4.5:1  (counted only; brand-color small text lands here)
 *   - ellipsized text (scrollWidth > clientWidth on text-overflow: ellipsis)
 *   - horizontal page overflow
 *   - touch targets smaller than 24×24 CSS px
 *   - buttons with no accessible name
 * Findings are a report, not a gate — exit code is always 0.
 *
 * Usage: node ux-audit.js   (expects `npx expo start --web` on :8081)
 */
const { chromium } = require('playwright');

const BASE = 'http://localhost:8081';
const USER_ID = '4';

const CONFIGS = [
  { name: 'light-390', scheme: 'light', width: 390 },
  { name: 'dark-390', scheme: 'dark', width: 390 },
  { name: 'light-320', scheme: 'light', width: 320 },
  { name: 'dark-320', scheme: 'dark', width: 320 },
];

/** Runs inside the page: audit visible text/controls. */
const auditPage = () => {
  const parse = (c) => {
    const m = c.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/);
    return m ? { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] } : null;
  };
  const blend = (fg, bg) => ({
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a),
    a: 1,
  });
  const lum = ({ r, g, b }) => {
    const f = (v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const contrast = (a, b) => {
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };
  /** Effective opaque background behind an element (ancestor blend, top-down). */
  const effectiveBg = (el) => {
    let bg = { r: 255, g: 255, b: 255, a: 1 };
    const chain = [];
    for (let n = el; n; n = n.parentElement) chain.push(n);
    for (const n of chain.reverse()) {
      const c = parse(getComputedStyle(n).backgroundColor);
      if (c && c.a > 0) bg = blend(c, bg);
    }
    return bg;
  };
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    const s = getComputedStyle(el);
    return s.visibility !== 'hidden' && s.display !== 'none' && +s.opacity > 0.05;
  };

  const out = { unreadable: [], aaFail: [], warn: 0, clipped: [], tinyTargets: [], unlabeled: [] };

  for (const el of document.querySelectorAll('div,span,p')) {
    const direct = Array.from(el.childNodes).some(
      (n) => n.nodeType === 3 && n.textContent.trim().length > 0,
    );
    if (!direct || !visible(el)) continue;
    const s = getComputedStyle(el);
    const fg = parse(s.color);
    if (!fg) continue;
    const text = el.textContent.trim().slice(0, 24);
    if (!text) continue;
    // Emoji render as color glyphs (CSS color doesn't apply) and icon fonts
    // (Ionicons) live in the Private Use Area — neither is real "text".
    const letters = text.replace(/[\p{Extended_Pictographic}️‍-\s\d/.·+#()%-]/gu, '');
    if (!letters) continue;
    const bg = effectiveBg(el);
    const ratio = +contrast(blend(fg, bg), bg).toFixed(2);
    const px = parseFloat(s.fontSize);
    const bold = +s.fontWeight >= 700;
    const large = px >= 24 || (px >= 18.66 && bold);
    const min = large ? 3 : 4.5;
    if (ratio < 1.8) out.unreadable.push({ text, ratio, color: s.color });
    else if (ratio < 3) out.aaFail.push({ text, ratio, color: s.color });
    else if (ratio < min) out.warn++;
    if (el.scrollWidth > el.clientWidth + 1 && s.textOverflow === 'ellipsis')
      out.clipped.push({ text });
  }

  for (const el of document.querySelectorAll('[role="button"],[role="checkbox"]')) {
    if (!visible(el)) continue;
    const r = el.getBoundingClientRect();
    // RN hitSlop doesn't reach the DOM, so only flag clearly tiny boxes.
    if (r.width < 24 || r.height < 24)
      out.tinyTargets.push({
        label: (el.getAttribute('aria-label') || el.textContent || '?').trim().slice(0, 20),
        size: `${Math.round(r.width)}x${Math.round(r.height)}`,
      });
    const name = el.getAttribute('aria-label') || el.textContent.trim();
    if (!name) out.unlabeled.push({ html: el.outerHTML.slice(0, 60) });
  }

  const root = document.scrollingElement;
  out.hOverflow = root.scrollWidth > window.innerWidth + 1 ? root.scrollWidth : 0;
  return out;
};

/** One fresh-load walk of all screens under a single config. */
async function runConfig(browser, cfg) {
  const page = await browser.newPage({ viewport: { width: cfg.width, height: 844 } });
  await page.emulateMedia({ colorScheme: cfg.scheme });
  const see = (t, timeout = 20000) =>
    page.getByText(t, { exact: false }).first().waitFor({ timeout });
  // exact:true — 느슨하게 두면 `집`이 `집 탐색`·`우리 집의 목표`까지 매치해
  // `.first()`가 화면 밖 요소를 집고 30초 타임아웃이 난다(house·house-search·settings가
  // 네 컨피그 전부에서 이렇게 빠져 감사 커버리지가 7개 중 4개였다).
  const tapLabel = (l) => page.getByLabel(l, { exact: true }).first().click();

  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await see('로그인', 60000);
  await page.getByPlaceholder('이메일').fill(USER_ID);
  await page.getByPlaceholder('비밀번호').fill('smoke');
  await page.getByText('로그인', { exact: true }).last().click();
  await see('의 방', 25000);

  const SCREENS = [
    ['my-room', async () => {}, '의 방'],
    ['calendar', async () => page.getByText('달력', { exact: true }).first().click(), null],
    ['house', async () => tapLabel('집'), null],
    ['house-search', async () => tapLabel('집 탐색'), '초대코드로 들어가기'],
    ['settings', async () => { await tapLabel('뒤로 가기'); await tapLabel('설정'); }, '튜토리얼 다시 보기'], // prettier-ignore
    // `방 꾸미기`는 캔버스 연필 버튼(#727)과 팝오버 항목이 같은 라벨이라 last()가
    // 메뉴 항목이다 — first()는 모달 뒤에 깔린 캔버스를 집어 클릭이 막힌다(smoke.js와 동일).
    ['decor', async () => { await tapLabel('나의 방'); await tapLabel('메뉴'); await page.getByLabel('방 꾸미기', { exact: true }).last().click(); }, '적용하기'], // prettier-ignore
    ['gacha', async () => { await tapLabel('뒤로가기'); await tapLabel('뽑기 상점'); }, '가구 뽑기'], // prettier-ignore
  ];

  const perScreen = {};
  for (const [name, nav, anchor] of SCREENS) {
    try {
      await nav();
      if (anchor) await see(anchor);
      await page.waitForTimeout(1000);
      perScreen[name] = await page.evaluate(auditPage);
    } catch (e) {
      perScreen[name] = { error: String(e).split('\n')[0].slice(0, 120) };
    }
  }
  await page.close();
  return perScreen;
}

(async () => {
  const browser = await chromium.launch();
  const report = {};
  for (const cfg of CONFIGS) {
    report[cfg.name] = await runConfig(browser, cfg);
  }
  await browser.close();

  let unreadableTotal = 0;
  for (const [cfgName, screens] of Object.entries(report)) {
    console.log(`\n===== ${cfgName} =====`);
    for (const [screen, r] of Object.entries(screens)) {
      if (r.error) {
        console.log(`  ${screen}: NAV ERROR ${r.error}`);
        continue;
      }
      unreadableTotal += r.unreadable.length;
      const bits = [
        r.unreadable.length ? `UNREADABLE ${r.unreadable.length}` : null,
        r.aaFail.length ? `aa-fail ${r.aaFail.length}` : null,
        r.warn ? `warn ${r.warn}` : null,
        r.clipped.length ? `clipped ${r.clipped.length}` : null,
        r.tinyTargets.length ? `tiny ${r.tinyTargets.length}` : null,
        r.unlabeled.length ? `unlabeled ${r.unlabeled.length}` : null,
        r.hOverflow ? `H-OVERFLOW ${r.hOverflow}px` : null,
      ].filter(Boolean);
      console.log(`  ${screen}: ${bits.length ? bits.join(', ') : 'clean'}`);
      for (const f of r.unreadable) console.log(`     ✗✗ ${f.ratio}:1 "${f.text}" (${f.color})`);
      for (const f of r.aaFail.slice(0, 3)) console.log(`     ✗ ${f.ratio}:1 "${f.text}"`);
      for (const f of r.clipped.slice(0, 3)) console.log(`     … clipped "${f.text}"`);
      for (const f of r.tinyTargets.slice(0, 3)) console.log(`     ▫ ${f.size} "${f.label}"`);
    }
  }
  console.log(`\nUNREADABLE total (the ship-blocker class): ${unreadableTotal}`);
})();

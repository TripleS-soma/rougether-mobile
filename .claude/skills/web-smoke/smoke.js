/* Full-UI smoke drive of the Expo web build against the live dev API.
 *
 * Signs in as the fixed dev account (userId 4 — email field "4", any
 * password), then walks every main surface: my room → calendar → routine
 * toggle (cycled back to leave the account unchanged) → group house →
 * house search → settings → room decor → gacha. Handles both fresh and
 * already-onboarded accounts. Each step screenshots; failures don't stop
 * the run. Screenshots land in ./shots.
 *
 * Usage: node smoke.js   (expects `npx expo start --web` on :8081)
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE = 'http://localhost:8081';
const USER_ID = '4';
const SHOTS = path.join(__dirname, 'shots');
fs.mkdirSync(SHOTS, { recursive: true });

const results = [];
const consoleErrors = [];
const netFailures = [];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 300));
  });
  page.on('requestfailed', (req) => {
    netFailures.push(`${req.method()} ${req.url().slice(0, 120)} → ${req.failure()?.errorText}`);
  });
  page.on('response', (res) => {
    if (res.status() >= 400 && res.url().includes('43.203'))
      netFailures.push(
        `${res.request().method()} ${res.url().slice(0, 120)} → HTTP ${res.status()}`,
      );
  });

  let shotIdx = 0;
  const step = async (name, fn) => {
    try {
      await fn();
      await page.screenshot({
        path: path.join(SHOTS, `${String(++shotIdx).padStart(2, '0')}-${name}.png`),
      });
      results.push(`PASS ${name}`);
    } catch (e) {
      await page
        .screenshot({
          path: path.join(SHOTS, `${String(++shotIdx).padStart(2, '0')}-${name}-FAIL.png`),
        })
        .catch(() => {});
      results.push(`FAIL ${name}: ${String(e).split('\n')[0].slice(0, 200)}`);
    }
  };
  const see = (text, timeout = 15000) =>
    page.getByText(text, { exact: false }).first().waitFor({ timeout });
  const tap = async (text) => page.getByText(text, { exact: false }).first().click();
  const tapLabel = async (label) => page.getByLabel(label, { exact: false }).first().click();

  await step('boot-to-login', async () => {
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await see('로그인', 60000);
  });

  await step('dev-login-user4', async () => {
    await page.getByPlaceholder('이메일').fill(USER_ID);
    await page.getByPlaceholder('비밀번호').fill('smoke'); // any password works
    const respP = page
      .waitForResponse((r) => r.url().includes('/auth/dev-login'), { timeout: 20000 })
      .catch(() => null);
    await page.getByText('로그인', { exact: true }).last().click();
    const resp = await respP;
    results.push(
      resp ? `INFO dev-login HTTP ${resp.status()}` : 'INFO dev-login: no response observed',
    );
    // Existing accounts land in the room; fresh ones see onboarding first.
    await Promise.race([see('의 방', 25000), see('루게더에 오신 걸 환영해요', 25000)]);
  });

  await step('onboarding-if-fresh', async () => {
    const intro = page.getByText('루게더에 오신 걸 환영해요');
    if (await intro.isVisible().catch(() => false)) {
      await tap('건너뛰기');
      await see('관심 있는 목표를 골라주세요');
      await page.getByRole('checkbox').first().click();
      await tap('시작하기');
      await tap('캐릭터 선택하기');
      results.push('INFO onboarding: completed fresh flow');
    } else {
      results.push('INFO onboarding: already onboarded, skipped');
    }
    await see('의 방', 20000);
  });

  await step('myroom-tabs', async () => {
    await page.getByText('달력', { exact: true }).first().click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(SHOTS, 'extra-calendar.png') });
    await page.getByText('방', { exact: true }).first().click();
  });

  await step('routine-toggle-cycle', async () => {
    // Toggle the first routine checkbox on and back off so the run leaves
    // account 4 exactly as it found it (server logs a completion + a cancel).
    const boxes = page.getByRole('checkbox');
    if ((await boxes.count()) === 0) {
      results.push('INFO no routines to toggle on account 4');
      return;
    }
    const first = boxes.first();
    await first.click();
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(SHOTS, 'extra-toggled.png') });
    await first.click(); // restore
    await page.waitForTimeout(800);
  });

  await step('house-tab', async () => {
    await tapLabel('집');
    // Either the empty-state guide or a populated house view is fine.
    // #287: 미션 카드는 플로팅 버튼 → 시트로 이동 — 스탯 행이 집 화면 앵커.
    await Promise.race([see('아직 함께하는 집이 없어요'), see('진행 중 미션')]);
  });

  await step('house-search', async () => {
    await tapLabel('집 탐색');
    await see('초대코드로 들어가기');
    await tapLabel('뒤로 가기');
  });

  await step('settings-tab', async () => {
    await tapLabel('설정');
    await see('온보딩 다시 보기');
  });

  await step('decor-screen', async () => {
    await tapLabel('나의 방');
    await see('의 방');
    await tapLabel('메뉴');
    await page.getByLabel('방 꾸미기', { exact: true }).first().click();
    await see('적용하기', 15000);
    await see('벽지');
    await tapLabel('뒤로가기');
    await see('의 방');
  });

  await step('gacha-screen', async () => {
    await tapLabel('뽑기 상점');
    // 화면 타이틀은 '뽑기' — 탭 라벨('가구 뽑기')이 안정적인 앵커.
    await see('가구 뽑기', 15000);
    await page.waitForTimeout(1500); // machine list loads from the API
  });

  await browser.close();

  console.log('\n=== RESULTS ===');
  results.forEach((r) => console.log(r));
  console.log('\n=== CONSOLE ERRORS (first 10) ===');
  [...new Set(consoleErrors)].slice(0, 10).forEach((e) => console.log('-', e));
  console.log('\n=== NETWORK FAILURES (first 10) ===');
  [...new Set(netFailures)].slice(0, 10).forEach((e) => console.log('-', e));
  const fails = results.filter((r) => r.startsWith('FAIL')).length;
  console.log(`\n${fails === 0 ? 'ALL PASS' : `${fails} FAILED`}`);
  process.exit(fails === 0 ? 0 : 1);
})();

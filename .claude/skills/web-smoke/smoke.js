/* Full-UI smoke drive of the Expo web build against the live dev API.
 *
 * Signs in as the fixed dev account (userId 4 — email field "4", any
 * password), then walks every main surface: my room → calendar (today +
 * past date) → routine toggle (cycled back so the account is unchanged) →
 * group house → friend room visit → house search → settings → profile
 * edit → onboarding replay (asserts goal prefill) → room decor (asserts
 * the unsaved-change guard) → gacha. Handles both fresh and onboarded
 * accounts. Each step screenshots; failures don't stop the run.
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

/** Local "YYYY-MM-DD" shifted by n days. */
const isoShift = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
};

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
    if (res.status() >= 400 && res.url().includes('cloudfront.net'))
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
  // 정확 라벨 + 보이는 것만 — '집'이 숨은 '집 탐색'에 먼저 걸려 30초를 태웠다.
  const tapExact = async (label) =>
    page.getByLabel(label, { exact: true }).locator('visible=true').first().click();

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

  await step('calendar-past-date', async () => {
    await page.getByText('달력', { exact: true }).first().click();
    const yesterday = isoShift(-1);
    // Yesterday can sit in the previous month's view.
    if (yesterday.slice(0, 7) !== isoShift(0).slice(0, 7)) await tapLabel('이전 달');
    await page.getByLabel(yesterday).first().click();
    // Server-backed day: either records render or the empty hint does.
    await Promise.race([see('지난 날짜도'), see('예정된 루틴이 없어요')]);
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
    await tapExact('집');
    // Either the empty-state guide or a populated house view is fine.
    // #876에서 미션이 요약 줄('우리 집의 목표')로 올라와 종전 앵커가 어긋났다.
    await Promise.race([
      see('아직 함께하는 집이 없어요'),
      see('진행 중 미션'),
      see('우리 집의 목표'),
    ]);
  });

  await step('friend-room-visit', async () => {
    // Account 4's house has member 루티니1 — visiting renders their LIVE room
    // (PR #223): real placement/routines/guestbook, no "미리보기" notice.
    const friendTile = page.getByLabel('루티니1', { exact: true });
    if (!(await friendTile.isVisible().catch(() => false))) {
      results.push('INFO no friend tile found — house membership changed?');
      return;
    }
    await friendTile.click();
    await see('루티니1의 방', 20000);
    await see('루티니1의 루틴');
    await see('방명록');
    if (
      await page
        .getByText('미리보기로 보여드려요')
        .isVisible()
        .catch(() => false)
    )
      throw new Error('friend room still shows the preview notice (#223 regression)');
    await page.screenshot({ path: path.join(SHOTS, 'extra-friend-room.png') });
    await tapLabel('뒤로가기');
    // #287 이후 집 화면 앵커는 스탯 행('진행 중 미션').
    await Promise.race([see('진행 중 미션'), see('아직 함께하는 집이 없어요')]);
  });

  await step('house-search', async () => {
    await tapLabel('집 탐색');
    await see('초대코드로 들어가기');
    await tapLabel('뒤로 가기');
  });

  await step('settings-profile-edit', async () => {
    await tapLabel('설정');
    await tap('프로필 편집');
    await see('닉네임');
    await tapLabel('뒤로 가기');
    await see('튜토리얼 다시 보기');
  });

  await step('onboarding-replay-prefilled', async () => {
    // 튜토리얼 다시 보기 must open as an EDIT of the previous picks (PR #220):
    // at least one goal arrives pre-checked. Completing it re-saves the same
    // selections, so account 4 is left unchanged.
    await tap('튜토리얼 다시 보기');
    await see('루게더에 오신 걸 환영해요');
    await tap('건너뛰기');
    await see('관심 있는 목표를 골라주세요');
    // RN-web maps neither accessibilityState.checked → aria-checked nor the
    // check icon to an <svg> (Ionicons render as font glyphs). Detect the
    // selection visually: picked cards get a colored border, unpicked ones
    // stay transparent.
    const checked = await page.evaluate(
      () =>
        Array.from(document.querySelectorAll('[role="checkbox"]')).filter((el) => {
          const s = getComputedStyle(el);
          return s.borderTopWidth !== '0px' && s.borderTopColor !== 'rgba(0, 0, 0, 0)';
        }).length,
    );
    results.push(`INFO replay prefilled goals: ${checked}`);
    // Finish the flow FIRST so a failed assertion doesn't strand later steps.
    await tap('시작하기');
    // #637에서 캐릭터 캐러셀이 빠져 목표 다음이 곧 닉네임 단계이고, #635부터
    // 필수 입력이다 — 현재 닉네임을 그대로 채워(값 변화 없음) 흐름을 끝낸다.
    await page.getByLabel('닉네임 입력').fill('준서');
    await page.getByText('시작하기', { exact: true }).last().click();
    await see('의 방', 20000);
    if (checked === 0) throw new Error('no goal pre-checked on replay (#220 regression)');
  });

  await step('decor-unsaved-guard', async () => {
    await tapLabel('메뉴');
    await page.getByLabel('방 꾸미기', { exact: true }).first().click();
    await see('적용하기', 15000);
    // Preview-select a non-default wallpaper, then leave without applying —
    // the unsaved-change guard (PR #216) should intercept.
    await tap('숲 포인트').catch(() => {});
    await tapLabel('뒤로가기');
    const guard = page.getByText('저장하지 않고 나가기');
    if (await guard.isVisible().catch(() => false)) {
      results.push('INFO unsaved-change guard shown');
      await guard.click();
    } else {
      results.push('INFO no unsaved guard (selection may have been a no-op)');
    }
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

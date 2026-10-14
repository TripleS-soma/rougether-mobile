const { chromium } = require('@playwright/test');
const fs = require('node:fs');
const assert = require('node:assert/strict');

async function qa() {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 420, height: 580 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  await page.goto('http://127.0.0.1:5180/');
  const state = () => page.evaluate(() => JSON.parse(window.render_game_to_text()));
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'title');
  await page.screenshot({ path: 'output/rhythm/title.png' });
  await page.locator('#start').click();
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'running');
  const realEvents = [];
  for (let i = 0; i < 6; i++) {
    const note = (await state()).next;
    await page.waitForFunction(
      (target) => JSON.parse(window.render_game_to_text()).songTime >= target,
      note.target - 0.016,
      { polling: 'raf' },
    );
    await page.keyboard.down('Space');
    if (note.hold) {
      await page.keyboard.press('KeyP');
      const paused = (await state()).songTime;
      await page.waitForTimeout(300);
      assert.equal((await state()).songTime, paused);
      await page.keyboard.up('Space');
      await page.locator('#resume').click();
      await page.keyboard.down('Space');
      await page.waitForFunction(
        (target) => JSON.parse(window.render_game_to_text()).songTime >= target,
        note.target + note.hold - 0.016,
        { polling: 'raf' },
      );
    }
    await page.keyboard.up('Space');
    realEvents.push((await state()).feedback);
  }
  const audio = await page.evaluate(() => window.get_rhythm_audio_diagnostics());
  assert.equal(realEvents.filter((event) => event.grade === 'perfect').length, 6);
  assert.equal((await state()).perfect, 6);
  await page.screenshot({ path: 'output/rhythm/playing.png' });
  await page.keyboard.press('KeyP');
  const paused = (await state()).songTime;
  await page.waitForTimeout(300);
  assert.equal((await state()).songTime, paused);
  await page.screenshot({ path: 'output/rhythm/paused.png' });
  await page.reload();
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'title');
  await page.locator('#start').click();
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'running');
  await page.evaluate(() => window.advanceTime(0));
  for (let i = 0; i < 32; i++) {
    const current = await state(),
      note = current.next;
    await page.evaluate((ms) => window.advanceTime(ms), (note.target - current.songTime) * 1000);
    await page.keyboard.down('Space');
    if (note.hold) await page.evaluate((ms) => window.advanceTime(ms), note.hold * 1000);
    await page.keyboard.up('Space');
  }
  await page.evaluate(() => window.advanceTime(4000));
  const result = await state();
  assert.equal(result.mode, 'result');
  assert.equal(result.perfect, 32);
  assert.equal(result.miss, 0);
  await page.screenshot({ path: 'output/rhythm/result.png' });
  await page.locator('#again').click();
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'running');
  assert.equal((await state()).score, 0);
  await page.evaluate(() => window.setRhythmActive(false));
  assert.equal((await state()).mode, 'paused');
  await page.evaluate(() => window.setRhythmActive(true));
  assert.equal((await state()).mode, 'paused');
  await page.setViewportSize({ width: 390, height: 540 });
  await page.screenshot({ path: 'output/rhythm/mobile.png' });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  assert.deepEqual(errors, []);
  fs.writeFileSync(
    'output/rhythm/browser-report.json',
    JSON.stringify({ realEvents, audio, fullStage: result, errors }, null, 2),
  );
  await browser.close();
  process.stdout.write(
    'Real audio: 6 PERFECT incl held pause/resume. Full deterministic stage: 32 PERFECT. Lifecycle/mobile/errors PASS.\n',
  );
}
qa().catch((error) => {
  process.stderr.write(String(error));
  process.exitCode = 1;
});

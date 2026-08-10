/* 스토어 스크린샷 초안 — iPhone 6.9" 규격(1320×2868 = 440×956 @3x).
 * dev-login userId 4로 주요 화면 5장 캡처. Usage: node store-shots.js */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE = 'http://localhost:8081';
const OUT = path.join(__dirname, 'store-shots');
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 440, height: 956 },
    deviceScaleFactor: 3,
  });
  const see = (text, timeout = 20000) =>
    page.getByText(text, { exact: false }).first().waitFor({ timeout });
  const shot = async (name) => {
    await page.waitForTimeout(1200); // 이미지·애니메이션 정착
    await page.screenshot({ path: path.join(OUT, `${name}.png`) });
    console.log('shot', name);
  };

  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await see('로그인', 60000);
  await page.getByPlaceholder('이메일').fill('4');
  await page.getByPlaceholder('비밀번호').fill('shots');
  await page.getByText('로그인', { exact: true }).last().click();
  await see('의 방', 25000);

  await shot('01-my-room');

  // 방 꾸미기
  await page
    .getByLabel('방 꾸미기', { exact: false })
    .first()
    .click()
    .catch(async () => {
      await page.getByText('꾸미기', { exact: false }).first().click();
    });
  await see('적용하기', 20000);
  await shot('02-room-decor');
  await page
    .getByLabel(/뒤로 ?가기/, { exact: false })
    .first()
    .click()
    .catch(() => {});
  await page.waitForTimeout(800);

  // 집
  await page.getByText('집', { exact: true }).first().click();
  await see('멤버', 20000);
  await shot('03-house');

  // 뽑기 (나의 방 → 뽑기 진입점)
  await page
    .getByText('나의 방', { exact: true })
    .first()
    .click()
    .catch(() => {});
  await page.waitForTimeout(800);
  await page
    .getByLabel('뽑기', { exact: false })
    .first()
    .click()
    .catch(async () => {
      await page.getByText('뽑기', { exact: false }).first().click();
    });
  await see('1회 뽑기', 20000);
  await shot('04-gacha');

  // 달력
  await page
    .getByLabel(/뒤로 ?가기/, { exact: false })
    .first()
    .click()
    .catch(() => {});
  await page.waitForTimeout(800);
  await page
    .getByText('달력', { exact: true })
    .first()
    .click()
    .catch(() => {});
  await page.waitForTimeout(1000);
  await shot('05-calendar');

  await browser.close();
  console.log('DONE', OUT);
})();

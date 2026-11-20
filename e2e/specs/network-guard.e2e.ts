/**
 * 그물(`networkGuard`)이 route가 못 보는 길까지 막는지 — 웹소켓과 `window.open` 팝업.
 * 실제 그물이 잡은 목록을 단언한 뒤 비운다. 비우지 않으면 테스트 끝 검사가 (의도대로) 실패한다.
 */
import sharedEndpoints from '../../src/config/shared-endpoints.json';
import { mockApi } from '../support/api-mock';
import { expect, test } from '../support/app';

/** 앱의 채팅 소켓 주소 — `src/lib/chat-socket.ts`와 같은 규칙(https → wss). */
const CHAT_SOCKET_URL = `${sharedEndpoints.apiBase.replace(/^http/, 'ws')}/chat/ws`;
const POPUP_URL = 'https://example.com/e2e-popup';

test('웹소켓은 그물에 걸려 서버에 잇지 않고 닫힌다', async ({ page, networkGuard }) => {
  // 앱의 http 요청은 고정 응답으로 받는다 — 그물에는 웹소켓만 남게.
  const unmocked = await mockApi(page);
  await page.goto('/');
  // 페이지 쪽 소켓은 닫힘으로 끝나야 한다 — 안 닫히면 여기서 테스트 시한을 넘긴다.
  await page.evaluate(
    (url) =>
      new Promise<void>((resolve) => {
        new WebSocket(url).addEventListener('close', () => resolve());
      }),
    CHAT_SOCKET_URL,
  );
  expect(networkGuard).toEqual([`WS ${CHAT_SOCKET_URL}`]);
  expect(unmocked).toEqual([]);
  networkGuard.length = 0;
});

test('window.open 팝업의 바깥 요청도 그물에 걸린다', async ({ page, context, networkGuard }) => {
  const unmocked = await mockApi(page);
  await page.goto('/');
  // 팝업은 새 페이지라 mockApi(페이지 route)가 없다 — 컨텍스트의 그물만 받는다.
  const failed = context.waitForEvent('requestfailed', (r) => r.url() === POPUP_URL);
  await page.evaluate((url) => void window.open(url), POPUP_URL);
  const request = await failed;
  // 그물의 abort('blockedbyclient') — 이름 풀이·연결 실패가 아니라 보내기 전에 끊겼다.
  expect(request.failure()?.errorText).toBe('net::ERR_BLOCKED_BY_CLIENT');
  expect(networkGuard).toEqual([`GET ${POPUP_URL}`]);
  expect(unmocked).toEqual([]);
  networkGuard.length = 0;
});

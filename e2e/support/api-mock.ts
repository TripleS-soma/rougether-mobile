import type { Page, Route } from '@playwright/test';

import sharedEndpoints from '../../src/config/shared-endpoints.json';
import { FIXTURES } from '../fixtures';
import { BLANK_PNG } from '../fixtures/common';

/** 키: 'GET /today' 처럼 '<METHOD> <api/v1 뒤 경로 패턴>'. 값: 그 요청의 JSON 응답 본문(Buffer면 PNG). */
export type MockOverrides = Record<string, unknown>;

/** 앱이 부르는 API의 경로 접두(`/api/v1`) — 앱과 같은 단일 출처에서 읽는다. */
const API_PREFIX = new URL(sharedEndpoints.apiBase).pathname.replace(/\/+$/, '');
const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost']);

const IMAGE_HOSTS = new Set([new URL(sharedEndpoints.assetBase).hostname]);
const IMAGE_PATH = /\.(png|jpe?g|webp|gif)$/i;

type Matcher = { method: string; regex: RegExp; body: unknown };

/** 'GET /houses/:id/members' → 메서드와 정규식. `:id`는 숫자 한 토막과 맞춘다. */
function compile(key: string, body: unknown): Matcher {
  const [method, pattern] = key.split(' ');
  if (!method || !pattern?.startsWith('/')) throw new Error(`잘못된 고정 응답 키: ${key}`);
  const source = pattern
    .split('/')
    .map((seg) => (seg === ':id' ? '\\d+' : seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    .join('/');
  return { method: method.toUpperCase(), regex: new RegExp(`^${source}$`), body };
}

function isApi(url: URL): boolean {
  return url.pathname === API_PREFIX || url.pathname.startsWith(`${API_PREFIX}/`);
}

function fulfillJson(route: Route, status: number, body: unknown) {
  // 앱(웹)은 다른 출처의 API를 부르므로 CORS 헤더가 있어야 응답을 읽는다.
  if (Buffer.isBuffer(body)) {
    return route.fulfill({
      status,
      contentType: 'image/png',
      headers: { 'access-control-allow-origin': '*' },
      body,
    });
  }
  return route.fulfill({
    status,
    contentType: 'application/json',
    headers: { 'access-control-allow-origin': '*' },
    body: body === undefined ? '' : JSON.stringify(body),
  });
}

/** 앱 밖의 호스트(이미지 CDN·분석·오류 수집 등) — 이미지는 투명 PNG, 나머지는 빈 204. */
function fulfillExternal(route: Route, url: URL) {
  if (IMAGE_HOSTS.has(url.hostname) || IMAGE_PATH.test(url.pathname)) {
    return route.fulfill({
      status: 200,
      contentType: 'image/png',
      headers: { 'access-control-allow-origin': '*' },
      body: BLANK_PNG,
    });
  }
  return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' } });
}

/**
 * api/v1 요청을 전부 가로챈다(모든 메서드·모든 호스트). 돌려주는 배열에 가로채지 못한
 * 요청('GET /foo')이 쌓이고, 그 요청은 501 `{ code: 'E2E_UNMOCKED' }`로 답한다.
 * 로컬 정적 서버 밖의 나머지 호스트도 모두 가짜 응답으로 막아 실제 서버에 닿지 않는다.
 */
export async function mockApi(page: Page, overrides: MockOverrides = {}): Promise<string[]> {
  // 덮어쓰기가 먼저 걸리도록 앞에 둔다.
  const matchers = [
    ...Object.entries(overrides).map(([k, v]) => compile(k, v)),
    ...Object.entries(FIXTURES).map(([k, v]) => compile(k, v)),
  ];
  const unmocked: string[] = [];

  await page.route(
    (url) => isApi(url) || !LOCAL_HOSTS.has(url.hostname),
    (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (!isApi(url)) return fulfillExternal(route, url);

      const method = request.method().toUpperCase();
      // 웹에서 Authorization 헤더가 붙은 요청은 사전 요청(OPTIONS)이 먼저 간다.
      if (method === 'OPTIONS') {
        return route.fulfill({
          status: 204,
          headers: {
            'access-control-allow-origin': '*',
            'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE',
            'access-control-allow-headers': '*',
          },
        });
      }
      const path = url.pathname.slice(API_PREFIX.length) || '/';
      const hit = matchers.find((m) => m.method === method && m.regex.test(path));
      if (hit) return fulfillJson(route, 200, hit.body);

      unmocked.push(`${method} ${path}`);
      return fulfillJson(route, 501, { code: 'E2E_UNMOCKED' });
    },
  );
  return unmocked;
}

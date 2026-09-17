/**
 * 버그 제보 진단 기록 (#1162) — 최근 화면 이동·API 요청·앱 상태를 **기기 메모리**에만
 * 제한된 개수로 보관하고, 사용자가 버그 제보에 첨부를 켜 두었을 때만 요약으로 보낸다.
 *
 * 수집하지 않는 것(설계상 필드 자체가 없다): 요청 본문, 인증 정보(토큰·헤더), 쿼리 값,
 * 사용자 입력, 경로 안의 식별자(숫자 id·코드·UUID는 `{id}`로 지운다).
 *
 * 저장소에 쓰지 않는다 — 앱을 껐다 켜면 비고, 계정이 바뀌면(세션 정리) 비운다.
 * 기록 실패가 요청·화면 전환을 절대 막지 않도록 모든 진입점이 예외를 삼킨다.
 */

export const DIAGNOSTICS_MAX_EVENTS = 50;
/** 이보다 오래된 이벤트는 요약에서 뺀다 — 제보 직전 상황만 필요하다. */
export const DIAGNOSTICS_MAX_AGE_MS = 10 * 60 * 1000;

export type DiagnosticsEvent =
  | { kind: 'screen'; at: number; screen: string }
  | {
      kind: 'api';
      at: number;
      method: string;
      /** 정규화된 경로 — 쿼리 제거, 식별자 `{id}`. */
      path: string;
      /**
       * 성공은 `'ok'`(응답 파서가 2xx 본문만 돌려줘 정확한 코드를 모른다), 실패는 HTTP 상태코드,
       * 응답이 없던 네트워크 실패는 0.
       */
      status: number | 'ok';
      durationMs: number;
      /**
       * 서버가 응답 헤더로 준 요청 ID — 서버 관측 기록과 잇는 열쇠. 2026-09-16 기준 서버가
       * 요청 ID 헤더를 주지 않아 비어 있다(계약 제안: `X-Request-Id`, #1162).
       */
      requestId?: string;
    }
  | { kind: 'app'; at: number; state: string };

let events: DiagnosticsEvent[] = [];

function push(event: DiagnosticsEvent) {
  try {
    events.push(event);
    if (events.length > DIAGNOSTICS_MAX_EVENTS) {
      events = events.slice(events.length - DIAGNOSTICS_MAX_EVENTS);
    }
  } catch {
    // 진단 기록은 부가 기능 — 무엇도 막지 않는다.
  }
}

/**
 * 경로 정규화 — 쿼리·해시를 떼고, 식별자로 보이는 세그먼트를 `{id}`로 바꾼다.
 * 숫자만(회원·루틴 id), UUID, 숫자가 섞인 6자 이상 영숫자(초대코드 등).
 */
export function normalizeDiagnosticsPath(path: string): string {
  const bare = path.split(/[?#]/)[0];
  return bare
    .split('/')
    .map((seg) => {
      if (!seg) return seg;
      if (/^\d+$/.test(seg)) return '{id}';
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(seg))
        return '{id}';
      if (seg.length >= 6 && /\d/.test(seg) && /^[A-Za-z0-9_-]+$/.test(seg)) return '{id}';
      return seg;
    })
    .join('/');
}

export function recordScreen(screen: string, now = Date.now()) {
  push({ kind: 'screen', at: now, screen });
}

export function recordApi(
  input: {
    method: string;
    path: string;
    status: number | 'ok';
    durationMs: number;
    requestId?: string;
  },
  now = Date.now(),
) {
  try {
    push({
      kind: 'api',
      at: now,
      method: input.method,
      path: normalizeDiagnosticsPath(input.path),
      status: input.status,
      durationMs: Math.max(0, Math.round(input.durationMs)),
      requestId: input.requestId,
    });
  } catch {
    // no-op
  }
}

export function recordAppState(state: string, now = Date.now()) {
  push({ kind: 'app', at: now, state });
}

/** 계정 전환·로그아웃 — 다른 사용자의 기록이 섞이지 않게. */
export function clearDiagnostics() {
  events = [];
}

/** 최근 이벤트(오래된 순) — 최대 보관 시간 안의 것만. */
export function recentDiagnostics(now = Date.now()): DiagnosticsEvent[] {
  return events.filter((e) => now - e.at <= DIAGNOSTICS_MAX_AGE_MS);
}

function line(e: DiagnosticsEvent, now: number): string {
  const ago = `-${Math.max(0, Math.round((now - e.at) / 1000))}s`;
  if (e.kind === 'screen') return `${ago} screen ${e.screen}`;
  if (e.kind === 'app') return `${ago} app ${e.state}`;
  const rid = e.requestId ? ` rid=${e.requestId}` : '';
  return `${ago} ${e.method} ${e.path} ${e.status} ${e.durationMs}ms${rid}`;
}

/**
 * 제보 본문에 붙일 요약 — `budget` 글자 안에서 **최근 이벤트를 우선** 남긴다(오래된 줄부터
 * 버린다). 헤더와 Sentry 이벤트 ID는 항상 싣고, 그조차 안 들어가면 빈 문자열.
 */
export function formatDiagnostics(options: {
  budget: number;
  header: string;
  sentryEventId?: string;
  now?: number;
}): string {
  const now = options.now ?? Date.now();
  const head = [options.header];
  if (options.sentryEventId) head.push(`sentry ${options.sentryEventId}`);
  const headText = head.join('\n');
  if (headText.length > options.budget) return '';
  const lines = recentDiagnostics(now).map((e) => line(e, now));
  const kept: string[] = [];
  let used = headText.length;
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const cost = lines[i].length + 1;
    if (used + cost > options.budget) break;
    kept.unshift(lines[i]);
    used += cost;
  }
  return [headText, ...kept].join('\n');
}

/** 테스트 전용 — 모듈 상태 초기화. */
export function __resetDiagnosticsForTests() {
  events = [];
}

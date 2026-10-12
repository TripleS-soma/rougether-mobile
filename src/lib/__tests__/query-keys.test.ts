import { queryKeys } from '@/lib/query-keys';

/**
 * react-query 키 레지스트리 불변식 — 리터럴을 하나하나 박지 않고 레지스트리 전체를 훑는다.
 * 새 키를 추가하면 자동으로 이 검사들에 들어온다.
 */

type KeyFn = (...args: unknown[]) => readonly unknown[];
type Entry = { path: string; group: string; fn?: KeyFn; key?: readonly unknown[] };

function collect(node: unknown, path: string[] = []): Entry[] {
  if (typeof node === 'function') {
    return [{ path: path.join('.'), group: path[0], fn: node as KeyFn }];
  }
  if (Array.isArray(node)) return [{ path: path.join('.'), group: path[0], key: node }];
  return Object.entries(node as Record<string, unknown>).flatMap(([k, v]) =>
    collect(v, [...path, k]),
  );
}

const entries = collect(queryKeys);

/** 첫 인자가 userId가 아닌 키 팩토리 — 사용자 무관(카탈로그)이거나 다른 id로 스코프. */
const NOT_USER_SCOPED = new Set(['minigames.catalog', 'houseAutoJoin', 'memberRoom.one']);

const userScoped = entries.filter((e) => e.fn && !NOT_USER_SCOPED.has(e.path));

const USER_A = 101;
const USER_B = 202;
/** userId 뒤 인자 자리 — 서로 다른 값이라 userId와 섞이지 않는다. */
const restArgs = (fn: KeyFn) =>
  Array.from({ length: Math.max(0, fn.length - 1) }, (_, i) => 9000 + i);

const isPrefix = (prefix: readonly unknown[], key: readonly unknown[]) =>
  prefix.length <= key.length && prefix.every((part, i) => Object.is(part, key[i]));

describe('queryKeys 레지스트리', () => {
  it('제외 목록의 경로가 실제로 존재한다(이름이 바뀌면 이 테스트가 먼저 알린다)', () => {
    const paths = new Set(entries.map((e) => e.path));
    for (const p of NOT_USER_SCOPED) expect(paths).toContain(p);
  });

  it('사용자별 키는 userId를 정적 네임스페이스 바로 뒤에 둔다 — 대부분 두 번째 원소', () => {
    for (const { path, fn } of userScoped) {
      const key = fn!(USER_A, ...restArgs(fn!));
      const index = key.indexOf(USER_A);
      expect({ path, found: index > 0 }).toEqual({ path, found: true });
      // userId 앞은 전부 문자열 리터럴(네임스페이스) — 무효화 접두가 사용자와 무관하게 정해진다.
      expect({ path, ns: key.slice(0, index).every((p) => typeof p === 'string') }).toEqual({
        path,
        ns: true,
      });
    }
  });

  it('대부분의 사용자별 키는 userId가 정확히 [1]이다(두 단어 네임스페이스 me·rooms 예외)', () => {
    const twoSegment = userScoped
      .filter(({ fn }) => fn!(USER_A, ...restArgs(fn!))[1] !== USER_A)
      .map((e) => e.path)
      .sort();
    expect(twoSegment).toEqual(['myCharacters.byUser', 'myItems.byUser', 'myRoom.byUser']);
  });

  it('userId가 다르면 키가 달라진다 — 계정 전환 시 남의 캐시를 읽지 않는다', () => {
    for (const { path, fn } of userScoped) {
      const a = fn!(USER_A, ...restArgs(fn!));
      const b = fn!(USER_B, ...restArgs(fn!));
      expect({ path, same: JSON.stringify(a) === JSON.stringify(b) }).toEqual({
        path,
        same: false,
      });
    }
  });

  it('접두 키(all·lists·allComments)는 같은 그룹 자식 키의 접두라 접두 무효화가 닿는다', () => {
    const groups = new Map<string, Entry[]>();
    for (const e of entries) groups.set(e.group, [...(groups.get(e.group) ?? []), e]);

    const build = (e: Entry) =>
      e.key ?? (NOT_USER_SCOPED.has(e.path) ? e.fn!(1, 2) : e.fn!(USER_A, ...restArgs(e.fn!)));

    let checked = 0;
    for (const [group, members] of groups) {
      const prefix = members.find((m) => m.path === `${group}.all`);
      if (!prefix) continue;
      const prefixKey = build(prefix);
      for (const child of members) {
        if (child === prefix) continue;
        expect({ child: child.path, ok: isPrefix(prefixKey, build(child)) }).toEqual({
          child: child.path,
          ok: true,
        });
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(0);

    // 피드 — 목록 접두(lists)와 모든 댓글 접두(allComments)
    expect(isPrefix(queryKeys.feed.lists(USER_A), queryKeys.feed.list(USER_A, null))).toBe(true);
    expect(isPrefix(queryKeys.feed.lists(USER_A), queryKeys.feed.list(USER_A, 7, 'FREE'))).toBe(
      true,
    );
    expect(isPrefix(queryKeys.feed.lists(USER_A), queryKeys.feed.post(USER_A, 7))).toBe(false);
    expect(isPrefix(queryKeys.feed.allComments(USER_A), queryKeys.feed.comments(USER_A, 7))).toBe(
      true,
    );
  });

  it('feed.list의 게시판 기본값은 ALL(통합 피드)', () => {
    expect(queryKeys.feed.list(USER_A, null)).toEqual(queryKeys.feed.list(USER_A, null, 'ALL'));
  });

  it('서로 다른 그룹의 키는 접두 관계가 아니다 — 한 그룹 무효화가 남의 캐시를 건드리지 않는다', () => {
    const built = entries.map((e) => ({
      ...e,
      k: e.key ?? (NOT_USER_SCOPED.has(e.path) ? e.fn!(1, 2) : e.fn!(USER_A, ...restArgs(e.fn!))),
    }));
    for (const a of built) {
      for (const b of built) {
        if (a.group === b.group) continue;
        expect({ a: a.path, b: b.path, prefix: isPrefix(a.k, b.k) }).toEqual({
          a: a.path,
          b: b.path,
          prefix: false,
        });
      }
    }
  });
});

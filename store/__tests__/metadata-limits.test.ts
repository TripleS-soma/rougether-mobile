/**
 * @jest-environment node
 *
 * 스토어 메타데이터 가드 (#818).
 *
 * `store/`가 스토어 문구의 단일 출처인데, 반영은 사람이 콘솔에 붙여넣는
 * 수동 경로다. 그래서 이 테스트가 두 가지를 대신 지킨다:
 *   1. 글자 수 상한 — 넘치면 콘솔이 저장 단계에서 거부해 왕복이 생긴다
 *   2. 앱에 없는 기능을 홍보하지 않기 — 실제로 한 번 뚫린 구멍이다
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..');

/**
 * 각 필드의 글자 수 상한. App Store Connect / Play Console이 강제하는 값이며,
 * 두 콘솔 모두 바이트가 아니라 **문자** 단위로 센다(한글 1자 = 1자).
 */
const LIMITS: Record<string, number> = {
  'ko-KR/app-store/name.txt': 30,
  'ko-KR/app-store/subtitle.txt': 30,
  'ko-KR/app-store/promotional-text.txt': 170,
  'ko-KR/app-store/keywords.txt': 100,
  'ko-KR/app-store/description.txt': 4000,
  'ko-KR/app-store/release-notes.txt': 4000,
  'ko-KR/play/title.txt': 30,
  'ko-KR/play/short-description.txt': 80,
  'ko-KR/play/full-description.txt': 4000,
};

/** 파일 내용 = 콘솔에 붙여넣을 값. 끝 개행은 우리 편의라 세지 않는다. */
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8').replace(/\n+$/, '');

/** 서로게이트 페어를 1자로 세려면 코드 포인트 단위여야 한다(이모지 대비). */
const count = (text: string) => [...text].length;

describe('스토어 메타데이터 (#818)', () => {
  it.each(Object.entries(LIMITS))('%s — 상한 %i자를 넘지 않는다', (rel, limit) => {
    expect(count(read(rel))).toBeLessThanOrEqual(limit);
  });

  /**
   * 앱에서 제거한 기능이 스토어 문구에 남아 있으면 App Store 심사
   * 가이드 2.3(정확한 메타데이터) 위반이다. 실제로 사진 인증(#695에서 UI
   * 제거, #797에서 인앱 도움말 제거)이 스토어 설명에만 남아 있었다.
   *
   * 기능을 되살리면(사진 인증은 #158) 여기서 해당 항목을 빼면 된다.
   */
  const REMOVED_FEATURES = ['사진 인증', '사진인증', '인증 사진', '인증샷'];

  const COPY_FILES = [
    'ko-KR/app-store/description.txt',
    'ko-KR/app-store/promotional-text.txt',
    'ko-KR/app-store/release-notes.txt',
    'ko-KR/app-store/keywords.txt',
    'ko-KR/play/short-description.txt',
    'ko-KR/play/full-description.txt',
  ];

  it.each(COPY_FILES)('%s — 앱에 없는 기능을 홍보하지 않는다', (rel) => {
    const text = read(rel);
    const mentioned = REMOVED_FEATURES.filter((term) => text.includes(term));
    expect(mentioned).toEqual([]);
  });

  /**
   * 애플 키워드 필드는 쉼표까지 100자에 포함한다. 쉼표 뒤 공백은 순수
   * 낭비라 콘솔에서도 넣지 않는 게 정석이다.
   */
  it('키워드는 쉼표 뒤에 공백을 두지 않는다 — 100자가 그만큼 줄어든다', () => {
    expect(read('ko-KR/app-store/keywords.txt')).not.toMatch(/,\s/);
  });

  /** 이름·부제는 검색 순위 가중치가 가장 큰 칸이라 비워두면 안 된다. */
  it.each(['ko-KR/app-store/name.txt', 'ko-KR/app-store/subtitle.txt'])(
    '%s — 비어 있지 않다',
    (rel) => {
      expect(read(rel).trim().length).toBeGreaterThan(0);
    },
  );
});

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SOURCE = readFileSync(join(__dirname, '..', 'registry.tsx'), 'utf8');

/**
 * dev 갤러리 위생 (#854).
 *
 * 갤러리는 한 페이지에 모든 항목을 세로로 쌓는다. 시트·다이얼로그는 화면을
 * 덮는 오버레이라, 열린 채로 렌더하면 **그 아래 등록된 항목이 전부 가려진다.**
 * 새 컴포넌트는 목록 뒤쪽에 추가되므로 새로 만든 것일수록 가려진다 — 실제로
 * #852·#855 작업 중 두 번 막혔다.
 *
 * 그래서 시트류는 `visible={open}`처럼 상태에 묶고 "열기" 버튼 뒤에 둔다.
 */
describe('dev registry 위생', () => {
  it('시트를 열린 채로 렌더하지 않는다 — visible은 상태에 묶는다', () => {
    // `visible` 뒤에 `=` 가 오지 않으면 하드코딩(암묵적 true)이다.
    const offenders = SOURCE.split('\n')
      .map((line, i) => ({ line: line.trim(), no: i + 1 }))
      .filter(({ line }) => /^visible\s*$/.test(line) || /\bvisible={true}/.test(line));

    expect(
      offenders.map(({ line, no }) => `registry.tsx:${no}  ${line}`),
      // 실패 시 어느 줄인지 바로 보이게 목록을 단언 대상에 담는다.
    ).toEqual([]);
  });
});

import { recommendStarterRoutines } from '@/constants/starter-routines';

describe('관심사별 첫 루틴', () => {
  it('서버의 숫자 id와 이름이 바뀌어도 code로 서로 다른 관심사를 반영한다', () => {
    expect(
      recommendStarterRoutines([
        { id: '812', code: 'EXERCISE', label: '몸을 움직여요' },
        { id: '3', code: 'reading', label: '책' },
        { id: '44', code: 'organizing', label: '정돈' },
      ]).map((r) => r.title),
    ).toEqual(['스트레칭 3분', '책 2쪽 읽기', '책상 위 물건 3개 정리하기']);
  });

  it('관심사가 하나면 그 관심사의 루틴 세 개를 추천하고 중복 관심사를 합친다', () => {
    const items = recommendStarterRoutines([
      { id: 'reading', label: '독서' },
      { id: 'reading', label: '독서' },
    ]);
    expect(items).toHaveLength(3);
    expect(items.every((r) => r.goalLabel === '독서')).toBe(true);
    expect(new Set(items.map((r) => r.id)).size).toBe(3);
  });

  it('두 관심사를 번갈아 배치하고 오래된 이름 기반 선택도 지원한다', () => {
    expect(
      recommendStarterRoutines([
        { id: '8', label: '독서' },
        { id: '2', label: '운동' },
      ]).map((r) => r.goalLabel),
    ).toEqual(['독서', '운동', '독서']);
  });

  it('미지원 관심사나 빈 목록은 맞춤이라고 주장하지 않고 기본 세 개를 추천한다', () => {
    const items = recommendStarterRoutines([{ id: 'future', label: '새 관심사' }]);
    expect(items).toEqual(recommendStarterRoutines([]));
    expect(items).toHaveLength(3);
    expect(items.every((r) => r.goalLabel === '가볍게 시작하기')).toBe(true);
  });
});

import { getCurrencyGuides } from '@/constants/currency';
import { i18n } from '@/i18n';

/** 재화 안내는 호출 시점 언어로 (#1369) — 모듈 로드 때 고정되면 언어 전환이 안 따라온다. */
describe('getCurrencyGuides (#1369)', () => {
  afterEach(async () => {
    await i18n.changeLanguage('ko');
  });

  it('기본 완료 보상과 일일 한도를 이벤트 추가 보상과 구분한다', () => {
    const [coin, diamond] = getCurrencyGuides();
    expect(coin.name).toBe('코인');
    expect(coin.earn[0]).toEqual({ label: '루틴 완료', detail: '기본 +10' });
    expect(coin.earn[1]).toEqual({ label: '할 일 완료', detail: '기본 +10' });
    expect(coin.earn[2].label).toBe('오늘 완료한 루틴과 할 일의 기본 보상은 합쳐 하루 100코인까지');
    expect(coin.earn[3].label).toBe('이벤트 추가 보상은 기본 한도와 별도로 지급');
    expect(diamond.name).toBe('다이아');
    expect(diamond.spend[0].label).toBe('꾸미기에서 가구 구매');
  });

  it('영어로 바꾸면 다음 호출부터 영어', async () => {
    await i18n.changeLanguage('en');
    const [coin] = getCurrencyGuides();
    expect(coin.name).toBe('Coins');
    expect(coin.earn[0]).toEqual({ label: 'Routine completed', detail: 'Base +10' });
    expect(coin.earn[1]).toEqual({ label: 'To-do completed', detail: 'Base +10' });
    expect(coin.earn[2].label).toBe(
      "Base rewards for today's routine and to-do completions: up to 100 coins combined per day",
    );
    expect(coin.earn[3].label).toBe(
      'Event bonuses are paid separately from the daily base reward limit',
    );
  });
});

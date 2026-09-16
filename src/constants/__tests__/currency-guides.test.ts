import { getCurrencyGuides } from '@/constants/currency';
import { i18n } from '@/i18n';

/** 재화 안내는 호출 시점 언어로 (#1369) — 모듈 로드 때 고정되면 언어 전환이 안 따라온다. */
describe('getCurrencyGuides (#1369)', () => {
  afterEach(async () => {
    await i18n.changeLanguage('ko');
  });

  it('한국어 문구·수치가 종전과 같다', () => {
    const [coin, diamond] = getCurrencyGuides();
    expect(coin.name).toBe('코인');
    expect(coin.earn[0]).toEqual({ label: '루틴 완료', detail: '+10' });
    expect(coin.earn[1]).toEqual({ label: '할 일 완료', detail: '+5' });
    expect(diamond.name).toBe('다이아');
    expect(diamond.spend[0].label).toBe('꾸미기에서 가구 구매');
  });

  it('영어로 바꾸면 다음 호출부터 영어', async () => {
    await i18n.changeLanguage('en');
    const [coin] = getCurrencyGuides();
    expect(coin.name).toBe('Coins');
    expect(coin.earn[0].label).toBe('Routine completed');
  });
});

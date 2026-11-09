import { i18n } from '@/i18n';

/**
 * In-app currency, per spec (`user_wallets.currency_type`): two currencies.
 * - 코인(coin): earned by completing routines/todos; spent on gacha pulls.
 * - 다이아(diamond): from gacha duplicate conversion; spent on shop items.
 * Balances and reward/duplicate amounts come from the API (`/me/wallets`,
 * completion/draw responses) — the server is the source of truth.
 */
export type Wallet = { coin: number; diamond: number };

/** Placeholder shown until `/me/wallets` loads. */
export const DEFAULT_WALLET: Wallet = { coin: 0, diamond: 0 };

/** 재화 안내 한 줄 (#789) — 모으는 곳 / 쓰는 곳. */
export type CurrencyGuideItem = { label: string; detail?: string };

export type CurrencyGuide = {
  currency: keyof Wallet;
  name: string;
  earn: CurrencyGuideItem[];
  spend: CurrencyGuideItem[];
};

/**
 * 재화 안내 문구 (#789) — 재화 내역 시트 상단의 접이식 안내가 이걸 그린다.
 * 기본 완료 보상과 기본 일일 한도를 안내한다. 이벤트 추가 보상은 별도이며,
 * 실제 지급액·지갑 반영·완료 연출은 서버의 rewardAmount를 사용한다.
 * 뽑기 비용·중복 전환·캐릭터 환급 금액은 서버 데이터이므로 고정하지 않는다.
 */
export function getCurrencyGuides(): CurrencyGuide[] {
  // 호출 시점에 번역 (#893·#1369) — 모듈 로드 때 고정하면 언어를 바꿔도 안 따라온다.
  const t = (key: string) => i18n.t(`app.currency.${key}`);
  return [
    {
      currency: 'coin',
      name: t('coin'),
      earn: [
        { label: t('earnRoutine'), detail: t('earnBaseReward') },
        { label: t('earnTodo'), detail: t('earnBaseReward') },
        // 상한은 "왜 코인이 안 들어오지?"의 유일한 답 — 완료 토스트(#444)에만
        // 있던 정보라 여기 적는다.
        { label: t('earnDailyCap') },
        { label: t('earnEventBonus') },
        { label: t('earnBonus') },
        { label: t('earnDupCharacter') },
      ],
      spend: [{ label: t('spendGacha'), detail: t('spendGachaDetail') }],
    },
    {
      currency: 'diamond',
      name: t('diamond'),
      earn: [{ label: t('earnDupItem') }],
      spend: [{ label: t('spendFurniture'), detail: t('spendFurnitureDetail') }],
    },
  ];
}

/**
 * 재화 표시 — 천 단위 구분(기기 로캘). JS의 -0(#714: `Math.round(-0.2)`, JSON "-0")은
 * `toLocaleString()`이 "-0"으로 찍으므로 여기서 0으로 눌러 편다.
 */
export function formatAmount(n: number): string {
  return (n === 0 ? 0 : n).toLocaleString();
}

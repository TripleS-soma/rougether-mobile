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
 * 정책이 바뀌면 **이 파일만** 고치면 되도록 문구를 한곳에 모았다.
 *
 * 수치 원칙: **루틴·할 일 완료 보상만** 숫자를 적는다(스펙 고정 정책,
 * routine-todo/features.md — 실서버 이력에서 ROUTINE_COMPLETE=+10 확인). 뽑기
 * 계열(비용·중복 전환·캐릭터 환급)은 **서버 데이터**라 숫자를 쓰지 않는다 —
 * 실서버는 뽑기 −25 / 중복 전환 +3으로, 스펙 문서의 250·30과 다르다. 여기 값을
 * 박아 두면 운영이 가격을 바꾼 순간 안내가 거짓말이 된다.
 */
export const CURRENCY_GUIDES: CurrencyGuide[] = [
  {
    currency: 'coin',
    name: '코인',
    earn: [
      { label: '루틴 완료', detail: '+10' },
      { label: '할 일 완료', detail: '+5' },
      // 상한은 "왜 코인이 안 들어오지?"의 유일한 답 — 완료 토스트(#444)에만
      // 있던 정보라 여기 적는다.
      { label: '오늘 완료만, 루틴·할 일 합쳐 하루 4건까지' },
      { label: '가입 보너스 · 친구 초대 보상' },
      { label: '캐릭터 뽑기에서 이미 가진 캐릭터가 나오면 환급' },
    ],
    spend: [{ label: '뽑기', detail: '머신마다 다름' }],
  },
  {
    currency: 'diamond',
    name: '다이아',
    earn: [{ label: '뽑기에서 이미 가진 아이템이 나오면 전환' }],
    spend: [{ label: '꾸미기에서 가구 구매', detail: '아이템마다 다름' }],
  },
];

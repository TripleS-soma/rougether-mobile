/**
 * In-app currency, per spec (`user_wallets.currency_type`): two currencies.
 * - 코인(coin): earned by completing routines/todos; spent on gacha pulls.
 * - 다이아(dia): from gacha duplicate conversion; spent on shop items.
 * Local state for now (no wallet backend yet).
 */
export type CurrencyType = 'coin' | 'dia';

export type Wallet = { coin: number; dia: number };

export const DEFAULT_WALLET: Wallet = { coin: 5600, dia: 20 };

/** Coin granted per routine/todo completion (flat for now; server rule TBD). */
export const ROUTINE_REWARD_COIN = 20;

/** Dia granted when a gacha pull yields an already-owned item (duplicate). */
export const DUPLICATE_DIA = 30;

export const CURRENCY_LABEL: Record<CurrencyType, string> = {
  coin: '코인',
  dia: '다이아',
};

/**
 * In-app currency, per spec (`user_wallets.currency_type`): two currencies.
 * - 코인(coin): earned by completing routines/todos; spent on gacha pulls.
 * - 다이아(diamond): from gacha duplicate conversion; spent on shop items.
 * Balances and reward/duplicate amounts come from the API (`/me/wallets`,
 * completion/draw responses) — the server is the source of truth.
 */
export type CurrencyType = 'coin' | 'diamond';

export type Wallet = { coin: number; diamond: number };

/** Placeholder shown until `/me/wallets` loads. */
export const DEFAULT_WALLET: Wallet = { coin: 0, diamond: 0 };

/** 0~1로 자른다 — 타임라인 진행도·보간 입력용. */
export const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** 선형 보간. amount 0이면 from, 1이면 to. */
export const lerp = (from: number, to: number, amount: number) => from + (to - from) * amount;

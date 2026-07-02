/**
 * Character accessory catalog. Per spec, character items are **gacha-only** —
 * the shop displays them (owned / locked) but they can't be bought with dia.
 * Placeholder data until the real item/gacha catalog + art exist.
 */
export type Accessory = {
  id: string;
  name: string;
  /** Character slot the accessory occupies (spec: `character_slot_type`). */
  slot: '머리' | '얼굴' | '목' | '손';
  emoji: string;
};

export const ACCESSORY_ITEMS: Accessory[] = [
  { id: 'acc-ribbon', name: '리본 머리띠', slot: '머리', emoji: '🎀' },
  { id: 'acc-glasses', name: '동그란 안경', slot: '얼굴', emoji: '👓' },
  { id: 'acc-scarf', name: '포근한 목도리', slot: '목', emoji: '🧣' },
  { id: 'acc-hat', name: '털모자', slot: '머리', emoji: '🧢' },
  { id: 'acc-bag', name: '작은 가방', slot: '손', emoji: '👜' },
  { id: 'acc-flower', name: '꽃 장식', slot: '머리', emoji: '🌸' },
];

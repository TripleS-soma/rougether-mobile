import type { ChatReaction, ChatReactionType } from '@/api/chat-types';

/**
 * 공감 종류 — 서버 `ChatReactionType` 순서 그대로. 글리프는 아이콘이 아니라 **메시지에 붙는
 * 내용**이라 이모지를 쓴다(누가 어떤 감정을 남겼는지가 곧 내용이다).
 */
export const CHAT_REACTIONS: { type: ChatReactionType; glyph: string; labelKey: string }[] = [
  { type: 'HEART', glyph: '❤️', labelKey: 'house.chat.reaction.HEART' },
  { type: 'LIKE', glyph: '👍', labelKey: 'house.chat.reaction.LIKE' },
  { type: 'CHECK', glyph: '✅', labelKey: 'house.chat.reaction.CHECK' },
  { type: 'LAUGH', glyph: '😄', labelKey: 'house.chat.reaction.LAUGH' },
  { type: 'SURPRISE', glyph: '😮', labelKey: 'house.chat.reaction.SURPRISE' },
  { type: 'SAD', glyph: '😢', labelKey: 'house.chat.reaction.SAD' },
];

const BY_TYPE = new Map(CHAT_REACTIONS.map((reaction) => [reaction.type, reaction]));

export function chatReactionMeta(type: ChatReactionType) {
  return BY_TYPE.get(type);
}

/** 내가 남긴 공감 유형 — 메시지당 하나뿐이다. */
export function myReactionOf(
  reactions: ChatReaction[] | null | undefined,
  myUserId: number | undefined,
): ChatReactionType | undefined {
  if (myUserId == null) return undefined;
  return reactions?.find((reaction) => reaction.userIds.includes(myUserId))?.type;
}

/**
 * 내 공감을 `next`로 바꾼(없애려면 null) 결과 — 서버 응답을 기다리지 않고 먼저 그릴 때 쓴다.
 * 서버와 같은 규칙: 한 사람이 메시지당 하나, 유형 순서는 선언 순서, 빈 유형은 뺀다.
 */
export function withMyReaction(
  reactions: ChatReaction[] | null | undefined,
  myUserId: number,
  next: ChatReactionType | null,
): ChatReaction[] {
  const byType = new Map<ChatReactionType, number[]>();
  for (const reaction of reactions ?? []) {
    const others = reaction.userIds.filter((id) => id !== myUserId);
    if (others.length) byType.set(reaction.type, others);
  }
  if (next) byType.set(next, [...(byType.get(next) ?? []), myUserId]);
  return CHAT_REACTIONS.filter(({ type }) => byType.has(type)).map(({ type }) => ({
    type,
    userIds: byType.get(type) ?? [],
  }));
}

import type { ChatMessageResponse as BaseMessage, ChatMessagePage as BasePage } from '@/api/types';

/** 사진 채팅 계약. 운영 OpenAPI 타입 재생성 전의 추가 필드. */
export type ChatImageResponse = {
  imageId: number;
  width: number;
  height: number;
  contentType?: string;
  /** Sent photos expire 30 days after the message was sent. */
  expiresAt?: string;
};

/** 메시지 공감 유형 — 서버 `ChatReactionType`과 같은 순서. */
export type ChatReactionType = 'HEART' | 'LIKE' | 'CHECK' | 'LAUGH' | 'SURPRISE' | 'SAD';

/** 유형별 공감 — `userIds`는 누른 순서. 반응이 있는 유형만 온다. */
export type ChatReaction = { type: ChatReactionType; userIds: number[] };

/** 공감 설정·취소 응답과 소켓 `MESSAGE_REACTIONS`의 공통 모양. */
export type ChatReactionUpdate = {
  messageId: number;
  sequence?: number;
  reactions: ChatReaction[];
};

export type ChatMessageType = 'TEXT' | 'IMAGE' | 'EMOTICON';

export type ChatMessageResponse = BaseMessage & {
  messageType?: ChatMessageType;
  /** 첫 번째 사진 — 여러 장을 모르는 옛 앱용. 새 화면은 `images`를 쓴다. */
  image?: ChatImageResponse | null;
  /** 보낸 순서대로의 사진 전부. 옛 서버는 보내지 않는다. */
  images?: ChatImageResponse[] | null;
  /** 사진이나 이모티콘과 함께 보낸 글. 첨부만 보냈으면 null. */
  caption?: string | null;
  /** Bundled emoticon key; unknown keys retain the server's fallback text. */
  emoticonKey?: string | null;
  reactions?: ChatReaction[] | null;
};
export type ChatMessagePage = Omit<BasePage, 'items'> & { items?: ChatMessageResponse[] };

/** 글, 사진과 설명 글, 이모티콘과 글 중 하나. 사진과 이모티콘은 함께 보내지 않음. */
export type ChatSendRequest = { clientMessageId: string } & (
  | { content: string; imageIds?: never; emoticonKey?: never }
  | { imageIds: number[]; content?: string; emoticonKey?: never }
  | { emoticonKey: string; content?: string; imageIds?: never }
);

/** 사진 자르기 영역 — 회전 보정 후 사진 기준 0~1 비율. 서버가 이 영역만 남긴다. */
export type ChatCrop = { x: number; y: number; width: number; height: number };

/** 서버가 준 사진 목록 — `images`가 없는 옛 서버 응답은 `image` 한 장으로 본다. */
export function chatImagesOf(message: {
  image?: ChatImageResponse | null;
  images?: ChatImageResponse[] | null;
}): ChatImageResponse[] {
  if (message.images?.length) return message.images;
  return message.image ? [message.image] : [];
}

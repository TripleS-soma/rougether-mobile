import type { ChatMessageResponse as BaseMessage, ChatMessagePage as BasePage } from '@/api/types';

/** 사진 채팅 계약. 운영 OpenAPI 타입 재생성 전의 추가 필드. */
export type ChatImageResponse = {
  imageId: number;
  width: number;
  height: number;
  contentType?: string;
};
export type ChatMessageResponse = BaseMessage & {
  messageType?: 'TEXT' | 'IMAGE';
  image?: ChatImageResponse | null;
};
export type ChatMessagePage = Omit<BasePage, 'items'> & { items?: ChatMessageResponse[] };
export type ChatSendRequest = { clientMessageId: string } & (
  { content: string; imageId?: never } | { imageId: number; content?: never }
);

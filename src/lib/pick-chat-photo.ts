import type { ChatCrop } from '@/api/chat-types';
import type { PickedLibraryImageWithSize } from '@/lib/pick-image';

/** 메시지 하나에 묶어 보낼 수 있는 사진 장수 (서버 계약). */
export const CHAT_PHOTO_MAX = 10;
/** 서버가 받는 사진 한 장의 최대 크기. */
export const CHAT_PHOTO_MAX_BYTES = 10 * 1024 * 1024;

/**
 * 보내기 전 사진 한 장. `width`·`height`는 화면에 보이는 방향 기준 원본 크기이고, `crop`은
 * 자르기 화면에서 정한 영역이다 — 파일은 그대로 두고 서버가 올릴 때 그 영역만 남긴다.
 */
export type ChatPhotoDraft = PickedLibraryImageWithSize & {
  width?: number;
  height?: number;
  crop?: ChatCrop;
};

/** 서버가 받는 형식·크기인지 — 아니면 고르는 자리에서 걸러 안내한다. */
export function isSendableChatPhoto(file: PickedLibraryImageWithSize): boolean {
  return (
    ['image/jpeg', 'image/png'].includes(file.type.toLowerCase()) &&
    (file.fileSize ?? 0) <= CHAT_PHOTO_MAX_BYTES
  );
}

/**
 * 채팅에 보낼 사진 고르기 — SDK 55 시스템 사진 선택기라 앨범 전체 접근 권한 없이 고른 사진만
 * 돌려준다. `limit`장까지 고른 순서대로. 취소하면 빈 배열.
 */
export async function pickChatPhotos(limit: number = CHAT_PHOTO_MAX): Promise<ChatPhotoDraft[]> {
  if (limit <= 0) return [];
  const picker = await import('expo-image-picker');
  const result = await picker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.8,
    allowsMultipleSelection: limit > 1,
    selectionLimit: limit,
    orderedSelection: true,
  });
  if (result.canceled || !result.assets?.length) return [];
  return result.assets.slice(0, limit).map((asset, i) => ({
    uri: asset.uri,
    name: asset.fileName ?? `chat-photo-${i + 1}.jpg`,
    type: asset.mimeType ?? 'image/jpeg',
    fileSize: asset.fileSize,
    width: asset.width || undefined,
    height: asset.height || undefined,
  }));
}

import { Platform } from 'react-native';

import { getAccessToken, getSessionUserId, refreshSession } from '@/api/auth';
import { apiDelete, apiUpload } from '@/api/client';
import { inChatSession } from '@/api/chat-session';
import { API_BASE } from '@/api/config';
import type { ChatCrop, ChatImageResponse } from '@/api/chat-types';
import type { PickedLibraryImageWithSize } from '@/lib/pick-image';

/**
 * 업로드 응답을 잃은 객체는 서버의 만료 정리가 처리한다. 메시지 재시도는 받은 ID를 재사용한다.
 * `crop`을 주면 서버가 그 영역만 남겨 저장한다(네 값을 함께 보내야 한다).
 */
export async function uploadChatImage(
  roomId: number,
  file: PickedLibraryImageWithSize,
  crop?: ChatCrop,
) {
  return inChatSession(async (assertCurrent) => {
    const form = new FormData();
    if (Platform.OS === 'web') {
      const blob = await (await fetch(file.uri)).blob();
      form.append('file', blob, file.name);
    } else {
      form.append('file', { uri: file.uri, name: file.name, type: file.type } as unknown as Blob);
    }
    if (crop) {
      form.append('cropX', String(crop.x));
      form.append('cropY', String(crop.y));
      form.append('cropWidth', String(crop.width));
      form.append('cropHeight', String(crop.height));
    }
    assertCurrent();
    return apiUpload<ChatImageResponse>(`/chat/rooms/${roomId}/images`, form, {
      expectedStatuses: [400, 401, 403, 409, 413, 429, 503],
      refreshOnUnauthorized: false,
    });
  });
}

export function cancelChatImage(imageId: number) {
  return inChatSession(() =>
    apiDelete<void>(`/chat/images/${imageId}`, undefined, {
      expectedStatuses: [404, 409],
      refreshOnUnauthorized: false,
    }),
  );
}

/** 비공개 사진은 매 열람 시 권한을 확인한다. URL에 토큰을 넣거나 디스크/전역 캐시에 저장하지 않는다. */
export async function fetchChatImage(imageId: number): Promise<string | null> {
  const userId = getSessionUserId();
  const token = getAccessToken();
  if (!token || userId == null) return null;
  const get = (accessToken: string) =>
    fetch(`${API_BASE}/chat/images/${imageId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    });
  let response = await get(token);
  if (response.status === 401 && getSessionUserId() === userId && (await refreshSession())) {
    const next = getAccessToken();
    if (!next || getSessionUserId() !== userId) return null;
    response = await get(next);
  }
  if (!response.ok || getSessionUserId() !== userId) return null;
  const blob = await response.blob();
  const uri = await new Promise<string | null>((resolve) => {
    const reader = new FileReader();
    reader.onerror = () => resolve(null);
    reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : null);
    reader.readAsDataURL(blob);
  });
  return getSessionUserId() === userId ? uri : null;
}

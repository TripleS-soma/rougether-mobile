import { AppState, Platform } from 'react-native';

import { getAccessToken, getSessionUserId, onSessionCleared, refreshSession } from '@/api/auth';
import { apiDelete, apiUpload } from '@/api/client';
import { inChatSession } from '@/api/chat-session';
import { API_BASE } from '@/api/config';
import type { ChatCrop, ChatImageResponse } from '@/api/chat-types';
import {
  clearChatImageFiles,
  loadChatImageFile,
  removeChatImageFile,
  sweepChatImageFiles,
} from '@/lib/chat-image-files';
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

// Logout invalidates in-flight reads even if the next login is the same account.
let cacheSession = 0;
onSessionCleared(() => {
  cacheSession += 1;
  void clearChatImageFiles().catch(() => {});
});
AppState.addEventListener('change', (state) => {
  const userId = getSessionUserId();
  if (state === 'active' && userId != null) void sweepChatImageFiles(userId).catch(() => {});
});
const pending = new Map<string, Promise<string | null>>();

/** Reauthorize cached photos without transferring their bytes again. */
export function fetchChatImage(imageId: number): Promise<string | null> {
  const userId = getSessionUserId();
  if (!getAccessToken() || userId == null) return Promise.resolve(null);
  const epoch = cacheSession;
  const key = `${userId}:${epoch}:${imageId}`;
  const existing = pending.get(key);
  if (existing) return existing;
  const request = readChatImage(userId, imageId, epoch).finally(() => pending.delete(key));
  pending.set(key, request);
  return request;
}

async function readChatImage(
  userId: number,
  imageId: number,
  epoch: number,
): Promise<string | null> {
  const assertCurrent = () => {
    if (cacheSession !== epoch || getSessionUserId() !== userId || !getAccessToken())
      throw new Error('Chat session changed');
  };
  const get = (accessToken: string, metadata: boolean) =>
    fetch(`${API_BASE}/chat/images/${imageId}${metadata ? '/metadata' : ''}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    });
  let token = getAccessToken();
  if (!token) return null;
  let response = await get(token, true);
  assertCurrent();
  if (response.status === 401 && (await refreshSession())) {
    assertCurrent();
    token = getAccessToken();
    if (!token) return null;
    response = await get(token, true);
  }
  assertCurrent();
  if (!response.ok) {
    if ([401, 403, 404].includes(response.status)) await removeChatImageFile(userId, imageId);
    return null;
  }
  const metadata = (await response.json()) as ChatImageResponse;
  assertCurrent();
  if (
    !metadata.expiresAt ||
    !Number.isFinite(Date.parse(metadata.expiresAt)) ||
    Date.parse(metadata.expiresAt) <= Date.now()
  ) {
    await removeChatImageFile(userId, imageId);
    return null;
  }
  const url = `${API_BASE}/chat/images/${imageId}`;
  token = getAccessToken();
  if (!token) return null;
  if (Platform.OS !== 'web') {
    const file = await loadChatImageFile(
      userId,
      imageId,
      metadata.expiresAt,
      url,
      token,
      assertCurrent,
    );
    assertCurrent();
    return file;
  }
  // Browsers keep private bytes in memory only; native uses a file URI without base64 conversion.
  response = await get(token, false);
  assertCurrent();
  if (!response.ok) return null;
  const blob = await response.blob();
  const uri = await new Promise<string | null>((resolve) => {
    const reader = new FileReader();
    reader.onerror = () => resolve(null);
    reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : null);
    reader.readAsDataURL(blob);
  });
  assertCurrent();
  return Date.now() < Date.parse(metadata.expiresAt) ? uri : null;
}

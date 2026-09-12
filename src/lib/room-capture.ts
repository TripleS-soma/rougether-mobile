/**
 * Capture the room view and save it to the device gallery (#245). Native-only
 * (view-shot + media-library are native modules); web reports unsupported.
 */
import type { RefObject } from 'react';
import * as MediaLibrary from 'expo-media-library';
import { Platform, type View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

export type SaveRoomResult = 'saved' | 'denied' | 'unsupported' | 'failed';

export async function saveRoomImage(ref: RefObject<View | null>): Promise<SaveRoomResult> {
  if (Platform.OS === 'web') return 'unsupported';
  try {
    // 쓰기 전용(writeOnly)으로 묻는다 — Play 사진/동영상 권한 정책(2026-09-12 거절)으로
    // READ_MEDIA_IMAGES/VIDEO를 매니페스트에서 뗐다. 저장만 하므로 Android 13+는 권한
    // 없이(빈 요청 = 허용), 12 이하는 WRITE_EXTERNAL_STORAGE만, iOS는 '추가만' 권한을 쓴다.
    // 인자 없이 부르면 뗀 읽기 권한까지 요구해 13+에서 늘 거부된다.
    const { granted } = await MediaLibrary.requestPermissionsAsync(true);
    if (!granted) return 'denied';
    const uri = await captureRef(ref, { format: 'png', quality: 1 });
    await MediaLibrary.saveToLibraryAsync(uri);
    return 'saved';
  } catch {
    return 'failed';
  }
}

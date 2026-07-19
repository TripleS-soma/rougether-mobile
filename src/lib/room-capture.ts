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
    const { granted } = await MediaLibrary.requestPermissionsAsync();
    if (!granted) return 'denied';
    const uri = await captureRef(ref, { format: 'png', quality: 1 });
    await MediaLibrary.saveToLibraryAsync(uri);
    return 'saved';
  } catch {
    return 'failed';
  }
}

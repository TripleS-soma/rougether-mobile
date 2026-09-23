/**
 * Opens the photo library so the user can attach a screenshot (버그 제보,
 * #496). Returns the picked image (upload-ready fields), or null when the
 * permission was denied or the user cancelled.
 *
 * `expo-image-picker` is a native module, so it's imported lazily.
 */
export type PickedImage = { uri: string; name: string; type: string };

export async function pickLibraryImage(): Promise<PickedImage | null> {
  const ImagePicker = await import('expo-image-picker');
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.8,
  });
  if (result.canceled || !result.assets?.length) return null;
  const asset = result.assets[0];
  return {
    uri: asset.uri,
    name: asset.fileName ?? 'screenshot.jpg',
    type: asset.mimeType ?? 'image/jpeg',
  };
}

/** 여러 장 고르기의 결과 한 장 — 올리기 전 크기 검사를 위해 바이트 수를 함께 싣는다. */
export type PickedLibraryImageWithSize = PickedImage & { fileSize?: number };

/**
 * 사진 여러 장 고르기 (피드 작성 #1409). 권한 거부·취소면 빈 배열. `limit`은 이번에 더
 * 고를 수 있는 장수 — 플랫폼이 한도를 지키지 않아도 앞에서 자른다. quality를 주면 iOS가
 * HEIC를 JPEG로 내보내 서버가 받는 형식(JPEG/PNG)에 맞는다.
 */
export async function pickLibraryImages(limit: number): Promise<PickedLibraryImageWithSize[]> {
  if (limit <= 0) return [];
  const ImagePicker = await import('expo-image-picker');
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return [];

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.8,
    allowsMultipleSelection: limit > 1,
    selectionLimit: limit,
  });
  if (result.canceled || !result.assets?.length) return [];
  return result.assets.slice(0, limit).map((asset, i) => ({
    uri: asset.uri,
    name: asset.fileName ?? `photo-${i + 1}.jpg`,
    type: asset.mimeType ?? 'image/jpeg',
    fileSize: asset.fileSize,
  }));
}

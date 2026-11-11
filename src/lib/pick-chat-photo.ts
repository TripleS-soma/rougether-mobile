import type { PickedLibraryImageWithSize } from '@/lib/pick-image';

/** SDK 55 시스템 사진 선택기는 앨범 전체 접근 권한 없이 선택한 한 장만 반환한다. */
export async function pickChatPhoto(): Promise<PickedLibraryImageWithSize | null> {
  const picker = await import('expo-image-picker');
  const result = await picker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
  const asset = result.canceled ? undefined : result.assets?.[0];
  return asset
    ? {
        uri: asset.uri,
        name: asset.fileName ?? 'chat-photo.jpg',
        type: asset.mimeType ?? 'image/jpeg',
        fileSize: asset.fileSize,
      }
    : null;
}

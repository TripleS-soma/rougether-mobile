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

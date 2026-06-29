/**
 * Launches the device camera so the user can take a verification photo when
 * completing a 인증사진형(photo-verify) routine. Returns the captured photo URI,
 * or null if the camera permission was denied or the user cancelled.
 *
 * `expo-image-picker` is a native module, so it's imported lazily: non-camera
 * code paths (and tests) never load it, and callers can inject a stub instead.
 */
export async function captureVerificationPhoto(): Promise<string | null> {
  const ImagePicker = await import('expo-image-picker');
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) return null;

  const result = await ImagePicker.launchCameraAsync({ quality: 0.6 });
  if (result.canceled || !result.assets?.length) return null;
  return result.assets[0].uri;
}

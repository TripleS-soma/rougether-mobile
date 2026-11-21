/** Web keeps private photos in memory only. Native resolves the .native adapter. */
export async function loadChatImageFile(
  _userId: number,
  _imageId: number,
  _expiresAt: string,
  _url: string,
  _token: string,
  _assertCurrent: () => void,
): Promise<string | null> {
  return null;
}

export async function removeChatImageFile(_userId: number, _imageId: number): Promise<void> {}
export async function clearChatImageFiles(): Promise<void> {}

export async function sweepChatImageFiles(_userId: number): Promise<void> {}

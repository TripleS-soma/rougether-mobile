import type { PickedLibraryImageWithSize } from '@/lib/pick-image';

/**
 * 채팅 사진의 주소를 피드 업로드가 받는 파일 꼴로 바꾼다 (2026-11-11 — 사진 크게 보기의
 * [피드에 올리기]). 채팅 사진은 인증 API로 받아 메모리의 data URI로만 들고 있는데, 업로드
 * (`uploadFeedImage`)는 네이티브·웹 모두 data URI를 그대로 읽는다 — 파일로 쓰지 않는다.
 * 방금 보낸 사진은 아직 고른 파일 경로(`localUri`)라 확장자로 형식을 가늠한다.
 */
export function chatPhotoUploadFile(uri: string): PickedLibraryImageWithSize {
  const comma = uri.startsWith('data:') ? uri.indexOf(',') : -1;
  // 헤더만 본다 — 본문(수 MB의 base64)을 정규식에 태우지 않는다.
  const header = comma > 0 ? uri.slice('data:'.length, comma) : null;
  const type = header
    ? header.split(';')[0].toLowerCase()
    : /\.png(?:$|[?#])/i.test(uri)
      ? 'image/png'
      : 'image/jpeg';
  return {
    uri,
    name: `chat-photo.${type === 'image/png' ? 'png' : 'jpg'}`,
    type,
    // base64 4글자 = 3바이트. 서버 한도(10MiB) 사전 안내용이라 패딩 오차는 무시한다.
    fileSize: header ? Math.floor(((uri.length - comma - 1) * 3) / 4) : undefined,
  };
}

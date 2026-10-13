import type { ReactNode } from 'react';

export type GoogleWebButtonProps = {
  /** 최근 로그인 배지 — 공식 버튼 위에 겹쳐 그린다. */
  recent: boolean;
  /** 공식 버튼으로 credential을 받았을 때 — 화면이 평소 구글 로그인 흐름을 시작한다. */
  onCredential: () => void;
  /** 공식 버튼을 그릴 수 없을 때(스크립트 차단 등) 대신 보일 우리 버튼. */
  fallback: ReactNode;
};

/**
 * 웹 전용 구글 공식 버튼 (#1532) — 네이티브는 SDK 시트를 쓰므로 이 파일은 그리지 않는다.
 * 실제 구현은 `google-web-button.web.tsx`.
 */
export function GoogleWebButton({ fallback }: GoogleWebButtonProps) {
  return <>{fallback}</>;
}

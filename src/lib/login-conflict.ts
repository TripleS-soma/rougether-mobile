/**
 * 같은 이메일 타 provider 계정 안내 (서버 409 AUTH_EMAIL_LINKED_TO_OTHER_PROVIDER).
 *
 * 재설치 뒤 "최근 로그인" 배지가 사라져 다른 provider 버튼을 누르면, 종전엔
 * 서버가 조용히 **빈 새 계정**을 만들었다(같은 이메일이라도 provider 별로
 * 별개 회원). 이제 서버는 최초 가입 직전에 같은 이메일의 활성 계정이 다른
 * provider 로 있으면 계정을 만들지 않고 409 + `details.providers` 로 알려주고,
 * 앱은 [OO로 로그인] / [새 계정으로 계속] 을 고르게 한다. "계속"은 같은
 * 자격증명으로 `allowNewAccount: true` 재요청이다.
 */
import { ApiError } from '@/api/http';
import { SOCIAL_PROVIDERS, type SocialProvider } from '@/lib/last-login';

export const LOGIN_CONFLICT_CODE = 'AUTH_EMAIL_LINKED_TO_OTHER_PROVIDER';

export type LoginConflict = {
  status: 'conflict';
  /** 같은 이메일로 이미 가입된 provider들 (서버 `details.providers` → 소문자). */
  providers: SocialProvider[];
  /** 서버 안내 문구 — "이 이메일은 애플 로그인으로 가입되어 있어요." */
  message: string;
  /** "새 계정으로 계속" — 같은 자격증명으로 allowNewAccount=true 재요청. */
  continueAsNew: () => Promise<'ok' | 'failed'>;
};

/**
 * 소셜 로그인 결과. 'ok' 성공 / 'cancelled' 사용자가 시트를 닫음(조용히 무시) /
 * 'failed' 실패 / `LoginConflict` 같은 이메일 타 provider 계정 안내(선택지 제공).
 */
export type SocialLoginResult = 'ok' | 'cancelled' | 'failed' | LoginConflict;

const PROVIDER_LABEL: Record<SocialProvider, string> = {
  kakao: '카카오',
  apple: '애플',
  google: '구글',
};

/** 사용자에게 보이는 provider 이름. */
export function providerLabel(provider: SocialProvider): string {
  return PROVIDER_LABEL[provider];
}

function toProvider(value: unknown): SocialProvider | null {
  const key = typeof value === 'string' ? value.toLowerCase() : '';
  return (SOCIAL_PROVIDERS as readonly string[]).includes(key) ? (key as SocialProvider) : null;
}

/** 서버 문구가 없을 때의 폴백 안내. */
export function conflictMessage(providers: SocialProvider[]): string {
  const labels = providers.length > 0 ? providers.map(providerLabel).join('·') : '다른 소셜';
  return `이 이메일은 ${labels} 로그인으로 가입되어 있어요.`;
}

/** 409 안내 응답이면 providers·message 를 뽑고, 그 밖의 에러면 null. */
export function parseLoginConflict(
  err: unknown,
): Pick<LoginConflict, 'providers' | 'message'> | null {
  if (!(err instanceof ApiError) || err.code !== LOGIN_CONFLICT_CODE) return null;
  const raw = err.details?.providers;
  const providers = Array.isArray(raw)
    ? raw.map(toProvider).filter((p): p is SocialProvider => p != null)
    : [];
  return { providers, message: err.serverMessage ?? conflictMessage(providers) };
}

export function isLoginConflict(result: SocialLoginResult): result is LoginConflict {
  return typeof result === 'object' && result !== null && result.status === 'conflict';
}

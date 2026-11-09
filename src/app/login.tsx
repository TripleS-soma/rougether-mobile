import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';

import { getLastLoginFailure, loginErrorMessage } from '@/lib/login-error';
import { LoginScreen } from '@/components/screens/login-screen';
import { useAuth } from '@/hooks/use-auth';
import { track } from '@/lib/analytics';
import { hasGoogleRedirect } from '@/lib/google-auth';
import { hasKakaoRedirect } from '@/lib/kakao-auth';
import { loadLastLoginProvider, type SocialProvider } from '@/lib/last-login';
import type { SocialLoginResult } from '@/lib/login-conflict';
import { i18n } from '@/i18n';

// 409 안내(LoginConflict)도 결과에 포함 — 계측은 취소만 보고 나머지는 그대로 화면에 넘긴다.
type SocialLogin = () => Promise<SocialLoginResult>;

/**
 * 버튼 탭과 취소를 남긴다 (#1282). 성공·실패는 use-auth가 이미 남기므로
 * (`login_success`·`login_failed`) 여기선 그 분모(탭)와 나머지(취소)만 채운다.
 */
function tracked(provider: SocialProvider, login: SocialLogin): SocialLogin {
  return async () => {
    track('login_tap', { provider });
    const result = await login();
    if (result === 'cancelled') track('login_cancel', { provider });
    return result;
  };
}

/**
 * 로그인 화면에 어떻게 왔나 — `login_view`의 via. 로그인 전 소개 슬라이드(#1282)는
 * 없앴다 — 앱을 열면 곧장 로그인 화면이고, 사용법은 로그인 뒤 튜토리얼 미션이 맡는다.
 */
type LoginVia = 'direct' | 'kakao_redirect' | 'google_redirect';

export default function Login() {
  const { login, loginWithGoogle, loginWithKakao, loginWithApple } = useAuth();
  // 최근 로그인 배지 (#489 후속) — 로딩 전에는 배지 없이 그린다(깜빡임 무해).
  const [lastProvider, setLastProvider] = useState<SocialProvider | null>(null);
  // hasKakaoRedirect는 window를 읽어 정적 export 렌더에서 부를 수 없으니 초기값이
  // 아니라 이펙트에서 판정한다 — 판정은 아래 복귀 이펙트 한 곳에서만 한다(교환이 복귀
  // 파라미터를 걷어내므로 다른 이펙트가 다시 물으면 false가 나온다).
  const via = useRef<LoginVia>('direct');
  // 웹 카카오·구글 로그인은 페이지 리다이렉트로 돌아온다(구글은 #1532부터) — 복귀
  // 진입이면 사용자가 다시 누르지 않아도 나머지 절반(카카오: 코드 교환, 구글: 프래그먼트의
  // id token → 서버)을 이어서 끝낸다. 네이티브는 has*Redirect가 항상 false라 아무 일도 안 한다.
  const [resumeError, setResumeError] = useState<string | null>(null);
  // 복귀 교환이 도는 동안 화면을 잠근다 — 화면의 submitting은 화면 안 탭만 알아서,
  // 이 값이 없으면 교환 중에 누른 소셜 버튼이 두 번째 시도를 시작한다.
  const [resuming, setResuming] = useState(false);
  useEffect(() => {
    const provider = hasKakaoRedirect() ? 'kakao' : hasGoogleRedirect() ? 'google' : null;
    if (!provider) return;
    // 이어가기 전에 기록한다: 토큰을 꺼내는 쪽이 URL·세션스토리지의 복귀 파라미터를 지운다.
    via.current = provider === 'kakao' ? 'kakao_redirect' : 'google_redirect';
    setResuming(true);
    const resume = provider === 'kakao' ? loginWithKakao : loginWithGoogle;
    void resume().then((result) => {
      setResuming(false);
      if (result === 'ok') router.replace('/');
      else if (result === 'cancelled') track('login_cancel', { provider });
      else {
        const base = i18n.t(
          provider === 'kakao' ? 'member.login.kakaoFailed' : 'member.login.googleFailed',
        );
        const f = getLastLoginFailure();
        setResumeError(f ? loginErrorMessage(base, f) : base);
      }
    });
  }, [loginWithKakao, loginWithGoogle]);
  useEffect(() => {
    let active = true;
    void loadLastLoginProvider().then((p) => {
      if (active) setLastProvider(p);
    });
    return () => {
      active = false;
    };
  }, []);

  // 로그인 화면 노출 — 마운트당 1회. 복귀 판정(위 이펙트)이 via를 먼저 정한 뒤에
  // 돈다(같은 커밋에서 선언 순서대로).
  useEffect(() => {
    track('login_view', { via: via.current });
  }, []);

  const social = useMemo(
    () => ({
      google: tracked('google', loginWithGoogle),
      kakao: tracked('kakao', loginWithKakao),
      apple: tracked('apple', loginWithApple),
    }),
    [loginWithGoogle, loginWithKakao, loginWithApple],
  );

  return (
    <LoginScreen
      onLogin={login}
      onGoogleLogin={social.google}
      onKakaoLogin={social.kakao}
      onAppleLogin={social.apple}
      lastLoginProvider={lastProvider}
      initialError={resumeError}
      busy={resuming}
      // 실패 코드를 문구에 덧붙인다 (#959) — 배포본 장애는 재현이 안 돼
      // 테스터가 보내주는 이 값이 유일한 단서다.
      describeSocialFailure={(base) => {
        const f = getLastLoginFailure();
        return f ? loginErrorMessage(base, f) : base;
      }}
      // 이메일 가입 잠정 제외 — 복구 시 되살릴 것: onGoSignup={() => router.push('/signup')}
      onAuthSuccess={() => router.replace('/')}
    />
  );
}

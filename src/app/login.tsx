import { router } from 'expo-router';
import { useEffect, useState } from 'react';

import { getLastLoginFailure, loginErrorMessage } from '@/lib/login-error';
import { LoginScreen } from '@/components/screens/login-screen';
import { useAuth } from '@/hooks/use-auth';
import { hasKakaoRedirect } from '@/lib/kakao-auth';
import { loadLastLoginProvider, type SocialProvider } from '@/lib/last-login';

export default function Login() {
  const { login, loginWithGoogle, loginWithKakao, loginWithApple } = useAuth();
  // 최근 로그인 배지 (#489 후속) — 로딩 전에는 배지 없이 그린다(깜빡임 무해).
  const [lastProvider, setLastProvider] = useState<SocialProvider | null>(null);
  // 웹 카카오 로그인은 kauth 리다이렉트로 돌아온다 — 복귀 진입이면 사용자가
  // 다시 누르지 않아도 나머지 절반(코드 교환 → /auth/kakao)을 이어서 끝낸다.
  // 네이티브는 hasKakaoRedirect가 항상 false라 이 효과가 아무 일도 안 한다.
  const [resumeError, setResumeError] = useState<string | null>(null);
  // 복귀 교환이 도는 동안 화면을 잠근다 — 화면의 submitting은 화면 안 탭만 알아서,
  // 이 값이 없으면 교환 중에 누른 카카오 버튼이 두 번째 시도를 시작한다.
  const [resuming, setResuming] = useState(false);
  useEffect(() => {
    if (!hasKakaoRedirect()) return;
    setResuming(true);
    void loginWithKakao().then((result) => {
      setResuming(false);
      if (result === 'ok') router.replace('/');
      else if (result === 'failed') {
        const base = '카카오 로그인에 실패했어요. 잠시 후 다시 시도해 주세요.';
        const f = getLastLoginFailure();
        setResumeError(f ? loginErrorMessage(base, f) : base);
      }
    });
  }, [loginWithKakao]);
  useEffect(() => {
    let active = true;
    void loadLastLoginProvider().then((p) => {
      if (active) setLastProvider(p);
    });
    return () => {
      active = false;
    };
  }, []);
  return (
    <LoginScreen
      onLogin={login}
      onGoogleLogin={loginWithGoogle}
      onKakaoLogin={loginWithKakao}
      onAppleLogin={loginWithApple}
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

import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';

import { getLastLoginFailure, loginErrorMessage } from '@/lib/login-error';
import { IntroScreen } from '@/components/screens/intro-screen';
import { LoginScreen } from '@/components/screens/login-screen';
import { useAuth } from '@/hooks/use-auth';
import { track } from '@/lib/analytics';
import { loadIntroSeen, markIntroSeen } from '@/lib/intro-store';
import { hasKakaoRedirect } from '@/lib/kakao-auth';
import { loadLastLoginProvider, type SocialProvider } from '@/lib/last-login';

type SocialLogin = () => Promise<'ok' | 'cancelled' | 'failed'>;

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

/** 로그인 화면에 어떻게 왔나 — `login_view`의 via. */
type LoginVia = 'intro' | 'have_account' | 'direct' | 'kakao_redirect';

export default function Login() {
  const { login, loginWithGoogle, loginWithKakao, loginWithApple } = useAuth();
  // 최근 로그인 배지 (#489 후속) — 로딩 전에는 배지 없이 그린다(깜빡임 무해).
  const [lastProvider, setLastProvider] = useState<SocialProvider | null>(null);
  // 로그인 전 소개 (#1282) — 이 기기에서 처음이면 로그인 화면보다 먼저 보여 준다.
  // null = 아직 모름. 저장소를 읽기 전에 로그인 화면을 그리면 소개가 뒤늦게 덮으며
  // 깜빡이므로 그동안은 아무것도 그리지 않는다. hasKakaoRedirect는 window를 읽어
  // 정적 export 렌더에서 부를 수 없으니 초기값이 아니라 이펙트에서 판정한다 —
  // 판정은 아래 복귀 이펙트 한 곳에서만 한다(교환이 복귀 파라미터를 걷어내므로
  // 다른 이펙트가 다시 물으면 false가 나온다).
  const [introSeen, setIntroSeen] = useState<boolean | null>(null);
  const via = useRef<LoginVia>('direct');
  // 웹 카카오 로그인은 kauth 리다이렉트로 돌아온다 — 복귀 진입이면 사용자가
  // 다시 누르지 않아도 나머지 절반(코드 교환 → /auth/kakao)을 이어서 끝낸다.
  // 네이티브는 hasKakaoRedirect가 항상 false라 이 효과가 아무 일도 안 한다.
  const [resumeError, setResumeError] = useState<string | null>(null);
  // 복귀 교환이 도는 동안 화면을 잠근다 — 화면의 submitting은 화면 안 탭만 알아서,
  // 이 값이 없으면 교환 중에 누른 카카오 버튼이 두 번째 시도를 시작한다.
  const [resuming, setResuming] = useState(false);
  useEffect(() => {
    if (!hasKakaoRedirect()) return;
    // 이미 로그인 버튼을 누르고 돌아온 사람이다 — 소개 차례가 아니다. 교환을 시작하기
    // 전에 기록한다: getKakaoAccessToken이 URL·세션스토리지의 복귀 파라미터를 지운다.
    via.current = 'kakao_redirect';
    setIntroSeen(true);
    setResuming(true);
    void loginWithKakao().then((result) => {
      setResuming(false);
      if (result === 'ok') router.replace('/');
      else if (result === 'cancelled') track('login_cancel', { provider: 'kakao' });
      else {
        const base = '카카오 로그인에 실패했어요. 잠시 후 다시 시도해 주세요.';
        const f = getLastLoginFailure();
        setResumeError(f ? loginErrorMessage(base, f) : base);
      }
    });
  }, [loginWithKakao]);
  useEffect(() => {
    // 복귀 판정은 위 이펙트가 이미 했다(같은 커밋에서 선언 순서대로 돈다).
    if (via.current === 'kakao_redirect') return;
    let active = true;
    void loadIntroSeen().then((seen) => {
      // 이미 정해졌으면(복귀) 뒤늦은 저장소 값으로 덮지 않는다.
      if (active) setIntroSeen((prev) => prev ?? seen);
    });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    let active = true;
    void loadLastLoginProvider().then((p) => {
      if (active) setLastProvider(p);
    });
    return () => {
      active = false;
    };
  }, []);

  // 로그인 화면 노출 — 마운트당 1회. 소개에서 넘어온 경우도 여기서 센다.
  const showLogin = introSeen === true;
  const loginViewed = useRef(false);
  useEffect(() => {
    if (!showLogin || loginViewed.current) return;
    loginViewed.current = true;
    track('login_view', { via: via.current });
  }, [showLogin]);

  const social = useMemo(
    () => ({
      google: tracked('google', loginWithGoogle),
      kakao: tracked('kakao', loginWithKakao),
      apple: tracked('apple', loginWithApple),
    }),
    [loginWithGoogle, loginWithKakao, loginWithApple],
  );

  const leaveIntro = (exit: 'intro_complete' | 'intro_have_account') => {
    track(exit);
    via.current = exit === 'intro_complete' ? 'intro' : 'have_account';
    setIntroSeen(true);
    void markIntroSeen();
  };

  if (introSeen === null) return null;
  if (!introSeen) {
    return (
      <IntroScreen
        onSlideView={(step, index) => track('intro_view', { step, index })}
        onHaveAccount={() => leaveIntro('intro_have_account')}
        onDone={() => leaveIntro('intro_complete')}
      />
    );
  }
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

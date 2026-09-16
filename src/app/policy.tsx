import { router, useLocalSearchParams } from 'expo-router';

import { PolicyViewerScreen } from '@/components/screens/policy-viewer-screen';
import { type PolicyDoc, policyUrlFor } from '@/constants/policy';
import { useLanguage } from '@/hooks/use-language';
import { useT } from '@/i18n';

/** In-app policy viewer route — `/policy?doc=terms|privacy` (defaults to terms). */
export default function Policy() {
  const { doc } = useLocalSearchParams<{ doc?: string }>();
  const tr = useT();
  // 문서 주소는 앱 언어를 따른다 (#1369) — 영어 UI에서 한국어 약관이 뜨지 않게.
  const { language } = useLanguage();
  const key: PolicyDoc = doc === 'privacy' ? 'privacy' : 'terms';
  return (
    <PolicyViewerScreen
      title={tr(`app.policy.${key}`)}
      url={policyUrlFor(key, language)}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
    />
  );
}

import { router, useLocalSearchParams } from 'expo-router';

import { PolicyViewerScreen } from '@/components/screens/policy-viewer-screen';
import { type PolicyDoc, PolicyUrls } from '@/constants/policy';

const TITLES: Record<PolicyDoc, string> = {
  terms: '이용약관',
  privacy: '개인정보처리방침',
};

/** In-app policy viewer route — `/policy?doc=terms|privacy` (defaults to terms). */
export default function Policy() {
  const { doc } = useLocalSearchParams<{ doc?: string }>();
  const key: PolicyDoc = doc === 'privacy' ? 'privacy' : 'terms';
  return (
    <PolicyViewerScreen
      title={TITLES[key]}
      url={PolicyUrls[key]}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
    />
  );
}

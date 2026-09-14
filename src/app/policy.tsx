import { router, useLocalSearchParams } from 'expo-router';

import { PolicyViewerScreen } from '@/components/screens/policy-viewer-screen';
import { type PolicyDoc, PolicyUrls } from '@/constants/policy';
import { i18n } from '@/i18n';

const TITLES: Record<PolicyDoc, string> = {
  terms: 'app.policy.terms',
  privacy: 'app.policy.privacy',
};

/** In-app policy viewer route — `/policy?doc=terms|privacy` (defaults to terms). */
export default function Policy() {
  const { doc } = useLocalSearchParams<{ doc?: string }>();
  const key: PolicyDoc = doc === 'privacy' ? 'privacy' : 'terms';
  return (
    <PolicyViewerScreen
      title={i18n.t(TITLES[key])}
      url={PolicyUrls[key]}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
    />
  );
}

import { router } from 'expo-router';
import { openBrowserAsync } from 'expo-web-browser';

import { SignupScreen } from '@/components/screens/signup-screen';
import { PolicyUrls } from '@/constants/policy';

export default function Signup() {
  return (
    <SignupScreen
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/login'))}
      onSignupSuccess={() => router.replace('/')}
      onViewPolicy={(doc) => openBrowserAsync(PolicyUrls[doc])}
    />
  );
}

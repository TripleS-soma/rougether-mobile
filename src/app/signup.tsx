import { router } from 'expo-router';

import { SignupScreen } from '@/components/screens/signup-screen';

export default function Signup() {
  return (
    <SignupScreen
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/login'))}
      onSignupSuccess={() => router.replace('/')}
    />
  );
}

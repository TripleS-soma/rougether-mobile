import { router } from 'expo-router';

import { BrandSplit } from '@/components/app/brand-split';
import { SignupScreen } from '@/components/screens/signup-screen';

export default function Signup() {
  return (
    <BrandSplit>
      <SignupScreen
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/login'))}
        onSignupSuccess={() => router.replace('/')}
        onViewPolicy={(doc) => router.push({ pathname: '/policy', params: { doc } })}
      />
    </BrandSplit>
  );
}

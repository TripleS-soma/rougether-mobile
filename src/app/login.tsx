import { router } from 'expo-router';

import { LoginScreen } from '@/components/screens/login-screen';

export default function Login() {
  return (
    <LoginScreen
      onGoSignup={() => router.push('/signup')}
      onAuthSuccess={() => router.replace('/')}
    />
  );
}

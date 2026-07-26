import { router } from 'expo-router';

import { LoginScreen } from '@/components/screens/login-screen';
import { useAuth } from '@/hooks/use-auth';

export default function Login() {
  const { login, loginWithGoogle } = useAuth();
  return (
    <LoginScreen
      onLogin={login}
      onGoogleLogin={loginWithGoogle}
      onGoSignup={() => router.push('/signup')}
      onAuthSuccess={() => router.replace('/')}
    />
  );
}

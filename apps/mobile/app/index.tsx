import { Redirect } from 'expo-router';
import { useAuth } from '../src/auth';
import { Loading, Screen } from '../src/components/ui';

/**
 * Startpunkten avgör bara vart användaren ska: inloggning, onboarding eller
 * rätt flik beroende på kontotyp.
 */
export default function Index() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <Screen>
        <Loading label="Startar …" />
      </Screen>
    );
  }

  if (!user) return <Redirect href="/login" />;

  if (!user.onboardingComplete) {
    return (
      <Redirect href={user.role === 'BUSINESS' ? '/onboarding/business' : '/onboarding/influencer'} />
    );
  }

  return <Redirect href={user.role === 'BUSINESS' ? '/(business)/campaigns' : '/(influencer)/swipe'} />;
}

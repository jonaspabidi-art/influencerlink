import { Redirect, Tabs } from 'expo-router';
import { useEffect } from 'react';
import { useAuth } from '../../src/auth';
import { useTour } from '../../src/tour/Tour';
import { INFLUENCER_TOUR_KEY, influencerTour } from '../../src/tour/steps';
import { ChatIcon, DeckIcon, DocIcon, UserIcon, WalletIcon } from '../../src/components/icons';
import { colors, type } from '../../src/theme';

export default function InfluencerTabs() {
  const { user, loading } = useAuth();
  const { startOnce } = useTour();

  // Samma som för företagen: turen väntar tills flikraden finns att peka på.
  const ready = !loading && !!user && user.onboardingComplete;
  useEffect(() => {
    if (ready) startOnce(INFLUENCER_TOUR_KEY, influencerTour);
  }, [ready, startOnce]);

  // Efter utloggning ska flikarna inte ligga kvar bakom en tom session.
  if (!loading && !user) return <Redirect href="/login" />;

  /*
   * En halvfärdig profil hör hemma i onboardingen, inte i flikarna.
   *
   * Avbryter någon mitt i – laddar om sidan, stänger appen, trycker bakåt –
   * finns kontot men ingen profil, och då svarade varje flik "kunde inte
   * hämta". Tre felmeddelanden i rad ser ut som en trasig app, inte som ett
   * halvfärdigt formulär. Det spelar särskilt roll som webbapp, där adressen
   * är riktig och omladdningsknappen finns.
   */
  if (!loading && user && !user.onboardingComplete) {
    return <Redirect href="/onboarding/influencer" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.bg },
        tabBarStyle: {
          backgroundColor: colors.bg,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 76,
          paddingTop: 8,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { ...type.tab, marginTop: 2 },
      }}
    >
      <Tabs.Screen
        name="swipe"
        options={{
          title: 'Upptäck',
          tabBarIcon: ({ color }) => <DeckIcon size={21} color={color} />,
        }}
      />
      <Tabs.Screen
        name="matches"
        options={{
          title: 'Matchningar',
          tabBarIcon: ({ color }) => <ChatIcon size={21} color={color} />,
        }}
      />
      <Tabs.Screen
        name="contracts"
        options={{
          title: 'Avtal',
          tabBarIcon: ({ color }) => <DocIcon size={21} color={color} />,
        }}
      />
      <Tabs.Screen
        name="wallet"
        options={{
          title: 'Plånbok',
          tabBarIcon: ({ color }) => <WalletIcon size={21} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color }) => <UserIcon size={21} color={color} />,
        }}
      />
    </Tabs>
  );
}

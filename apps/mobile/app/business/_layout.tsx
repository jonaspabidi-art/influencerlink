import { Redirect, Tabs } from 'expo-router';
import { useEffect } from 'react';
import { useAuth } from '../../src/auth';
import { useTour } from '../../src/tour/Tour';
import { BUSINESS_TOUR_KEY, businessTour } from '../../src/tour/steps';
import { ChatIcon, DeckIcon, GridIcon, UserIcon } from '../../src/components/icons';
import { useTabScreenOptions } from '../../src/components/tabs';

export default function BusinessTabs() {
  const tabOptions = useTabScreenOptions();
  const { user, loading } = useAuth();
  const { startOnce } = useTour();

  /*
   * Rundturen startar först när flikarna faktiskt är på plats, annars pekar
   * pilen mot en flikrad som ännu inte ritats. Den visas en gång per konto
   * och enhet, och går att starta om under Profil.
   */
  const ready = !loading && !!user && user.onboardingComplete;
  useEffect(() => {
    if (ready) startOnce(BUSINESS_TOUR_KEY, businessTour);
  }, [ready, startOnce]);

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
    return <Redirect href="/onboarding/business" />;
  }

  return (
    <Tabs screenOptions={tabOptions}>
      <Tabs.Screen
        name="discover"
        options={{
          title: 'Kreatörer',
          tabBarIcon: ({ color }) => <DeckIcon size={21} color={color} />,
        }}
      />
      <Tabs.Screen
        name="campaigns"
        options={{
          title: 'Uppdrag',
          tabBarIcon: ({ color }) => <GridIcon size={21} color={color} />,
        }}
      />
      {/*
        En flik, inte två. Matchningar och Avtal var två arkivfack för samma
        förlopp, och för en krögare som gör en kampanj i kvartalet stod båda
        tomma nästan jämt – två av fem flikar utan innehåll.
      */}
      <Tabs.Screen
        name="collaborations"
        options={{
          title: 'Samarbeten',
          tabBarIcon: ({ color }) => <ChatIcon size={21} color={color} />,
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

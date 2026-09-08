import { Redirect, Tabs } from 'expo-router';
import { useAuth } from '../../src/auth';
import { ChatIcon, DeckIcon, DocIcon, GridIcon, UserIcon } from '../../src/components/icons';
import { colors, type } from '../../src/theme';

export default function BusinessTabs() {
  const { user, loading } = useAuth();

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
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color }) => <UserIcon size={21} color={color} />,
        }}
      />
    </Tabs>
  );
}

import { Redirect, Tabs } from 'expo-router';
import { useAuth } from '../../src/auth';
import { ChatIcon, DeckIcon, DocIcon, WalletIcon } from '../../src/components/icons';
import { colors, type } from '../../src/theme';

export default function InfluencerTabs() {
  const { user, loading } = useAuth();

  // Efter utloggning ska flikarna inte ligga kvar bakom en tom session.
  if (!loading && !user) return <Redirect href="/login" />;

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
    </Tabs>
  );
}

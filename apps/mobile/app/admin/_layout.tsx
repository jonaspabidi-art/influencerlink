import { Redirect, Tabs } from 'expo-router';
import { useAuth } from '../../src/auth';
import { DocIcon, GridIcon, LockIcon, UserIcon } from '../../src/components/icons';
import { colors, type } from '../../src/theme';

/**
 * Plattformsvyn, bara för ADMIN.
 *
 * Rollen sätts inte i appen utan direkt i databasen. Ingen kan alltså råka bli
 * admin, och en kapad vanlig session kan inte höja sig själv.
 */
export default function AdminTabs() {
  const { user, loading } = useAuth();

  if (!loading && !user) return <Redirect href="/login" />;
  if (!loading && user && user.role !== 'ADMIN') return <Redirect href="/" />;

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
        name="index"
        options={{
          title: 'Översikt',
          tabBarIcon: ({ color }) => <LockIcon size={21} color={color} />,
        }}
      />
      <Tabs.Screen
        name="businesses"
        options={{
          title: 'Företag',
          tabBarIcon: ({ color }) => <GridIcon size={21} color={color} />,
        }}
      />
      <Tabs.Screen
        name="influencers"
        options={{
          title: 'Kreatörer',
          tabBarIcon: ({ color }) => <UserIcon size={21} color={color} />,
        }}
      />
      <Tabs.Screen
        name="contracts"
        options={{
          title: 'Avtal',
          tabBarIcon: ({ color }) => <DocIcon size={21} color={color} />,
        }}
      />
      {/* Nås inifrån flikarna, inte från fältet längst ned. */}
      <Tabs.Screen name="expert-orders" options={{ href: null }} />
      <Tabs.Screen name="campaign-new" options={{ href: null }} />
      <Tabs.Screen name="business/[id]" options={{ href: null }} />
      <Tabs.Screen name="influencer/[id]" options={{ href: null }} />
      <Tabs.Screen name="contract/[id]" options={{ href: null }} />
    </Tabs>
  );
}

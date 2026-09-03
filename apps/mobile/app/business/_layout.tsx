import { Redirect, Tabs } from 'expo-router';
import { useAuth } from '../../src/auth';
import { ChatIcon, DocIcon, GridIcon } from '../../src/components/icons';
import { colors, type } from '../../src/theme';

export default function BusinessTabs() {
  const { user, loading } = useAuth();

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
        name="campaigns"
        options={{
          title: 'Kampanjer',
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
    </Tabs>
  );
}

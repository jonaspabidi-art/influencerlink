import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '../src/auth';
import { colors } from '../src/theme';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Mobilt nät är opålitligt; ett omförsök räcker innan vi visar felet.
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <StatusBar style="light" />
            <Stack
              screenOptions={{
                headerStyle: { backgroundColor: colors.background },
                headerTintColor: colors.text,
                headerTitleStyle: { fontWeight: '700' },
                contentStyle: { backgroundColor: colors.background },
              }}
            >
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="login" options={{ headerShown: false }} />
              <Stack.Screen name="(influencer)" options={{ headerShown: false }} />
              <Stack.Screen name="(business)" options={{ headerShown: false }} />
              <Stack.Screen
                name="onboarding/influencer"
                options={{ title: 'Skapa din profil' }}
              />
              <Stack.Screen name="onboarding/business" options={{ title: 'Om restaurangen' }} />
              <Stack.Screen name="campaign/new" options={{ title: 'Nytt samarbete' }} />
              <Stack.Screen name="campaign/[id]" options={{ title: 'Kampanj' }} />
              <Stack.Screen name="discover/[campaignId]" options={{ title: 'Hitta influencers' }} />
              <Stack.Screen name="match/[id]" options={{ title: 'Matchning' }} />
              <Stack.Screen name="contract/[id]" options={{ title: 'Avtal' }} />
            </Stack>
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

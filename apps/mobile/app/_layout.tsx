import {
  InstrumentSans_400Regular,
  InstrumentSans_500Medium,
  InstrumentSans_600SemiBold,
  InstrumentSans_700Bold,
  useFonts,
} from '@expo-google-fonts/instrument-sans';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '../src/auth';
import { colors, type } from '../src/theme';

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
  const [fontsLoaded] = useFonts({
    InstrumentSans_400Regular,
    InstrumentSans_500Medium,
    InstrumentSans_600SemiBold,
    InstrumentSans_700Bold,
  });

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            {/* Ljust tema: mörk statusfältstext. */}
            <StatusBar style="dark" />
            {fontsLoaded ? (
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: colors.bg },
                  headerStyle: { backgroundColor: colors.bg },
                  headerTintColor: colors.text,
                  headerTitleStyle: { fontFamily: type.rowTitleMedium.fontFamily, fontSize: 17 },
                  headerShadowVisible: false,
                }}
              />
            ) : (
              // Typsnittet laddas innan något ritas, annars hoppar all text.
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
                <ActivityIndicator color={colors.primary} />
              </View>
            )}
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

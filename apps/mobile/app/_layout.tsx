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
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '../src/auth';
import { Prefetch } from '../src/components/Prefetch';
import { persistQueryCache, restoreQueryCache } from '../src/querycache';
import { hideHtmlSplash } from '../src/splash';
import { colors, type } from '../src/theme';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Mobilt nät är opålitligt; ett omförsök räcker innan vi visar felet.
      retry: 1,
      /*
       * Två minuter, inte trettio sekunder. Det mesta i appen ändras långsamt –
       * kampanjer, profiler, kreatörer – och när något faktiskt ändras är det
       * nästan alltid användaren själv som gjort det, varpå skärmen som gjorde
       * ändringen redan avfärdar rätt nycklar.
       */
      staleTime: 2 * 60_000,
      // Data ligger kvar en timme efter att sista skärmen slutat använda den,
      // så ett besök tillbaka i en flik är omedelbart.
      gcTime: 60 * 60_000,
      refetchOnWindowFocus: false,
    },
  },
});

// Sparad data läggs tillbaka innan något ritas, annars hinner skärmarna visa
// en spinner för data vi redan har.
restoreQueryCache(queryClient);

export default function RootLayout() {
  useEffect(() => persistQueryCache(queryClient), []);

  const [fontsLoaded] = useFonts({
    InstrumentSans_400Regular,
    InstrumentSans_500Medium,
    InstrumentSans_600SemiBold,
    InstrumentSans_700Bold,
  });

  // HTML-startskärmen ligger kvar tills typsnitten är på plats, annars byts
  // loggan mot en halvritad skärm och sedan tillbaka när texten hoppar.
  useEffect(() => {
    if (fontsLoaded) hideHtmlSplash();
  }, [fontsLoaded]);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            {/* Ljust tema: mörk statusfältstext. */}
            <StatusBar style="dark" />
            {/* Fyller flikarna i bakgrunden medan första skärmen läses. */}
            <Prefetch />
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

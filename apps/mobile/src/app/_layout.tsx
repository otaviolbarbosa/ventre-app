import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      {/* Icon color only — Android is edge-to-edge as of SDK 57, so the actual
          bar color comes from the SafeAreaView background (#78130A) behind it,
          matching apps/web's viewport.themeColor / manifest theme_color. */}
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }} />
    </SafeAreaProvider>
  );
}

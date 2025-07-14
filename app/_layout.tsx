import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/useColorScheme';
import { logger } from '@/utils/logger';

export default function RootLayout() {
  logger.debug('RootLayout: Component started');
  
  const colorScheme = useColorScheme();
  logger.debug('RootLayout: Color scheme obtained:', colorScheme);
  
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    if (error) {
      logger.error('RootLayout: Error loading fonts:', error);
    }
    if (loaded) {
      logger.success('RootLayout: Fonts loaded successfully');
      // You can perform actions that depend on fonts being loaded here
    }
  }, [loaded, error]);

  if (!loaded) {
    logger.debug('RootLayout: Fonts not loaded yet, returning null');
    return null; // Show loading screen while fonts load
  }

  logger.debug('RootLayout: About to render main layout');

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="+not-found" />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
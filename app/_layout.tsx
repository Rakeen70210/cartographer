import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/useColorScheme';

export default function RootLayout() {
  console.log('🚀 RootLayout: Component started');
  
  const colorScheme = useColorScheme();
  console.log('🎨 RootLayout: Color scheme obtained:', colorScheme);
  
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });
  console.log('📝 RootLayout: Fonts status - loaded:', loaded, 'error:', error);

  useEffect(() => {
    console.log('⚡ RootLayout: useEffect triggered - loaded:', loaded, 'error:', error);
    if (error) {
      console.error('❌ RootLayout: Error loading fonts:', error);
    }
    if (loaded) {
      console.log('✅ RootLayout: Fonts loaded successfully');
      // You can perform actions that depend on fonts being loaded here
    }
  }, [loaded, error]);

  if (!loaded) {
    console.log('⏳ RootLayout: Fonts not loaded yet, returning null');
    return null; // Show loading screen while fonts load
  }

  console.log('🎯 RootLayout: About to render main layout');

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
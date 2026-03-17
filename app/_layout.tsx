// Powered by OnSpace.AI
import 'react-native-get-random-values';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { WalletProvider } from '../contexts/WalletContext';
import { Colors } from '../constants/theme';

export default function RootLayout() {
  return (
    <WalletProvider>
      <StatusBar style="light" backgroundColor={Colors.background} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Colors.background },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="create" />
        <Stack.Screen name="import" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </WalletProvider>
  );
}

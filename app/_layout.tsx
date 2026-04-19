import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { useUserStore } from '../src/store/userStore';

export default function RootLayout() {
  const loadUsers = useUserStore((s) => s.loadUsers);

  useEffect(() => {
    loadUsers();
  }, []);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="session" />
    </Stack>
  );
}

import { Tabs } from 'expo-router';

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: 'ユーザー' }} />
      <Tabs.Screen name="setup" options={{ title: 'セッション設定' }} />
    </Tabs>
  );
}

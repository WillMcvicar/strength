import { Tabs } from 'expo-router';

import { useColors } from '@/ui/theme';
import { useTypography } from '@/ui/typography';

// The five tabs (DESIGN §7.1). Labels only: text reads clearly and needs no icon package.
export default function TabsLayout() {
  const c = useColors();
  const type = useTypography();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.plateBlue,
        tabBarInactiveTintColor: c.inkMuted,
        tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.line, minHeight: 56 },
        tabBarIconStyle: { display: 'none' },
        tabBarLabelStyle: { ...type.label, fontSize: 15 },
        sceneStyle: { backgroundColor: c.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Today' }} />
      <Tabs.Screen name="week" options={{ title: 'Week' }} />
      <Tabs.Screen name="plans" options={{ title: 'Plans' }} />
      <Tabs.Screen name="progress" options={{ title: 'Progress' }} />
      <Tabs.Screen name="more" options={{ title: 'More' }} />
    </Tabs>
  );
}

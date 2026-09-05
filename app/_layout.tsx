import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'GTSS Map' }} />
      <Stack.Screen name="intersection/[id]" options={{ title: 'Intersection' }} />
    </Stack>
  );
}

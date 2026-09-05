import { Stack } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import AppInfoModal from '@/components/gtss/AppInfoModal';

export default function RootLayout() {
    const [infoModalVisible, setInfoModalVisible] = useState(false);

    const renderHeader = () => (
        <Pressable onPress={() => setInfoModalVisible(true)} hitSlop={8}>
            <View>
                <Text style={{ fontSize: 20, fontWeight: 'bold' }}>GTSS Library</Text>
                <Text>Your source for Traffic Light Data</Text>
            </View>
        </Pressable>
    );

    return (
        <>
            <Stack>
                <Stack.Screen name="index" options={{ headerTitle: renderHeader, title: 'GTSS Library' }} />
                <Stack.Screen name="intersection/[id]" options={{ title: 'Intersection' }} />
            </Stack>
            <AppInfoModal visible={infoModalVisible} onClose={() => setInfoModalVisible(false)} />
        </>
    );
}

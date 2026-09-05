import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import Map from '@/components/Map';
import AgencyModal from '@/components/gtss/AgencyModal';
import ExportModal from '@/components/gtss/ExportModal';
import type { TrafficSignalNode } from '@/lib/osm/overpass';

export default function MapScreen() {
    const router = useRouter();
    const [agencyModalVisible, setAgencyModalVisible] = useState(false);
    const [exportModalVisible, setExportModalVisible] = useState(false);

    function handleSelectIntersection(node: TrafficSignalNode) {
        router.push({
            pathname: '/intersection/[id]',
            params: { id: node.id, lat: String(node.latitude), lon: String(node.longitude) },
        });
    }

    return (
        <>
            <Stack.Screen
                options={{
                    headerRight: () => (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                            <Pressable onPress={() => setExportModalVisible(true)} hitSlop={8}>
                                <Text style={{ color: '#2c3e50', fontWeight: '600' }}>Download GTSS</Text>
                            </Pressable>
                            <Pressable onPress={() => setAgencyModalVisible(true)} hitSlop={8}>
                                <Text style={{ color: '#2c3e50', fontWeight: '600' }}>Configure Agencies</Text>
                            </Pressable>
                        </View>
                    ),
                }}
            />
            <Map onSelectIntersection={handleSelectIntersection} />
            <AgencyModal visible={agencyModalVisible} onClose={() => setAgencyModalVisible(false)} />
            <ExportModal visible={exportModalVisible} onClose={() => setExportModalVisible(false)} />
        </>
    );
}

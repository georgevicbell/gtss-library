import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import type { Agency } from '@/lib/gtss/types';

export interface AgencyPickerProps {
    agencies: Agency[];
    selectedAgencyId: string;
    onSelect: (agency: Agency) => void;
}

// A dropdown-style control for picking which configured agency a signal belongs to.
export default function AgencyPicker({ agencies, selectedAgencyId, onSelect }: AgencyPickerProps) {
    const [open, setOpen] = useState(false);
    const selected = agencies.find((a) => a.agencyId === selectedAgencyId);

    return (
        <View>
            <Pressable style={styles.trigger} onPress={() => setOpen(true)}>
                <Text style={styles.triggerText} numberOfLines={1}>
                    {selected?.agencyName || selectedAgencyId || 'Select agency'}
                </Text>
                <Text style={styles.chevron}>{'\u25be'}</Text>
            </Pressable>

            <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
                <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
                    <View style={styles.menu}>
                        {agencies.map((agency) => (
                            <Pressable
                                key={agency.agencyId}
                                style={[styles.option, agency.agencyId === selectedAgencyId && styles.optionSelected]}
                                onPress={() => {
                                    onSelect(agency);
                                    setOpen(false);
                                }}
                            >
                                <Text style={styles.optionText}>{agency.agencyName || '(unnamed agency)'}</Text>
                                <Text style={styles.optionSub}>{agency.agencyId}</Text>
                            </Pressable>
                        ))}
                    </View>
                </Pressable>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    trigger: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 6,
        paddingVertical: 6,
        paddingHorizontal: 8,
        backgroundColor: '#fff',
    },
    triggerText: { fontSize: 14, color: '#222', flexShrink: 1 },
    chevron: { color: '#777', marginLeft: 8 },
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' },
    menu: {
        backgroundColor: '#fff',
        borderRadius: 8,
        paddingVertical: 6,
        minWidth: 240,
        maxWidth: '85%',
        maxHeight: '70%',
    },
    option: { paddingVertical: 10, paddingHorizontal: 14 },
    optionSelected: { backgroundColor: '#f0f4f8' },
    optionText: { fontSize: 14, fontWeight: '600', color: '#222' },
    optionSub: { fontSize: 11, color: '#888', marginTop: 2 },
});

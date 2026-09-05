import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { getDefaultAgencyId, listAgencies, saveAgencies, setDefaultAgencyId } from '@/lib/gtss/agencyStore';
import type { Agency } from '@/lib/gtss/types';

function blankAgency(): Agency {
    return {
        agencyId: String(Date.now()),
        agencyName: '',
        agencyUrl: '',
        agencyTimezone: 'America/New_York',
        agencyLanguage: 'en',
        agencyEmail: '',
        latitude: null,
        longitude: null,
    };
}

export interface AgencyModalProps {
    visible: boolean;
    onClose: () => void;
}

// Lets the user configure multiple agencies and pick which one is the default for new signals.
export default function AgencyModal({ visible, onClose }: AgencyModalProps) {
    const [agencies, setAgencies] = useState<Agency[]>([]);
    const [defaultId, setDefaultId] = useState<string | null>(null);
    const [editing, setEditing] = useState<Agency | null>(null);

    useEffect(() => {
        if (!visible) return;
        setEditing(null);
        // listAgencies() seeds the default-agency-id the first time it runs, so it must
        // resolve before we read the default id (otherwise the read can race the seed write).
        (async () => {
            const loadedAgencies = await listAgencies();
            setAgencies(loadedAgencies);
            const id = await getDefaultAgencyId();
            setDefaultId(id ?? loadedAgencies[0]?.agencyId ?? null);
        })();
    }, [visible]);

    async function persist(next: Agency[]) {
        setAgencies(next);
        await saveAgencies(next);
    }

    async function handleSetDefault(agencyId: string) {
        setDefaultId(agencyId);
        await setDefaultAgencyId(agencyId);
    }

    function handleAdd() {
        setEditing(blankAgency());
    }

    function handleEdit(agency: Agency) {
        setEditing(agency);
    }

    async function handleDelete(agencyId: string) {
        if (agencies.length <= 1) return;
        const next = agencies.filter((a) => a.agencyId !== agencyId);
        await persist(next);
        if (defaultId === agencyId) {
            await handleSetDefault(next[0].agencyId);
        }
    }

    async function handleSaveEditing() {
        if (!editing || !editing.agencyId.trim() || !editing.agencyName.trim()) return;
        const exists = agencies.some((a) => a.agencyId === editing.agencyId);
        const next = exists
            ? agencies.map((a) => (a.agencyId === editing.agencyId ? editing : a))
            : [...agencies, editing];
        await persist(next);
        if (!defaultId) await handleSetDefault(editing.agencyId);
        setEditing(null);
    }

    return (
        <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent>
            <View style={styles.backdrop}>
                <View style={styles.sheet}>
                    <View style={styles.header}>
                        <Text style={styles.title}>Configure Agencies</Text>
                        <Pressable onPress={onClose}>
                            <Text style={styles.closeText}>Done</Text>
                        </Pressable>
                    </View>

                    <ScrollView style={styles.list}>
                        {agencies.map((agency) => (
                            <View key={agency.agencyId} style={styles.row}>
                                <Pressable style={styles.radio} onPress={() => handleSetDefault(agency.agencyId)}>
                                    <View style={[styles.radioOuter, defaultId === agency.agencyId && styles.radioOuterSelected]}>
                                        {defaultId === agency.agencyId ? <View style={styles.radioInner} /> : null}
                                    </View>
                                </Pressable>
                                <View style={styles.rowInfo}>
                                    <Text style={styles.rowName}>{agency.agencyName || '(unnamed agency)'}</Text>
                                    <Text style={styles.rowSub}>
                                        {agency.agencyId}
                                        {defaultId === agency.agencyId ? '  \u2022  Default' : ''}
                                    </Text>
                                </View>
                                <Pressable style={styles.rowAction} onPress={() => handleEdit(agency)}>
                                    <Text style={styles.rowActionText}>Edit</Text>
                                </Pressable>
                                <Pressable
                                    style={styles.rowAction}
                                    onPress={() => handleDelete(agency.agencyId)}
                                    disabled={agencies.length <= 1}
                                >
                                    <Text style={[styles.rowActionText, styles.deleteText, agencies.length <= 1 && styles.disabledText]}>
                                        Delete
                                    </Text>
                                </Pressable>
                            </View>
                        ))}

                        {editing ? (
                            <View style={styles.form}>
                                <Text style={styles.formTitle}>{agencies.some((a) => a.agencyId === editing.agencyId) ? 'Edit agency' : 'New agency'}</Text>

                                <Text style={styles.fieldLabel}>Agency ID</Text>
                                <TextInput
                                    style={styles.input}
                                    value={editing.agencyId}
                                    onChangeText={(text) => setEditing({ ...editing, agencyId: text })}
                                />
                                <Text style={styles.fieldLabel}>Agency name</Text>
                                <TextInput
                                    style={styles.input}
                                    value={editing.agencyName}
                                    onChangeText={(text) => setEditing({ ...editing, agencyName: text })}
                                />
                                <Text style={styles.fieldLabel}>Agency URL</Text>
                                <TextInput
                                    style={styles.input}
                                    value={editing.agencyUrl ?? ''}
                                    onChangeText={(text) => setEditing({ ...editing, agencyUrl: text })}
                                />
                                <Text style={styles.fieldLabel}>Timezone (IANA)</Text>
                                <TextInput
                                    style={styles.input}
                                    value={editing.agencyTimezone}
                                    onChangeText={(text) => setEditing({ ...editing, agencyTimezone: text })}
                                />
                                <Text style={styles.fieldLabel}>Contact email</Text>
                                <TextInput
                                    style={styles.input}
                                    value={editing.agencyEmail ?? ''}
                                    onChangeText={(text) => setEditing({ ...editing, agencyEmail: text })}
                                />

                                <View style={styles.formActions}>
                                    <Pressable style={styles.cancelButton} onPress={() => setEditing(null)}>
                                        <Text style={styles.cancelButtonText}>Cancel</Text>
                                    </Pressable>
                                    <Pressable style={styles.saveButton} onPress={handleSaveEditing}>
                                        <Text style={styles.saveButtonText}>Save</Text>
                                    </Pressable>
                                </View>
                            </View>
                        ) : (
                            <Pressable style={styles.addButton} onPress={handleAdd}>
                                <Text style={styles.addButtonText}>+ Add agency</Text>
                            </Pressable>
                        )}
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    sheet: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        maxHeight: '85%',
        padding: 16,
    },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    title: { fontSize: 18, fontWeight: '700' },
    closeText: { color: '#2c3e50', fontWeight: '600', fontSize: 15 },
    list: { flexGrow: 0 },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        gap: 8,
    },
    radio: { padding: 4 },
    radioOuter: {
        width: 18,
        height: 18,
        borderRadius: 9,
        borderWidth: 2,
        borderColor: '#bbb',
        alignItems: 'center',
        justifyContent: 'center',
    },
    radioOuterSelected: { borderColor: '#2c3e50' },
    radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#2c3e50' },
    rowInfo: { flex: 1 },
    rowName: { fontSize: 14, fontWeight: '600', color: '#222' },
    rowSub: { fontSize: 12, color: '#777', marginTop: 2 },
    rowAction: { paddingHorizontal: 8, paddingVertical: 4 },
    rowActionText: { color: '#2c3e50', fontWeight: '600', fontSize: 13 },
    deleteText: { color: '#b00020' },
    disabledText: { color: '#ccc' },
    addButton: {
        marginTop: 12,
        paddingVertical: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#2c3e50',
        alignItems: 'center',
    },
    addButtonText: { color: '#2c3e50', fontWeight: '700' },
    form: { marginTop: 12, paddingTop: 8 },
    formTitle: { fontSize: 15, fontWeight: '700', marginBottom: 8 },
    fieldLabel: { fontSize: 12, color: '#555', marginBottom: 4, marginTop: 8 },
    input: {
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 6,
        paddingVertical: 6,
        paddingHorizontal: 8,
        backgroundColor: '#fff',
    },
    formActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 16, marginBottom: 8 },
    cancelButton: { paddingVertical: 10, paddingHorizontal: 14 },
    cancelButtonText: { color: '#555', fontWeight: '600' },
    saveButton: { paddingVertical: 10, paddingHorizontal: 14, backgroundColor: '#2c3e50', borderRadius: 6 },
    saveButtonText: { color: '#fff', fontWeight: '700' },
});

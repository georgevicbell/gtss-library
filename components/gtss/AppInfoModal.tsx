import * as Linking from 'expo-linking';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

export interface AppInfoModalProps {
    visible: boolean;
    onClose: () => void;
}

const links = [
    {
        label: 'GTSS Spec and Examples',
        url: 'https://gtss.dev/',
    },
    {
        label: 'GTSS Library: List of official and unofficial GTSS Files',
        url: 'assets/data/gtss-library.json',
    },
    {
        label: 'GTSS GitHub',
        url: 'https://github.com/redmond2742/GTSS-Signal-Builder',
    },
    {
        label: 'borkbork.ca',
        url: 'https://borkbork.ca/',
    },
    {
        label: 'GTSS Library GitHub',
        url: 'https://github.com/georgevicbell/gtss-library',
    },
];

export default function AppInfoModal({ visible, onClose }: AppInfoModalProps) {
    function openLink(url: string) {
        void Linking.openURL(url);
    }

    return (
        <Modal visible={visible} animationType="fade" onRequestClose={onClose} transparent>
            <View style={styles.backdrop}>
                <View style={styles.dialog}>
                    <View style={styles.header}>
                        <Text style={styles.title}>About GTSS Library</Text>
                        <Pressable onPress={onClose} hitSlop={8}>
                            <Text style={styles.closeText}>Close</Text>
                        </Pressable>
                    </View>

                    <ScrollView contentContainerStyle={styles.content}>
                        <Text style={styles.heading}>What is GTSS?</Text>
                        <Text style={styles.body}>
                            GTSS is the General Traffic Signal Specification, a standardized format for
                            describing traffic signal agencies, locations, phases, and detection equipment.
                        </Text>
                        <Text style={styles.body}>
                            GTSS Library helps you find traffic signal data, load GTSS data, configure intersections,
                            and export GTSS files.
                        </Text>

                        <Text style={styles.heading}>Resources</Text>
                        {links.map((link) => (
                            <Pressable key={link.url} style={styles.linkRow} onPress={() => openLink(link.url)}>
                                <Text style={styles.linkLabel}>{link.label}</Text>
                                <Text style={styles.linkUrl} numberOfLines={1}>{link.url}</Text>
                            </Pressable>
                        ))}
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
    },
    dialog: {
        width: '100%',
        maxWidth: 520,
        maxHeight: '85%',
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 18,
    },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    title: { fontSize: 20, fontWeight: '700', color: '#1d2a35' },
    closeText: { color: '#2c3e50', fontWeight: '600', fontSize: 15 },
    content: { paddingTop: 18, paddingBottom: 4 },
    heading: { fontSize: 15, fontWeight: '700', color: '#1d2a35', marginTop: 8, marginBottom: 6 },
    body: { fontSize: 14, lineHeight: 21, color: '#4d5963', marginBottom: 10 },
    linkRow: { paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#e6eaed' },
    linkLabel: { color: '#1b6eaa', fontSize: 14, fontWeight: '600' },
    linkUrl: { color: '#7a858d', fontSize: 12, marginTop: 3 },
});
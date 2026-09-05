import JSZip from 'jszip';
import { Platform } from 'react-native';

import {
    agencyToCsv,
    approachesToCsv,
    basicTimingsToCsv,
    detectorsToCsv,
    phasesToCsv,
    signalsToCsv,
} from './csv';
import type { GtssFeed } from './types';

function buildZip(feed: GtssFeed): JSZip {
    const zip = new JSZip();
    zip.file('agency.txt', agencyToCsv(feed.agency));
    zip.file('signals.txt', signalsToCsv([feed.signal]));
    zip.file('approaches.txt', approachesToCsv(feed.approaches));
    zip.file('phases.txt', phasesToCsv(feed.phases, feed.basicTimings, feed.approaches));
    zip.file('detectors.txt', detectorsToCsv(feed.detectors));
    zip.file('basic_timings.txt', basicTimingsToCsv(feed.basicTimings));
    return zip;
}

function downloadOnWeb(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

async function shareOnNative(base64: string, filename: string) {
    // Loaded lazily so web bundles never pull in native-only file APIs.
    const { File, Paths } = await import('expo-file-system');
    const Sharing = await import('expo-sharing');

    const file = new File(Paths.cache, filename) as InstanceType<typeof File> & {
        exists: boolean;
        delete: () => void;
        create: () => void;
        write: (content: string, options?: { encoding?: 'utf8' | 'base64' }) => void;
        uri: string;
    };
    if (file.exists) file.delete();
    file.create();
    file.write(base64, { encoding: 'base64' });

    if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, { mimeType: 'application/zip', UTI: 'public.zip-archive' });
    }
}

export async function exportGtssZip(feed: GtssFeed): Promise<void> {
    const zip = buildZip(feed);
    const filename = `gtss-${feed.signalId}.zip`;

    if (Platform.OS === 'web') {
        const blob = await zip.generateAsync({ type: 'blob' });
        downloadOnWeb(blob, filename);
        return;
    }

    const base64 = await zip.generateAsync({ type: 'base64' });
    await shareOnNative(base64, filename);
}

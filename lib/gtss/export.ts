import JSZip from 'jszip';
import { Platform } from 'react-native';

import {
    agenciesToCsv,
    agencyToCsv,
    approachesToCsv,
    basicTimingsToCsv,
    detectorsToCsv,
    phasesToCsv,
    signalsToCsv,
} from './csv';
import type { Agency, GtssFeed } from './types';

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

// Combined export across many intersections, with one agency.txt row per distinct agency.
function buildBundleZip(feeds: GtssFeed[]): JSZip {
    const agenciesById = new Map<string, Agency>();
    for (const feed of feeds) {
        agenciesById.set(feed.agency.agencyId, feed.agency);
    }
    const approaches = feeds.flatMap((feed) => feed.approaches);
    const basicTimings = feeds.flatMap((feed) => feed.basicTimings);

    const zip = new JSZip();
    zip.file('agency.txt', agenciesToCsv([...agenciesById.values()]));
    zip.file('signals.txt', signalsToCsv(feeds.map((feed) => feed.signal)));
    zip.file('approaches.txt', approachesToCsv(approaches));
    zip.file('phases.txt', phasesToCsv(feeds.flatMap((feed) => feed.phases), basicTimings, approaches));
    zip.file('detectors.txt', detectorsToCsv(feeds.flatMap((feed) => feed.detectors)));
    zip.file('basic_timings.txt', basicTimingsToCsv(basicTimings));
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

async function saveZip(zip: JSZip, filename: string): Promise<void> {
    if (Platform.OS === 'web') {
        const blob = await zip.generateAsync({ type: 'blob' });
        downloadOnWeb(blob, filename);
        return;
    }

    const base64 = await zip.generateAsync({ type: 'base64' });
    await shareOnNative(base64, filename);
}

export async function exportGtssZip(feed: GtssFeed): Promise<void> {
    await saveZip(buildZip(feed), `gtss-${feed.signalId}.zip`);
}

// Exports a single GTSS zip containing every signal from the given feeds.
export async function exportGtssBundle(feeds: GtssFeed[]): Promise<void> {
    await saveZip(buildBundleZip(feeds), 'gtss-export.zip');
}

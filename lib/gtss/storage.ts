import AsyncStorage from '@react-native-async-storage/async-storage';

import { getDefaultAgency } from './agencyStore';
import type { Agency, GtssFeed } from './types';

const STORAGE_KEY_PREFIX = 'gtss-feed:';

function storageKey(signalId: string): string {
    return `${STORAGE_KEY_PREFIX}${signalId}`;
}

export async function loadFeed(signalId: string): Promise<GtssFeed | null> {
    const raw = await AsyncStorage.getItem(storageKey(signalId));
    if (!raw) return null;
    return JSON.parse(raw) as GtssFeed;
}

export async function saveFeed(feed: GtssFeed): Promise<void> {
    await AsyncStorage.setItem(storageKey(feed.signalId), JSON.stringify(feed));
}

export async function deleteFeed(signalId: string): Promise<void> {
    await AsyncStorage.removeItem(storageKey(signalId));
}

// Loads every saved feed (all intersections), sorted by signalId.
// Entries stored by older schema versions (or corrupted) are skipped.
export async function listAllFeeds(): Promise<GtssFeed[]> {
    const keys = await AsyncStorage.getAllKeys();
    const feedKeys = keys.filter((key) => key.startsWith(STORAGE_KEY_PREFIX));
    if (feedKeys.length === 0) return [];
    const pairs = await AsyncStorage.multiGet(feedKeys);
    const feeds: GtssFeed[] = [];
    for (const [, raw] of pairs) {
        if (!raw) continue;
        try {
            const parsed = JSON.parse(raw) as GtssFeed;
            const valid =
                parsed &&
                typeof parsed.signalId === 'string' &&
                parsed.signal &&
                parsed.agency &&
                typeof parsed.agency.agencyId === 'string';
            if (valid) feeds.push(parsed);
        } catch {
            // Skip entries that fail to parse.
        }
    }
    return feeds.sort((a, b) => a.signalId.localeCompare(b.signalId));
}

// Builds a fresh feed for an intersection that doesn't have GTSS data yet.
export function createDefaultFeed(signalId: string, latitude: number, longitude: number, agency: Agency): GtssFeed {
    return {
        signalId,
        agency: { ...agency },
        signal: {
            signalId,
            agencyId: agency.agencyId,
            streetName1: '',
            streetName2: '',
            latitude,
            longitude,
        },
        approaches: [],
        phases: [],
        detectors: [],
        basicTimings: [],
    };
}

// Loads the existing feed for a signal, or creates+persists a default one.
export async function loadOrCreateFeed(
    signalId: string,
    latitude: number,
    longitude: number
): Promise<GtssFeed> {
    const existing = await loadFeed(signalId);
    if (existing) return existing;
    const agency = await getDefaultAgency();
    const feed = createDefaultFeed(signalId, latitude, longitude, agency);
    await saveFeed(feed);
    return feed;
}

import AsyncStorage from '@react-native-async-storage/async-storage';

import { DEFAULT_AGENCY, DEFAULT_AGENCY_ID } from './defaults';
import type { GtssFeed } from './types';

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

// Builds a fresh feed for an intersection that doesn't have GTSS data yet.
export function createDefaultFeed(signalId: string, latitude: number, longitude: number): GtssFeed {
    return {
        signalId,
        agency: { ...DEFAULT_AGENCY },
        signal: {
            signalId,
            agencyId: DEFAULT_AGENCY_ID,
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
    const feed = createDefaultFeed(signalId, latitude, longitude);
    await saveFeed(feed);
    return feed;
}

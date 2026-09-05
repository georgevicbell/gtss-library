// A catalog of published GTSS feeds the user can browse and choose to load.
import AsyncStorage from '@react-native-async-storage/async-storage';

import builtInLibrary from '@/assets/data/gtss-library.json';

export interface GtssLibraryEntry {
    title: string;
    'gtss-url': string;
    official: boolean;
    'date-added': string;
    'date-updated': string;
    'owner-email': string;
    'owner-url': string;
    'lat-min': number;
    'lon-min': number;
    'lat-max': number;
    'lon-max': number;
}

const CUSTOM_ENTRIES_KEY = 'gtss-library-custom-entries';

function isLibraryEntry(value: unknown): value is GtssLibraryEntry {
    return (
        typeof value === 'object' &&
        value !== null &&
        typeof (value as GtssLibraryEntry).title === 'string' &&
        typeof (value as GtssLibraryEntry)['gtss-url'] === 'string'
    );
}

// User-added entries (from a pasted URL or an uploaded library file), persisted locally.
export async function getCustomLibraryEntries(): Promise<GtssLibraryEntry[]> {
    const raw = await AsyncStorage.getItem(CUSTOM_ENTRIES_KEY);
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.filter(isLibraryEntry) : [];
    } catch {
        return [];
    }
}

async function saveCustomLibraryEntries(entries: GtssLibraryEntry[]): Promise<void> {
    await AsyncStorage.setItem(CUSTOM_ENTRIES_KEY, JSON.stringify(entries));
}

// Merges entries in by gtss-url, so re-adding the same URL updates it instead of duplicating it.
export async function addCustomLibraryEntries(entries: GtssLibraryEntry[]): Promise<void> {
    const existing = await getCustomLibraryEntries();
    const byUrl = new Map(existing.map((e) => [e['gtss-url'], e]));
    for (const entry of entries) byUrl.set(entry['gtss-url'], entry);
    await saveCustomLibraryEntries([...byUrl.values()]);
}

export async function removeCustomLibraryEntry(gtssUrl: string): Promise<void> {
    const existing = await getCustomLibraryEntries();
    await saveCustomLibraryEntries(existing.filter((e) => e['gtss-url'] !== gtssUrl));
}

// Loads the full catalog: the bundled library plus any user-added entries.
export async function loadLibrary(): Promise<GtssLibraryEntry[]> {
    const custom = await getCustomLibraryEntries();
    return [...(builtInLibrary as GtssLibraryEntry[]), ...custom];
}

// Builds a minimal entry for a manually pasted GTSS URL.
export function createEntryFromUrl(gtssUrl: string): GtssLibraryEntry {
    const now = new Date().toISOString();
    return {
        title: gtssUrl,
        'gtss-url': gtssUrl,
        official: false,
        'date-added': now,
        'date-updated': now,
        'owner-email': '',
        'owner-url': '',
        'lat-min': 0,
        'lon-min': 0,
        'lat-max': 0,
        'lon-max': 0,
    };
}

const SELECTED_URLS_KEY = 'gtss-library-selected-urls';

// Which library entries the user has chosen to load, keyed by gtss-url.
export async function getSelectedLibraryUrls(): Promise<string[]> {
    const raw = await AsyncStorage.getItem(SELECTED_URLS_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
}

export async function setSelectedLibraryUrls(urls: string[]): Promise<void> {
    await AsyncStorage.setItem(SELECTED_URLS_KEY, JSON.stringify(urls));
}

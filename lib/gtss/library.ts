// A catalog of published GTSS feeds the user can browse and choose to load.
import AsyncStorage from '@react-native-async-storage/async-storage';
import JSZip from 'jszip';

import builtInLibrary from '@/assets/data/gtss-library.json';
import type { MapBounds } from '@/lib/osm/overpass';
import { listAgencies, saveAgencies } from './agencyStore';
import { BUNDLED_GTSS_ZIPS } from './bundledFeeds';
import {
    parseAgenciesCsv,
    parseApproachesCsv,
    parseBasicTimingsCsv,
    parseDetectorsCsv,
    parsePhasesCsv,
    parseSignalsCsv,
} from './csv';
import { saveFeed } from './storage';
import type { Agency, GtssFeed } from './types';

export interface GtssLibraryEntry {
    title: string;
    'gtss-url': string;
    official: boolean;
    'date-added': string;
    'owner-email': string;
    'owner-url': string;
    bounds: {
        min: {
            lat: number;
            lon: number;
        };
        max: {
            lat: number;
            lon: number;
        };
    };
}

interface GtssLibraryDocument {
    gtssLibrary: GtssLibraryEntry[];
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
    const builtInEntries = (builtInLibrary as GtssLibraryDocument).gtssLibrary;
    return [...builtInEntries, ...custom];
}

// Builds a minimal entry for a manually pasted GTSS URL.
export function createEntryFromUrl(gtssUrl: string): GtssLibraryEntry {
    const now = new Date().toISOString();
    return {
        title: gtssUrl,
        'gtss-url': gtssUrl,
        official: false,
        'date-added': now,
        'owner-email': '',
        'owner-url': '',
        bounds: {
            min: { lat: 0, lon: 0 },
            max: { lat: 0, lon: 0 },
        },
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

// Case-insensitive file lookup inside a JSZip archive.
function findZipFile(zip: JSZip, name: string) {
    const lower = name.toLowerCase();
    for (const filename of Object.keys(zip.files)) {
        const entry = filename.toLowerCase();
        if (entry === lower || entry.endsWith('/' + lower)) {
            return zip.file(filename);
        }
    }
    return null;
}

// Parses a GTSS zip archive (binary ArrayBuffer, Uint8Array, or base64 string) into GtssFeed objects.
export async function parseGtssZip(zipData: ArrayBuffer | Uint8Array | string): Promise<GtssFeed[]> {
    const isBase64 = typeof zipData === 'string';
    const zip = await JSZip.loadAsync(zipData, isBase64 ? { base64: true } : undefined);

    const agencyFile = findZipFile(zip, 'agency.txt');
    const signalsFile = findZipFile(zip, 'signals.txt');
    const approachesFile = findZipFile(zip, 'approaches.txt');
    const phasesFile = findZipFile(zip, 'phases.txt');
    const detectorsFile = findZipFile(zip, 'detectors.txt');
    const timingsFile = findZipFile(zip, 'basic_timings.txt');

    const [agencyText, signalsText, approachesText, phasesText, detectorsText, timingsText] =
        await Promise.all([
            agencyFile ? agencyFile.async('text') : '',
            signalsFile ? signalsFile.async('text') : '',
            approachesFile ? approachesFile.async('text') : '',
            phasesFile ? phasesFile.async('text') : '',
            detectorsFile ? detectorsFile.async('text') : '',
            timingsFile ? timingsFile.async('text') : '',
        ]);

    const agencies = parseAgenciesCsv(agencyText);
    const signals = parseSignalsCsv(signalsText);
    const approaches = parseApproachesCsv(approachesText);
    const phases = parsePhasesCsv(phasesText);
    const detectors = parseDetectorsCsv(detectorsText);
    const basicTimings = parseBasicTimingsCsv(timingsText);

    const agenciesById = new Map<string, Agency>();
    for (const agency of agencies) {
        agenciesById.set(agency.agencyId, agency);
    }

    const feeds: GtssFeed[] = [];

    for (const signal of signals) {
        const signalId = signal.signalId;
        const matchingAgency = agenciesById.get(signal.agencyId) || {
            agencyId: signal.agencyId || 'DEFAULT',
            agencyName: signal.agencyId || 'Default Agency',
            agencyUrl: null,
            agencyTimezone: 'UTC',
            agencyLanguage: null,
            agencyEmail: null,
            latitude: signal.latitude,
            longitude: signal.longitude,
        };

        const signalApproaches = approaches.filter((a) => a.signalId === signalId);
        const signalPhases = phases.filter((p) => p.signalId === signalId);
        const signalDetectors = detectors.filter((d) => d.signalId === signalId);
        const signalTimings = basicTimings.filter((t) => t.signalId === signalId);

        // Derive intersection street names from approach streets if not explicitly provided in signals.txt.
        const distinctStreets = [
            ...new Set(
                signalApproaches
                    .map((a) => a.streetName.trim())
                    .filter(Boolean)
            ),
        ];
        const streetName1 = signal.streetName1 || distinctStreets[0] || '';
        const streetName2 = signal.streetName2 || distinctStreets[1] || '';

        const feed: GtssFeed = {
            signalId,
            agency: matchingAgency,
            signal: {
                ...signal,
                streetName1,
                streetName2,
            },
            approaches: signalApproaches,
            phases: signalPhases,
            detectors: signalDetectors,
            basicTimings: signalTimings,
        };

        feeds.push(feed);
    }

    return feeds;
}

// Retrieves the zip archive data for a given URL or bundled path.
export async function fetchGtssZip(url: string): Promise<ArrayBuffer | string> {
    const filename = url.split('/').pop() || '';
    if (BUNDLED_GTSS_ZIPS[url]) {
        return BUNDLED_GTSS_ZIPS[url];
    }
    if (BUNDLED_GTSS_ZIPS[filename]) {
        return BUNDLED_GTSS_ZIPS[filename];
    }

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to download GTSS file (${response.status}): ${response.statusText}`);
    }
    return response.arrayBuffer();
}

// Loads, parses, and persists all feeds for the given GTSS URLs, updating storage and agency catalogs.
export async function importLibraryFeeds(urls: string[]): Promise<{ feeds: GtssFeed[]; bounds: MapBounds | null }> {
    const loadedFeeds: GtssFeed[] = [];
    const newAgencies: Agency[] = [];

    for (const url of urls) {
        try {
            const data = await fetchGtssZip(url);
            const feeds = await parseGtssZip(data);
            for (const feed of feeds) {
                await saveFeed(feed);
                loadedFeeds.push(feed);
                if (feed.agency?.agencyId) {
                    newAgencies.push(feed.agency);
                }
            }
        } catch (err) {
            console.error(`Failed to import GTSS feed from ${url}:`, err);
            throw err;
        }
    }

    // Persist any newly imported agencies into the agency store.
    if (newAgencies.length > 0) {
        const existingAgencies = await listAgencies();
        const agencyMap = new Map<string, Agency>(existingAgencies.map((a) => [a.agencyId, a]));
        for (const agency of newAgencies) {
            agencyMap.set(agency.agencyId, agency);
        }
        await saveAgencies([...agencyMap.values()]);
    }

    // Compute bounding box covering all loaded signals.
    let south = Infinity;
    let north = -Infinity;
    let west = Infinity;
    let east = -Infinity;
    let validCount = 0;

    for (const feed of loadedFeeds) {
        const lat = feed.signal?.latitude;
        const lon = feed.signal?.longitude;
        if (typeof lat === 'number' && Number.isFinite(lat) && typeof lon === 'number' && Number.isFinite(lon)) {
            south = Math.min(south, lat);
            north = Math.max(north, lat);
            west = Math.min(west, lon);
            east = Math.max(east, lon);
            validCount++;
        }
    }

    const bounds: MapBounds | null = validCount > 0 ? { south, north, west, east } : null;
    return { feeds: loadedFeeds, bounds };
}

// Computes the combined bounding box enclosing all given GTSS library entries.
export function getBoundsForEntries(entries: GtssLibraryEntry[]): MapBounds | null {
    let south = Infinity;
    let north = -Infinity;
    let west = Infinity;
    let east = -Infinity;
    let hasValidBounds = false;

    for (const entry of entries) {
        const b =
            entry.bounds ||
            (entry as unknown as { bound?: { min: { lat: number; lon: number }; max: { lat: number; lon: number } } })
                .bound;
        if (!b?.min || !b?.max) continue;
        const minLat = Number(b.min.lat);
        const minLon = Number(b.min.lon);
        const maxLat = Number(b.max.lat);
        const maxLon = Number(b.max.lon);

        if (
            !Number.isFinite(minLat) ||
            !Number.isFinite(minLon) ||
            !Number.isFinite(maxLat) ||
            !Number.isFinite(maxLon)
        ) {
            continue;
        }
        if (minLat === 0 && minLon === 0 && maxLat === 0 && maxLon === 0) {
            continue;
        }

        south = Math.min(south, minLat, maxLat);
        north = Math.max(north, minLat, maxLat);
        west = Math.min(west, minLon, maxLon);
        east = Math.max(east, minLon, maxLon);
        hasValidBounds = true;
    }

    if (!hasValidBounds) return null;
    return { south, north, west, east };
}

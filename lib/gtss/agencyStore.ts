import AsyncStorage from '@react-native-async-storage/async-storage';

import { DEFAULT_AGENCY } from './defaults';
import type { Agency } from './types';

const AGENCIES_KEY = 'gtss-agencies';
const DEFAULT_AGENCY_ID_KEY = 'gtss-default-agency-id';

// Returns the configured agencies, seeding a single default agency the first time this runs.
export async function listAgencies(): Promise<Agency[]> {
    const raw = await AsyncStorage.getItem(AGENCIES_KEY);
    if (!raw) {
        await AsyncStorage.setItem(AGENCIES_KEY, JSON.stringify([DEFAULT_AGENCY]));
        await AsyncStorage.setItem(DEFAULT_AGENCY_ID_KEY, DEFAULT_AGENCY.agencyId);
        return [DEFAULT_AGENCY];
    }
    const agencies = JSON.parse(raw) as Agency[];
    return agencies.length > 0 ? agencies : [DEFAULT_AGENCY];
}

export async function saveAgencies(agencies: Agency[]): Promise<void> {
    await AsyncStorage.setItem(AGENCIES_KEY, JSON.stringify(agencies));
}

export async function getDefaultAgencyId(): Promise<string | null> {
    return AsyncStorage.getItem(DEFAULT_AGENCY_ID_KEY);
}

export async function setDefaultAgencyId(agencyId: string): Promise<void> {
    await AsyncStorage.setItem(DEFAULT_AGENCY_ID_KEY, agencyId);
}

// Resolves the agency that new signals should be assigned to.
export async function getDefaultAgency(): Promise<Agency> {
    const agencies = await listAgencies();
    const defaultId = await getDefaultAgencyId();
    return agencies.find((a) => a.agencyId === defaultId) ?? agencies[0] ?? DEFAULT_AGENCY;
}

import type { Agency } from './types';

export const DEFAULT_AGENCY_ID = '1';

export const DEFAULT_AGENCY: Agency = {
    agencyId: DEFAULT_AGENCY_ID,
    agencyName: 'My Agency',
    agencyUrl: 'https://example.com',
    agencyTimezone: 'America/New_York',
    agencyLanguage: 'en',
    agencyEmail: 'contact@example.com',
    latitude: null,
    longitude: null,
};

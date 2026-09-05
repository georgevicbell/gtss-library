import type { Agency } from './types';

export const DEFAULT_AGENCY_ID = '1';

export const DEFAULT_AGENCY: Agency = {
  agency_id: DEFAULT_AGENCY_ID,
  agency_name: 'My Agency',
  agency_url: 'https://example.com',
  agency_timezone: 'America/New_York',
  agency_email: 'contact@example.com',
};

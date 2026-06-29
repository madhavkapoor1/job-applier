/**
 * One interpretation of config.search.locations for every source.
 * Entries are classified as remote markers, country-wide markers, or cities,
 * so sources stop reading different meanings into the same list (e.g. Adzuna
 * narrowing a UK-wide search to locations[0] = "London").
 */

const REMOTE_RE = /\b(remote|anywhere|work from home|wfh|hybrid)\b/i;
const COUNTRY_RE =
  /\b(united kingdom|uk|great britain|england|scotland|wales|northern ireland|united states|usa|europe)\b/i;

export interface LocationModel {
  /** City-level entries, in config order (e.g. ["London"]). */
  cities: string[];
  /** True when any entry names a whole country/region — sources should not narrow to a city. */
  countryWide: boolean;
  /** True when remote work is acceptable. */
  remote: boolean;
}

export function parseLocations(locations: string[]): LocationModel {
  const cities: string[] = [];
  let countryWide = false;
  let remote = false;
  for (const raw of locations) {
    const loc = raw.trim();
    if (!loc) continue;
    if (REMOTE_RE.test(loc)) remote = true;
    else if (COUNTRY_RE.test(loc)) countryWide = true;
    else cities.push(loc);
  }
  // No locations configured at all = search everywhere.
  if (!locations.length) countryWide = true;
  return { cities, countryWide, remote };
}

/**
 * The city to narrow a keyed-API query to, or "" when the search should stay
 * country-wide (a country entry is present, or no cities were given).
 */
export function narrowCity(locations: string[]): string {
  const { cities, countryWide } = parseLocations(locations);
  return countryWide ? "" : (cities[0] ?? "");
}

/**
 * Region registry — the single place that maps a user-facing country/region
 * choice onto the concrete knobs each source needs:
 *   - `adzunaCountry`  → Adzuna's per-country API path (undefined = no Adzuna coverage)
 *   - `googleLocation` → SerpAPI / Google Jobs `location` string (undefined = worldwide)
 *   - `matchTerms`     → strings used to recognise this region in a job's location text
 *
 * `search.regions` holds the selected ids (e.g. ["uk", "global"]). Sources read
 * the derived knobs from here instead of each inventing its own country handling,
 * mirroring how locations.ts centralises city/remote interpretation.
 */

export interface RegionDef {
  id: string;
  label: string;
  /** Adzuna country code, when Adzuna covers it (e.g. "gb", "ca", "in"). */
  adzunaCountry?: string;
  /** Location string for Google Jobs via SerpAPI ("" / undefined = worldwide). */
  googleLocation?: string;
  /** Lowercase substrings that mark a job's `location` as belonging to this region. */
  matchTerms: string[];
}

export const REGIONS: RegionDef[] = [
  {
    id: "uk",
    label: "United Kingdom",
    adzunaCountry: "gb",
    googleLocation: "United Kingdom",
    matchTerms: [
      "united kingdom", "uk", "u.k.", "great britain", "britain", "england",
      "scotland", "wales", "northern ireland", "london", "manchester",
      "birmingham", "leeds", "bristol", "edinburgh", "glasgow", "cambridge",
    ],
  },
  {
    id: "canada",
    label: "Canada",
    adzunaCountry: "ca",
    googleLocation: "Canada",
    matchTerms: [
      "canada", "canadian", "toronto", "vancouver", "montreal", "montréal",
      "ottawa", "calgary", "edmonton", "ontario", "quebec", "québec",
      "alberta", "british columbia", " bc", "waterloo",
    ],
  },
  {
    id: "india",
    label: "India",
    adzunaCountry: "in",
    googleLocation: "India",
    matchTerms: [
      "india", "bengaluru", "bangalore", "mumbai", "new delhi", "delhi",
      "hyderabad", "pune", "chennai", "kolkata", "gurgaon", "gurugram",
      "noida", "ncr", "ahmedabad",
    ],
  },
  {
    id: "dubai",
    label: "Dubai / UAE",
    // Adzuna has no UAE endpoint — Google Jobs (SerpAPI) is the workhorse here.
    googleLocation: "Dubai, United Arab Emirates",
    matchTerms: [
      "dubai", "united arab emirates", "uae", "u.a.e", "abu dhabi",
      "sharjah", "emirates",
    ],
  },
  {
    id: "us",
    label: "United States",
    adzunaCountry: "us",
    googleLocation: "United States",
    matchTerms: [
      "united states", "usa", "u.s.", "u.s.a", "new york", "san francisco",
      "california", "texas", "seattle", "boston", "austin", "chicago",
      "remote, us", "remote (us)", "remote - us",
    ],
  },
  {
    id: "global",
    label: "Global / Remote",
    // No location filter — let worldwide + remote postings through.
    googleLocation: undefined,
    matchTerms: ["remote", "anywhere", "worldwide", "global", "distributed"],
  },
];

const BY_ID = new Map(REGIONS.map((r) => [r.id, r]));

/** Resolve selected ids to region defs, ignoring unknown ids. */
export function getRegions(ids: string[] | undefined): RegionDef[] {
  return (ids ?? []).map((id) => BY_ID.get(id)).filter((r): r is RegionDef => !!r);
}

/** Adzuna country codes for the selected regions (deduped, Adzuna-covered only). */
export function adzunaCountries(ids: string[] | undefined): string[] {
  return [...new Set(getRegions(ids).map((r) => r.adzunaCountry).filter((c): c is string => !!c))];
}

/**
 * Google Jobs location strings for the selected regions. A selected "global"
 * region contributes a worldwide query, represented as `undefined`.
 */
export function googleLocations(ids: string[] | undefined): (string | undefined)[] {
  const regions = getRegions(ids);
  if (!regions.length) return [undefined];
  const out: (string | undefined)[] = [];
  const seen = new Set<string>();
  for (const r of regions) {
    const key = r.googleLocation ?? "\0worldwide";
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r.googleLocation);
  }
  return out;
}

/** True when "global" (remote/anywhere) is among the selected regions. */
export function includesGlobal(ids: string[] | undefined): boolean {
  return getRegions(ids).some((r) => r.id === "global");
}

/**
 * Does a job's location text fall within any selected region? Used for ranking
 * (a soft bonus), never as a hard gate — remote/global roles stay eligible even
 * when their location string is blank.
 */
export function locationInRegions(locationText: string, ids: string[] | undefined): boolean {
  const regions = getRegions(ids);
  if (!regions.length) return false;
  const loc = locationText.toLowerCase();
  if (!loc) return false;
  return regions.some((r) => r.matchTerms.some((t) => loc.includes(t)));
}

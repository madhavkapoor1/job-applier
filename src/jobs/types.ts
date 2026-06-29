// Core domain types for the job-applier scripts.
// Kept dependency-free so every module (sources, store, materials) can import it.

/** A single salary range as advertised by a source. */
export interface Salary {
  min?: number;
  max?: number;
  currency?: string;
  period?: "year" | "month" | "hour" | "day";
}

/** A normalized job posting. Every source maps its raw payload into this shape. */
export interface Job {
  /** Stable hash id derived from company + title + location (see normalize.ts). */
  id: string;
  source: string; // e.g. "greenhouse", "lever", "remotive"
  sourceId?: string; // the id assigned by the upstream source, if any
  title: string;
  company: string;
  location: string;
  remote: boolean;
  url: string; // canonical apply / listing url
  description: string; // plain text, html stripped
  department?: string;
  employmentType?: string; // full-time, contract, etc.
  salary?: Salary;
  /** ISO date the job was posted, if the source provides it. */
  postedAt?: string;
  /** ISO timestamp this job was first discovered by us. */
  discoveredAt: string;
  /** 0..100 fit score assigned by rank.ts. */
  score: number;
  /** Skills/keywords from the profile that matched this posting. */
  matchedKeywords: string[];
  /** Arbitrary extra fields a source wants to keep around. */
  raw?: Record<string, unknown>;
}

export type ApplicationStatus =
  | "queued" // materials generated, awaiting your review
  | "applied" // you submitted it
  | "skipped" // you decided to pass
  | "error"; // materials generation failed

/** Tracks an application generated for a job. */
export interface Application {
  jobId: string;
  status: ApplicationStatus;
  createdAt: string;
  updatedAt: string;
  /** Paths to generated materials, relative to the data dir. */
  resumePath?: string;
  coverLetterPath?: string;
  /** Free-text note (why skipped, follow-up date, etc.). */
  note?: string;
}

/** One experience entry used to fill templates. */
export interface ExperienceEntry {
  title: string;
  company: string;
  start: string;
  end: string; // "Present" allowed
  bullets: string[];
}

export interface EducationEntry {
  degree: string;
  school: string;
  year: string;
}

/** Everything about the applicant, used for materials + ranking. */
export interface Profile {
  name: string;
  email: string;
  phone?: string;
  location?: string;
  links?: Record<string, string>; // { linkedin, github, portfolio }
  summary: string;
  /** Skills double as ranking keywords and resume content. */
  skills: string[];
  experience: ExperienceEntry[];
  education: EducationEntry[];
}

/** What kinds of roles to look for. */
export interface SearchConfig {
  /** Keywords OR'd together when querying keyword-based sources. */
  keywords: string[];
  /**
   * Region/country ids from regions.ts (e.g. ["uk", "global"]). Drives which
   * countries the keyed aggregators target and boosts in-region jobs when
   * ranking. Empty = no region scoping (worldwide). See src/jobs/regions.ts.
   */
  regions?: string[];
  /** Free-text city filters (optional, narrows within a region); empty = anywhere. */
  locations: string[];
  /** If true, drop non-remote postings. */
  remoteOnly: boolean;
  /** Drop jobs scoring below this (0..100). */
  minScore: number;
  /** Negative keywords: if any appears in the title, drop the job. */
  excludeTitleKeywords?: string[];
}

/** Per-source configuration. Keys are read from env; see .env.example. */
export interface SourcesConfig {
  reed?: { enabled: boolean };
  /** category is a Muse category name, e.g. "Legal Services" (the default). */
  themuse?: { enabled: boolean; category?: string };
  greenhouse?: { companies: string[] };
  lever?: { companies: string[] };
  ashby?: { companies: string[] };
  workable?: { companies: string[] };
  remotive?: { enabled: boolean };
  /** Keyless remote-jobs boards — default on (enabled unless explicitly false). */
  remoteok?: { enabled: boolean };
  arbeitnow?: { enabled: boolean };
  jobicy?: { enabled: boolean };
  himalayas?: { enabled: boolean };
  hackernews?: { enabled: boolean; monthsBack?: number };
  adzuna?: { enabled: boolean; country?: string };
  usajobs?: { enabled: boolean };
  serpapi?: { enabled: boolean; location?: string };
}

export interface AppConfig {
  profile: Profile;
  search: SearchConfig;
  sources: SourcesConfig;
}

/** The contract every source module implements. */
export interface JobSource {
  name: string;
  /** Returns false (with a logged reason) when the source can't run, e.g. missing key. */
  isEnabled(config: AppConfig): boolean;
  /** Fetch raw postings and map them to partial jobs (id/score filled in later). */
  fetch(config: AppConfig): Promise<RawJob[]>;
}

/** A job as returned by a source, before normalization assigns id/score. */
export type RawJob = Omit<
  Job,
  "id" | "discoveredAt" | "score" | "matchedKeywords" | "remote"
> & {
  /** Sources may leave remote undefined; normalize.ts infers it. */
  remote?: boolean;
};

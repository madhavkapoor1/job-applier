import type { JobSource } from "../types.ts";
import { greenhouse } from "./greenhouse.ts";
import { lever } from "./lever.ts";
import { ashby } from "./ashby.ts";
import { workable } from "./workable.ts";
import { remotive } from "./remotive.ts";
import { remoteok } from "./remoteok.ts";
import { arbeitnow } from "./arbeitnow.ts";
import { jobicy } from "./jobicy.ts";
import { himalayas } from "./himalayas.ts";
import { hackernews } from "./hackernews.ts";
import { adzuna } from "./adzuna.ts";
import { usajobs } from "./usajobs.ts";
import { serpapi } from "./serpapi.ts";
import { reed } from "./reed.ts";
import { themuse } from "./themuse.ts";

/** Every available source. Add new sources here and they're picked up everywhere. */
export const ALL_SOURCES: JobSource[] = [
  reed,
  adzuna,
  themuse,
  serpapi,
  greenhouse,
  lever,
  ashby,
  workable,
  remotive,
  remoteok,
  arbeitnow,
  jobicy,
  himalayas,
  hackernews,
  usajobs,
];

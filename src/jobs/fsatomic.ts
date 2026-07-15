import { mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

/**
 * Crash-safe file write: write a temp sibling, then rename it over the target.
 * A crash or power cut mid-write leaves the previous file intact instead of a
 * truncated one — which matters because db.json holds the entire application
 * history and config.json holds the profile, with no other copy anywhere.
 */
export function writeFileAtomic(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, content);
  try {
    renameSync(tmp, path); // atomic on the same volume; replaces on Windows too
  } catch {
    // Windows can transiently refuse the rename (antivirus/indexer holding the
    // target). Fall back to an in-place write rather than losing the data.
    writeFileSync(path, content);
    try {
      rmSync(tmp, { force: true });
    } catch {
      /* leftover tmp is harmless */
    }
  }
}

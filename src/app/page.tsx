import { getDashboardState } from "../jobs/dashboard.ts";
import Dashboard from "./Dashboard";

// Reads config + saved data from disk on every request, so the UI always
// reflects the latest profile and discovered jobs.
export const dynamic = "force-dynamic";

export default function Home() {
  const initial = getDashboardState();
  return <Dashboard initial={initial} />;
}

import type { NextConfig } from "next";
import path from "node:path";

/**
 * ROOT CAUSE FIX — Turbopack (Next.js 16) deadlocks at 0% CPU, never binding to
 * the port, when its workspace *root* path contains a space. This project lives
 * under ".../Website Freelancing Dashboard/app", so `turbopack.root = __dirname`
 * (the old value) hung `next dev` / `next build` before it printed anything.
 *
 * Leaving `root` unset is not a fix either: Turbopack then infers the root from
 * the nearest lockfile and can pick an unrelated ancestor (e.g. ~/), which makes
 * the first on-demand compile hang while it crawls a huge tree.
 *
 * So we pin `root` to the nearest ancestor directory whose path has NO space.
 * If the project is ever moved to a space-free path, this resolves to __dirname
 * (the normal default). Keep the app source anywhere under that root.
 */
function nearestSpacelessRoot(dir: string): string {
  let current = dir;
  while (current.includes(" ")) {
    const parent = path.dirname(current);
    if (parent === current) break; // reached filesystem root
    current = parent;
  }
  return current;
}

const nextConfig: NextConfig = {
  turbopack: {
    root: nearestSpacelessRoot(__dirname),
  },
};

export default nextConfig;

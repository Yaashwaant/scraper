import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { runClaudeJSON } from "@/lib/claude";
import type { Lead, ScrapeInput } from "@/lib/types";

const GMAPS_SCRAPER_URL = process.env.GMAPS_SCRAPER_URL || "https://google-maps-scraper-62bc.onrender.com";
const APIFY_TOKEN = process.env.APIFY_TOKEN;
const APIFY_ACTOR = process.env.APIFY_ACTOR ?? "compass~crawler-google-places";

export interface ScrapedPlace {
  name: string;
  category: string;
  address: string;
  phone: string;
  website: string;
  rating: number;
  reviewsCount: number;
  lat: number;
  lng: number;
  photosCount: number;
  link: string;
}

/**
 * Scrapes Google Maps data using deployed Render scraper service.
 */
export async function scrapeGoogleMaps(keyword: string): Promise<ScrapedPlace[]> {
  // 1. Submit scrape job
  const createJobRes = await fetch(`${GMAPS_SCRAPER_URL}/api/v1/jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: `Search: ${keyword}`,
      job_data: {
        keywords: [keyword],
        depth: 1,
        language: "en",
      },
    }),
  });

  if (!createJobRes.ok) {
    throw new Error(`Failed to initiate scrape job: ${createJobRes.statusText}`);
  }

  const { id: jobId } = await createJobRes.json();

  // 2. Poll job status until completed
  let isCompleted = false;
  let attempts = 0;
  const maxAttempts = 40; // Max ~2 minutes wait time (40 attempts * 3s = 120s)

  while (!isCompleted && attempts < maxAttempts) {
    await new Promise((resolve) => setTimeout(resolve, 3000)); // wait 3s
    attempts++;
    const statusRes = await fetch(`${GMAPS_SCRAPER_URL}/api/v1/jobs/${jobId}`);
    if (!statusRes.ok) continue;
    const job = await statusRes.json();

    if (job.status === "completed") {
      isCompleted = true;
    } else if (job.status === "failed") {
      throw new Error(`Scrape job ${jobId} failed on server.`);
    }
  }

  if (!isCompleted) {
    throw new Error("Scrape job timed out.");
  }

  // 3. Fetch standardized JSON results
  const resultsRes = await fetch(`${GMAPS_SCRAPER_URL}/api/v1/jobs/${jobId}/results`);
  if (!resultsRes.ok) {
    throw new Error("Failed to retrieve scraped results");
  }

  const places: ScrapedPlace[] = await resultsRes.json();
  return places;
}

async function loadSeed(): Promise<{ leads: Lead[] }> {
  const p = path.join(process.cwd(), "data", "leads-seed.json");
  const raw = await fs.readFile(p, "utf-8");
  const json = JSON.parse(raw);
  return { leads: json.leads as Lead[] };
}

async function generateMockLeads(niche: string, city: string, count: number): Promise<Lead[] | null> {
  const prompt = `Generate ${count} realistic local business lead objects for the niche "${niche}" in "${city}".
Return ONLY a JSON array of ${count} objects with these exact fields:
- "id": string (e.g. "gen-01", "gen-02", ...)
- "name": string (realistic business name)
- "category": string ("${niche}")
- "address": string (realistic local address in ${city})
- "city": string ("${city}")
- "phone": string (realistic Indian phone number e.g. "+91 98200 12345")
- "whatsapp": string (same as phone)
- "website": optional string (about half should NOT have a website, half should have simple/outdated URLs)
- "rating": number between 3.5 and 4.9 (1 decimal place)
- "reviewsCount": integer between 12 and 240
- "lat": number around 19.0760 (or valid latitude for ${city})
- "lng": number around 72.8777 (or valid longitude for ${city})
- "photosCount": integer between 3 and 45
- "yearsInBusiness": integer between 1 and 15`;

  const res = await runClaudeJSON<Lead[]>(prompt);
  return res.ok && Array.isArray(res.data) ? res.data : null;
}

export async function POST(req: Request) {
  const input = (await req.json()) as ScrapeInput & { keyword?: string };
  const niche = input.niche || "dentist";
  const city = input.city || "Mumbai";
  const count = input.count || 10;
  const keyword = input.keyword || `${niche} in ${city}`;

  // 1. Primary: Try Render Google Maps Scraper Service
  if (GMAPS_SCRAPER_URL) {
    try {
      const places = await scrapeGoogleMaps(keyword);
      const leads: Lead[] = places.slice(0, count).map((p, i) => ({
        id: `live-${String(i + 1).padStart(2, "0")}`,
        name: p.name || "Unknown",
        category: p.category || niche,
        address: p.address || "",
        city: city,
        phone: p.phone || undefined,
        whatsapp: p.phone || undefined,
        email: undefined,
        website: p.website || undefined,
        rating: p.rating,
        reviewsCount: p.reviewsCount,
        lat: p.lat || 19.06,
        lng: p.lng || 72.83,
        photosCount: p.photosCount,
      }));

      if (leads.length > 0) {
        return NextResponse.json({ source: "render-scraper", leads });
      }
    } catch (err) {
      console.warn("Render scraper failed, trying fallbacks:", err);
    }
  }

  // 2. Secondary: Apify fallback
  if (APIFY_TOKEN) {
    try {
      const runRes = await fetch(
        `https://api.apify.com/v2/acts/${APIFY_ACTOR}/run-sync-get-dataset-items?token=${APIFY_TOKEN}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            searchStringsArray: [keyword],
            maxCrawledPlacesPerSearch: count,
            language: "en",
          }),
        },
      );
      if (runRes.ok) {
        const items = (await runRes.json()) as Array<Record<string, unknown>>;
        const leads: Lead[] = items.slice(0, count).map((it, i) => ({
          id: `live-${String(i + 1).padStart(2, "0")}`,
          name: String(it.title ?? it.name ?? "Unknown"),
          category: String(it.categoryName ?? niche),
          address: String(it.address ?? ""),
          city: city,
          phone: it.phone ? String(it.phone) : undefined,
          whatsapp: it.phone ? String(it.phone) : undefined,
          email: undefined,
          website: it.website ? String(it.website) : undefined,
          rating: typeof it.totalScore === "number" ? (it.totalScore as number) : undefined,
          reviewsCount: typeof it.reviewsCount === "number" ? (it.reviewsCount as number) : undefined,
          lat: typeof (it.location as { lat?: number })?.lat === "number" ? (it.location as { lat: number }).lat : 19.06,
          lng: typeof (it.location as { lng?: number })?.lng === "number" ? (it.location as { lng: number }).lng : 72.83,
          photosCount: typeof it.imagesCount === "number" ? (it.imagesCount as number) : undefined,
        }));
        return NextResponse.json({ source: "apify", leads });
      }
    } catch (e) {
      console.warn("Apify fallback failed:", e);
    }
  }

  // 3. Tertiary: OpenRouter mock leads generation or static seed data fallback
  const generated = await generateMockLeads(niche, city, count);
  if (generated && generated.length > 0) {
    return NextResponse.json({ source: "openrouter-generated", leads: generated });
  }
  const { leads } = await loadSeed();
  const sliced = leads.slice(0, Math.max(1, Math.min(count, leads.length)));
  return NextResponse.json({ source: "seed", leads: sliced });
}

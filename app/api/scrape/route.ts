import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { runClaudeJSON } from "@/lib/claude";
import type { Lead, ScrapeInput } from "@/lib/types";

const APIFY_TOKEN = process.env.APIFY_TOKEN;
const APIFY_ACTOR = process.env.APIFY_ACTOR ?? "compass~crawler-google-places";

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
  const input = (await req.json()) as ScrapeInput;

  // If no Apify token, use OpenRouter to generate matching leads dynamically
  if (!APIFY_TOKEN) {
    const generated = await generateMockLeads(input.niche, input.city, input.count);
    if (generated && generated.length > 0) {
      return NextResponse.json({ source: "openrouter-generated", leads: generated });
    }
    const { leads } = await loadSeed();
    const sliced = leads.slice(0, Math.max(1, Math.min(input.count, leads.length)));
    return NextResponse.json({ source: "seed", leads: sliced });
  }

  try {
    const runRes = await fetch(
      `https://api.apify.com/v2/acts/${APIFY_ACTOR}/run-sync-get-dataset-items?token=${APIFY_TOKEN}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          searchStringsArray: [`${input.niche} in ${input.city}`],
          maxCrawledPlacesPerSearch: input.count,
          language: "en",
        }),
      },
    );
    if (!runRes.ok) throw new Error(`Apify ${runRes.status}`);
    const items = (await runRes.json()) as Array<Record<string, unknown>>;

    const leads: Lead[] = items.slice(0, input.count).map((it, i) => ({
      id: `live-${String(i + 1).padStart(2, "0")}`,
      name: String(it.title ?? it.name ?? "Unknown"),
      category: String(it.categoryName ?? input.niche),
      address: String(it.address ?? ""),
      city: input.city,
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
  } catch (e) {
    const generated = await generateMockLeads(input.niche, input.city, input.count);
    if (generated && generated.length > 0) {
      return NextResponse.json({ source: "openrouter-generated-fallback", leads: generated });
    }
    const { leads } = await loadSeed();
    return NextResponse.json({ source: "seed-fallback", error: (e as Error).message, leads: leads.slice(0, input.count) });
  }
}

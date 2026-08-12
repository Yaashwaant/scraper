import { NextResponse } from "next/server";
import { runClaudeJSON } from "@/lib/claude";
import type { Lead, AuditResult } from "@/lib/types";

export const maxDuration = 300;

function buildPrompt(leads: Lead[]): string {
  const slim = leads.map((l) => ({
    id: l.id,
    name: l.name,
    category: l.category,
    city: l.city,
    rating: l.rating,
    reviewsCount: l.reviewsCount,
    website: l.website || null,
    hasPhone: !!l.phone,
    hasWhatsapp: !!l.whatsapp,
    yearsInBusiness: l.yearsInBusiness ?? null,
  }));
  return `You are a web-conversion analyst for Indian local businesses. Audit each business below for its online-presence gaps and the revenue it is leaving on the table by not having a strong website.

For EACH business return one JSON object with these exact fields:
- "leadId": string (copy the id)
- "hasWebsite": boolean (true only if a website URL is present)
- "pageSpeedScore": integer 0-100. If no website, use 0. If the site is a free builder (weebly/wix free/business.site/wordpress.com), estimate 25-45. Otherwise estimate 50-75.
- "mobileFriendly": boolean (false if no site or free builder)
- "https": boolean (false if no site)
- "hasSchema": boolean (almost always false for small local businesses)
- "loadTimeMs": integer. 0 if no site, else estimate 2500-9000.
- "gaps": array of 3-5 short specific gap labels, e.g. "No online booking", "6.8s mobile load", "No WhatsApp click-to-chat", "No before/after gallery". Tailor to the category.
- "biggestGap": ONE specific sentence naming the single biggest thing costing them customers, referencing their actual numbers (reviews, rating, city). Be concrete, not generic.
- "estLostRevenuePerMonth": integer in INR. Base it on reviewsCount*400, add 30000 if no website, and never go below 20000. Reflect the business category's ticket size.

Rules:
- Output ONLY a JSON array of these objects, one per business, in the same order. No prose, no markdown fences.
- Be specific to each business using its real data. Vary the language; do not repeat the same biggestGap wording.

Businesses:
${JSON.stringify(slim, null, 2)}`;
}

export async function POST(req: Request) {
  const { leads } = (await req.json()) as { leads: Lead[] };
  if (!Array.isArray(leads) || leads.length === 0) {
    return NextResponse.json({ error: "No leads provided." }, { status: 400 });
  }

  const result = await runClaudeJSON<Array<Partial<AuditResult>>>(buildPrompt(leads));
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, notInstalled: result.notInstalled ?? false },
      { status: result.notInstalled ? 503 : 502 },
    );
  }

  // Normalize into a lead-id keyed map, guarding against missing fields.
  const byId = new Map<string, Partial<AuditResult>>();
  for (const a of result.data) if (a && a.leadId) byId.set(a.leadId, a);

  const audits: Record<string, AuditResult> = {};
  for (const lead of leads) {
    const a = byId.get(lead.id) ?? {};
    const hasWebsite = a.hasWebsite ?? !!lead.website;
    audits[lead.id] = {
      leadId: lead.id,
      pageSpeedScore: Number(a.pageSpeedScore ?? (hasWebsite ? 55 : 0)),
      hasWebsite,
      mobileFriendly: a.mobileFriendly ?? false,
      https: a.https ?? (hasWebsite ? (lead.website ?? "").startsWith("https") : false),
      hasSchema: a.hasSchema ?? false,
      loadTimeMs: Number(a.loadTimeMs ?? 0),
      gaps: Array.isArray(a.gaps) && a.gaps.length ? a.gaps : ["No online booking", "Weak local SEO"],
      biggestGap: a.biggestGap ?? "Limited online presence is costing this business new customers every month.",
      estLostRevenuePerMonth: Math.max(20000, Number(a.estLostRevenuePerMonth ?? 20000)),
    };
  }

  return NextResponse.json({ source: "claude", audits });
}

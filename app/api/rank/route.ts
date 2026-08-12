import { NextResponse } from "next/server";
import { runClaudeJSON } from "@/lib/claude";
import type { Lead, AuditResult, RankedLead } from "@/lib/types";

export const maxDuration = 300;

function buildPrompt(leads: Lead[], audits: Record<string, AuditResult>): string {
  const rows = leads
    .filter((l) => audits[l.id])
    .map((l) => ({
      id: l.id,
      name: l.name,
      category: l.category,
      rating: l.rating,
      reviewsCount: l.reviewsCount,
      hasWebsite: audits[l.id].hasWebsite,
      pageSpeedScore: audits[l.id].pageSpeedScore,
      reachable: [l.phone && "phone", l.whatsapp && "whatsapp", l.email && "email"].filter(Boolean),
      estLostRevenuePerMonth: audits[l.id].estLostRevenuePerMonth,
      biggestGap: audits[l.id].biggestGap,
    }));

  return `You are a sales strategist ranking local-business leads by how likely they are to BUY a website from a freelancer, and how much value a website would create for them.

Score each lead 0-100 for conversion potential. Weigh:
- No website or a slow/free-builder site (biggest opportunity) — highest weight
- Review volume + rating (an active business with money and demand)
- Reachability (phone + WhatsApp + email = easy to contact and close)
- Category fit (service businesses like dentist/salon/clinic/spa/gym/restaurant/lawyer benefit most from a site)
- Revenue left on the table

For EACH lead return a JSON object:
- "leadId": string
- "score": integer 0-100
- "scoreReasoning": ONE short sentence (max 18 words) explaining why it ranks where it does, referencing its real data.

Output ONLY a JSON array, sorted by score DESCENDING (best first). No prose, no markdown fences.

Leads:
${JSON.stringify(rows, null, 2)}`;
}

export async function POST(req: Request) {
  const { leads, audits } = (await req.json()) as {
    leads: Lead[];
    audits: Record<string, AuditResult>;
  };
  const auditable = leads.filter((l) => audits?.[l.id]);
  if (auditable.length === 0) {
    return NextResponse.json({ error: "No audited leads to rank." }, { status: 400 });
  }

  const result = await runClaudeJSON<Array<{ leadId: string; score: number; scoreReasoning: string }>>(
    buildPrompt(leads, audits),
  );
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, notInstalled: result.notInstalled ?? false },
      { status: result.notInstalled ? 503 : 502 },
    );
  }

  const scoreById = new Map(result.data.filter((r) => r?.leadId).map((r) => [r.leadId, r]));

  const ranked: RankedLead[] = auditable
    .map((lead) => {
      const r = scoreById.get(lead.id);
      return {
        ...lead,
        audit: audits[lead.id],
        score: Math.max(0, Math.min(100, Number(r?.score ?? 50))),
        scoreReasoning: r?.scoreReasoning ?? "",
      };
    })
    .sort((a, b) => b.score - a.score);

  return NextResponse.json({ source: "claude", ranked });
}

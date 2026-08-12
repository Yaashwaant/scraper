import { NextResponse } from "next/server";
import { runClaudeJSON } from "@/lib/claude";
import type { RankedLead, BuildPromptResult } from "@/lib/types";

export const maxDuration = 300;

const PLATFORM_OUTPUT: Record<string, string> = {
  lovable: "Single-page React + Tailwind. No backend. Use placeholder images from unsplash.com.",
  bolt: "Single-page React + Tailwind. No backend. Use placeholder images from unsplash.com.",
  "claude-code": "Next.js 16 app router + Tailwind + shadcn. Single landing page route.",
  codex: "Static index.html + Tailwind CDN, fully self-contained.",
};

function buildPrompt(lead: RankedLead, platform: string): string {
  const platformNote = PLATFORM_OUTPUT[platform] ?? PLATFORM_OUTPUT.lovable;
  return `You are a senior conversion copywriter + web designer. Write a COMPLETE, ready-to-paste website-builder prompt that a freelancer will paste into ${platform} to generate a high-converting site for this Indian local business.

Business:
- Name: ${lead.name}
- Category: ${lead.category}
- Location: ${lead.address}, ${lead.city}
- Google rating: ${lead.rating ?? "n/a"} (${lead.reviewsCount ?? 0} reviews)
- Phone: ${lead.phone ?? "n/a"} | WhatsApp: ${lead.whatsapp ?? lead.phone ?? "n/a"}
- Years in business: ${lead.yearsInBusiness ?? "n/a"}
- Biggest gap today: ${lead.audit.biggestGap}

The generated prompt MUST bake in: mobile-first (India = 90% mobile), floating WhatsApp button, click-to-call header, a trust strip (rating + reviews + years), category-appropriate services, an about/credentials section, reviews, an FAQ, a Google Maps + hours section, LocalBusiness JSON-LD schema, and a Lighthouse-90+ mobile target. Warm, trustworthy, lightly Hinglish tone allowed for trust lines.

Return ONLY this JSON (no markdown fences):
{
  "prompt": "the full builder prompt as a single string, with clear sections and the business's real details filled in. End it with: OUTPUT: ${platformNote}",
  "pitchPoints": ["3 short sentences the freelancer can tell the owner about why this new site beats their current online presence"]
}`;
}

export async function POST(req: Request) {
  const { lead, platform } = (await req.json()) as { lead: RankedLead; platform: string };
  if (!lead) return NextResponse.json({ error: "No lead provided." }, { status: 400 });

  const result = await runClaudeJSON<BuildPromptResult>(buildPrompt(lead, platform || "lovable"));
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, notInstalled: result.notInstalled ?? false },
      { status: result.notInstalled ? 503 : 502 },
    );
  }
  return NextResponse.json({
    source: "claude",
    prompt: result.data.prompt ?? "",
    pitchPoints: Array.isArray(result.data.pitchPoints) ? result.data.pitchPoints : [],
  });
}

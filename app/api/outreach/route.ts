import { NextResponse } from "next/server";
import { runClaudeJSON } from "@/lib/claude";
import type { RankedLead, OutreachChannel, OutreachLanguage, OutreachResult } from "@/lib/types";

export const maxDuration = 300;

const CHANNEL_RULES: Record<OutreachChannel, string> = {
  whatsapp: "WhatsApp DM. Max ~110 words. Warm, human. Emojis OK (👋 🔥 ✓). Short 2-4 line paragraphs. End with a low-friction yes/no ask.",
  email: "Email. Include a Subject line. Max ~150 words. No emoji in subject. Clear CTA.",
  instagram: "Instagram DM. Max ~45 words. Casual, one hook + demo link + soft ask.",
};

function buildPrompt(lead: RankedLead, channel: OutreachChannel, language: OutreachLanguage): string {
  const langRule =
    language === "hinglish"
      ? "Write in natural Hinglish (Roman-script Hindi + English mix, the way Indian small-business owners actually chat). Not pure Hindi, not pure English."
      : "Write in clear, warm English.";
  return `You are a top cold-outreach copywriter helping a freelancer pitch a free website demo to a local business owner. Proven structure: personal hook → specific compliment grounded in their data → one-line pain (their biggest gap) → the free demo link → a low-friction yes/no ask. The day-3 follow-up restates the cost of inaction in ₹ and asks for a 5-min call.

Business:
- Name: ${lead.name}
- Owner: use "${lead.name.includes("Dr.") ? lead.name.split(",")[0] : "Doctor / Sir / Ma'am"}" if no clear owner name
- Category: ${lead.category}
- Rating: ${lead.rating ?? "n/a"} (${lead.reviewsCount ?? 0} reviews), ${lead.city}
- Biggest gap: ${lead.audit.biggestGap}
- Estimated ₹ lost/month: ${lead.audit.estLostRevenuePerMonth}
- Demo link placeholder: https://lead-launch.demo/${lead.id}

Channel: ${channel} — ${CHANNEL_RULES[channel]}
Language: ${langRule}

Return ONLY this JSON (no markdown fences):
{
  "first": "the first-touch message",
  "followUp": "the day-3 follow-up message",
  "bestSendTime": "one short line on the best day/time to send in IST"
}`;
}

export async function POST(req: Request) {
  const { lead, channel, language } = (await req.json()) as {
    lead: RankedLead;
    channel: OutreachChannel;
    language: OutreachLanguage;
  };
  if (!lead) return NextResponse.json({ error: "No lead provided." }, { status: 400 });

  const result = await runClaudeJSON<OutreachResult>(
    buildPrompt(lead, channel || "whatsapp", language || "hinglish"),
  );
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, notInstalled: result.notInstalled ?? false },
      { status: result.notInstalled ? 503 : 502 },
    );
  }
  return NextResponse.json({
    source: "claude",
    first: result.data.first ?? "",
    followUp: result.data.followUp ?? "",
    bestSendTime: result.data.bestSendTime ?? "Tue–Thu, 10am–12pm IST",
  });
}

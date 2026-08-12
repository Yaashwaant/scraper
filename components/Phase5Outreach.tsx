"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PhaseShell } from "./PhaseShell";
import { IncompleteState } from "./IncompleteState";
import { ClaudeThinking, ClaudeRequired } from "./ClaudeStates";
import { MessageCircle, Mail, Camera, Copy, ExternalLink, Clock, Sparkles } from "lucide-react";
import type { RankedLead, OutreachChannel, OutreachLanguage, OutreachResult } from "@/lib/types";
import { callClaude } from "@/lib/claudeClient";
import { toast } from "sonner";

export function Phase5Outreach({
  selected,
  onPrev,
}: {
  selected: RankedLead | null;
  onPrev: () => void;
}) {
  const [channel, setChannel] = useState<OutreachChannel>("whatsapp");
  const [lang, setLang] = useState<OutreachLanguage>("hinglish");
  const [message, setMessage] = useState("");
  const [followUp, setFollowUp] = useState("");
  const [bestSendTime, setBestSendTime] = useState("");
  const [generating, setGenerating] = useState(false);
  const [notInstalled, setNotInstalled] = useState(false);
  const [claudeError, setClaudeError] = useState<string | null>(null);
  const lastFor = useRef<string>("");

  // Clear drafts when lead / channel / language changes (they need a fresh Claude draft).
  useEffect(() => {
    const key = `${selected?.id ?? ""}:${channel}:${lang}`;
    if (key !== lastFor.current) {
      setMessage("");
      setFollowUp("");
      setBestSendTime("");
    }
  }, [selected, channel, lang]);

  async function generate() {
    if (!selected) return;
    setGenerating(true);
    setNotInstalled(false);
    setClaudeError(null);
    const res = await callClaude<OutreachResult>("/api/outreach", {
      lead: selected,
      channel,
      language: lang,
    });
    setGenerating(false);
    if (!res.ok) {
      if (res.notInstalled) setNotInstalled(true);
      else setClaudeError(res.error);
      toast.error(res.notInstalled ? "Claude Code required" : "Draft failed");
      return;
    }
    lastFor.current = `${selected.id}:${channel}:${lang}`;
    setMessage(res.data.first);
    setFollowUp(res.data.followUp);
    setBestSendTime(res.data.bestSendTime);
    toast.success("Claude drafted your outreach");
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  }

  function openChannel() {
    if (!selected) return;
    if (channel === "whatsapp" && selected.whatsapp) {
      const num = selected.whatsapp.replace(/\D/g, "");
      window.open(`https://wa.me/${num}?text=${encodeURIComponent(message)}`, "_blank");
    } else if (channel === "email" && selected.email) {
      const subject = lang === "hinglish" ? "Aapke business ke liye ek website demo banayi hai" : "Built a website demo for your business";
      window.open(`mailto:${selected.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`, "_blank");
    } else if (channel === "instagram") {
      window.open(`https://instagram.com/`, "_blank");
    } else {
      toast.error("No contact for this channel");
    }
  }

  if (!selected) {
    return (
      <PhaseShell
        title="Phase 5 — Outreach"
        subtitle="Claude Code writes a personalized first message + day-3 follow-up, tailored to the lead. Hinglish or English."
        onPrev={onPrev}
      >
        <IncompleteState
          title="No lead selected yet"
          description="Outreach is written per-lead by Claude — using the name, biggest gap, and reachable channels. Run the earlier phases and pick a prospect to draft WhatsApp, email, or Instagram messages here."
          prevPhaseLabel="Rank"
          onPrev={onPrev}
        />
      </PhaseShell>
    );
  }

  const channels: { id: OutreachChannel; label: string; icon: typeof MessageCircle; enabled: boolean }[] = [
    { id: "whatsapp", label: "WhatsApp", icon: MessageCircle, enabled: !!selected.whatsapp },
    { id: "email", label: "Email", icon: Mail, enabled: !!selected.email },
    { id: "instagram", label: "Instagram", icon: Camera, enabled: true },
  ];

  const hasDrafts = !!message || !!followUp;

  return (
    <PhaseShell title="Phase 5 — Outreach" subtitle="Claude Code writes a personalized first touch + day-3 follow-up. Hinglish converts better in India." onPrev={onPrev}>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Sending to</div>
          <div className="font-display text-2xl mt-1">{selected.name}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{selected.phone}{selected.email ? ` · ${selected.email}` : ""}</div>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="lang" className="text-sm text-muted-foreground">English</Label>
          <Switch id="lang" checked={lang === "hinglish"} onCheckedChange={(c) => setLang(c ? "hinglish" : "english")} />
          <Label htmlFor="lang" className="text-sm">Hinglish</Label>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex gap-2">
          {channels.map(({ id, label, icon: Icon, enabled }) => (
            <Button
              key={id}
              variant={channel === id ? "default" : "outline"}
              size="sm"
              disabled={!enabled}
              onClick={() => setChannel(id)}
            >
              <Icon className="h-4 w-4 mr-2" /> {label}
            </Button>
          ))}
        </div>
        <Button onClick={generate} disabled={generating} className="h-10 px-4">
          {generating ? "Claude is writing…" : hasDrafts ? "Regenerate" : "Draft with Claude"}
        </Button>
      </div>

      {generating && <div className="mb-6"><ClaudeThinking label="Claude is writing your outreach…" /></div>}
      {notInstalled && <div className="mb-6"><ClaudeRequired error={claudeError ?? undefined} onRetry={generate} /></div>}
      {claudeError && !notInstalled && (
        <div className="mb-6 rounded-md border border-[color:var(--destructive)]/40 bg-[color:var(--destructive)]/5 p-3 text-sm text-[color:var(--destructive)]" role="alert">
          {claudeError}
        </div>
      )}

      {!hasDrafts && !generating && !notInstalled && (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <div className="h-12 w-12 rounded-full bg-primary/10 mx-auto flex items-center justify-center mb-4">
              <Sparkles className="h-5 w-5 text-primary" strokeWidth={1.5} />
            </div>
            <div className="font-display text-xl mb-1">Pick a channel + language</div>
            <p className="text-sm text-muted-foreground">Then hit &ldquo;Draft with Claude&rdquo; — you&apos;ll get a first message and a day-3 follow-up.</p>
          </CardContent>
        </Card>
      )}

      {hasDrafts && !generating && (
        <>
          <div className="grid lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>First message</CardTitle>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => copy(message)}><Copy className="h-3.5 w-3.5 mr-1.5" /> Copy</Button>
                  <Button size="sm" onClick={openChannel}><ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Send</Button>
                </div>
              </CardHeader>
              <CardContent>
                <Textarea value={message} onChange={(e) => setMessage(e.target.value)} className="font-mono text-sm min-h-[300px]" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Day-3 follow-up</CardTitle>
                <Button size="sm" variant="outline" onClick={() => copy(followUp)}><Copy className="h-3.5 w-3.5 mr-1.5" /> Copy</Button>
              </CardHeader>
              <CardContent>
                <Textarea value={followUp} onChange={(e) => setFollowUp(e.target.value)} className="font-mono text-sm min-h-[300px]" />
              </CardContent>
            </Card>
          </div>

          {bestSendTime && (
            <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" strokeWidth={1.5} /> {bestSendTime}
            </div>
          )}

          <Card className="mt-4 bg-accent/40 border-accent">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-accent flex items-center justify-center text-accent-foreground text-base">✓</div>
                <div>
                  <div className="font-medium tracking-tight">Pipeline complete</div>
                  <div className="text-sm text-muted-foreground">Lead → audit → ranked → site → outreach, all powered by Claude Code. Repeat for the next prospect in Phase 3.</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </PhaseShell>
  );
}

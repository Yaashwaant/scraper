"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PhaseShell } from "./PhaseShell";
import { IncompleteState } from "./IncompleteState";
import { ClaudeThinking, ClaudeRequired } from "./ClaudeStates";
import { Copy, ExternalLink, Sparkles, Check } from "lucide-react";
import type { RankedLead, BuildPromptResult } from "@/lib/types";
import { callClaude } from "@/lib/claudeClient";
import { toast } from "sonner";

const PLATFORMS = [
  { id: "lovable", label: "Lovable", url: "https://lovable.dev" },
  { id: "claude-code", label: "Claude Code", url: "https://claude.com/claude-code" },
  { id: "bolt", label: "Bolt.new", url: "https://bolt.new" },
  { id: "codex", label: "Codex", url: "https://chat.openai.com" },
];

export function Phase4Build({
  selected,
  onNext,
  onPrev,
}: {
  selected: RankedLead | null;
  onNext: () => void;
  onPrev: () => void;
}) {
  const [platform, setPlatform] = useState("lovable");
  const [prompt, setPrompt] = useState("");
  const [pitchPoints, setPitchPoints] = useState<string[]>([]);
  const [typed, setTyped] = useState("");
  const [generating, setGenerating] = useState(false);
  const [notInstalled, setNotInstalled] = useState(false);
  const [claudeError, setClaudeError] = useState<string | null>(null);
  const lastFor = useRef<string>("");

  // Clear the generated prompt when the target lead or platform changes.
  useEffect(() => {
    const key = `${selected?.id ?? ""}:${platform}`;
    if (key !== lastFor.current) {
      setPrompt("");
      setPitchPoints([]);
      setTyped("");
    }
  }, [selected, platform]);

  // Typewriter for the generated prompt.
  useEffect(() => {
    setTyped("");
    if (!prompt) return;
    let i = 0;
    const id = setInterval(() => {
      i += 10;
      setTyped(prompt.slice(0, i));
      if (i >= prompt.length) clearInterval(id);
    }, 10);
    return () => clearInterval(id);
  }, [prompt]);

  async function generate() {
    if (!selected) return;
    setGenerating(true);
    setNotInstalled(false);
    setClaudeError(null);
    const res = await callClaude<BuildPromptResult>("/api/build-prompt", { lead: selected, platform });
    setGenerating(false);
    if (!res.ok) {
      if (res.notInstalled) setNotInstalled(true);
      else setClaudeError(res.error);
      toast.error(res.notInstalled ? "Claude Code required" : "Generation failed");
      return;
    }
    lastFor.current = `${selected.id}:${platform}`;
    setPrompt(res.data.prompt);
    setPitchPoints(res.data.pitchPoints ?? []);
    toast.success("Claude generated your website prompt");
  }

  function copyPrompt() {
    navigator.clipboard.writeText(prompt);
    toast.success("Prompt copied. Paste into " + PLATFORMS.find((p) => p.id === platform)?.label);
  }

  function openPlatform() {
    const url = PLATFORMS.find((p) => p.id === platform)?.url;
    if (url) window.open(url, "_blank");
  }

  if (!selected) {
    return (
      <PhaseShell
        title="Phase 4 — Generate website"
        subtitle="Claude Code writes a complete, tailored website-builder prompt for the lead you picked — brand, sections, SEO, and CTAs baked in."
        onPrev={onPrev}
        onNext={onNext}
        nextDisabled
        nextLabel="Draft outreach"
      >
        <IncompleteState
          title="No lead selected yet"
          description="Run scrape, audit, and rank, then pick a prospect in Phase 3. Claude then writes a full website prompt (for Lovable / Bolt / Claude Code / Codex) here."
          prevPhaseLabel="Rank"
          onPrev={onPrev}
        />
      </PhaseShell>
    );
  }

  return (
    <PhaseShell
      title="Phase 4 — Generate website"
      subtitle="Claude Code writes a complete, tailored website-builder prompt for your selected lead."
      onPrev={onPrev}
      onNext={onNext}
      nextLabel="Draft outreach"
    >
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Selected lead</div>
          <div className="font-display text-2xl mt-1">{selected.name}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{selected.address}</div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={platform} onValueChange={(v) => v && setPlatform(v)}>
            <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PLATFORMS.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={generate} disabled={generating} className="h-10 px-4">
            {generating ? "Generating…" : prompt ? "Regenerate" : "Generate with Claude"}
          </Button>
        </div>
      </div>

      {notInstalled && <div className="mb-6"><ClaudeRequired error={claudeError ?? undefined} onRetry={generate} /></div>}
      {claudeError && !notInstalled && (
        <div className="mb-6 rounded-md border border-[color:var(--destructive)]/40 bg-[color:var(--destructive)]/5 p-3 text-sm text-[color:var(--destructive)]" role="alert">
          {claudeError}
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Claude-generated prompt</CardTitle>
            {prompt && (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={openPlatform}><ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Open {PLATFORMS.find((p) => p.id === platform)?.label}</Button>
                <Button size="sm" onClick={copyPrompt}><Copy className="h-3.5 w-3.5 mr-1.5" /> Copy</Button>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {generating ? (
              <ClaudeThinking label="Claude is writing the website prompt…" />
            ) : prompt ? (
              <pre className="text-xs leading-relaxed whitespace-pre-wrap font-mono bg-muted/30 rounded-md p-4 max-h-[520px] overflow-y-auto border border-border">
                {typed}
                {typed.length < prompt.length && <span className="animate-pulse">▌</span>}
              </pre>
            ) : (
              <div className="h-[300px] flex flex-col items-center justify-center text-center gap-3 text-muted-foreground">
                <Sparkles className="h-6 w-6" strokeWidth={1.5} />
                <div className="text-sm max-w-xs">Pick a platform and hit <span className="text-foreground font-medium">Generate with Claude</span> — you&apos;ll get a full, tailored builder prompt.</div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Preview <span className="text-xs font-normal text-muted-foreground">· sample layout</span></CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg overflow-hidden border border-border h-[420px]">
              <iframe title="Preview" srcDoc={demoSiteHtml(selected)} className="w-full h-full bg-[#f5efe6]" />
            </div>
            {pitchPoints.length > 0 && (
              <div className="mt-4">
                <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-2">Pitch points for the owner</div>
                <ul className="space-y-1.5">
                  {pitchPoints.map((p, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <Check className="h-4 w-4 text-[color:var(--accent-foreground)] mt-0.5 shrink-0" strokeWidth={1.75} />
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PhaseShell>
  );
}

function demoSiteHtml(l: RankedLead): string {
  const wa = (l.whatsapp ?? l.phone ?? "919999999999").replace(/\D/g, "");
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${l.name}</title>
<script src="https://cdn.tailwindcss.com"></script>
<style>body{font-family:ui-serif,Georgia,'Times New Roman',serif;background:#f5efe6;color:#2c2620}h1,h2,.sans{font-family:ui-sans-serif,system-ui,sans-serif}</style>
</head><body>
<header class="border-b border-stone-200 bg-[#faf6ee]"><div class="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between"><div class="font-medium tracking-tight text-stone-800">${l.name}</div><a href="tel:${(l.phone ?? "").replace(/\s/g, "")}" class="text-sm text-stone-600 sans">${l.phone ?? ""}</a></div></header>
<section><div class="max-w-5xl mx-auto px-6 py-20 sm:py-28"><div class="text-[11px] uppercase tracking-[0.2em] text-stone-500 sans">${l.category} · ${l.city}</div><h1 class="text-4xl sm:text-6xl font-medium mt-4 leading-[1.05] tracking-tight text-stone-900">A name ${l.city.split(",")[0]}<br/>has trusted for years.<br/><span class="italic text-stone-500">Now online.</span></h1><p class="mt-6 text-lg text-stone-600 max-w-xl leading-relaxed">${l.rating} on Google · ${l.reviewsCount} reviews. Book in under a minute on WhatsApp — no calls, no waiting.</p><div class="mt-8 flex gap-3 sans"><a href="https://wa.me/${wa}" class="bg-stone-900 text-stone-50 font-medium px-7 py-3.5 rounded-full text-sm tracking-wide hover:bg-stone-700 transition">Book on WhatsApp →</a><a href="tel:${(l.phone ?? "").replace(/\s/g, "")}" class="border border-stone-300 text-stone-700 px-7 py-3.5 rounded-full text-sm tracking-wide">Call us</a></div></div></section>
<section class="bg-[#ede4d3] border-y border-stone-200"><div class="max-w-5xl mx-auto px-6 py-14 grid sm:grid-cols-3 gap-8 text-center"><div><div class="text-4xl font-medium tracking-tight text-stone-900">${l.reviewsCount}+</div><div class="text-[11px] uppercase tracking-[0.2em] text-stone-500 mt-2 sans">Happy customers</div></div><div><div class="text-4xl font-medium tracking-tight text-stone-900">${l.rating}</div><div class="text-[11px] uppercase tracking-[0.2em] text-stone-500 mt-2 sans">Google rating</div></div><div><div class="text-4xl font-medium tracking-tight text-stone-900">${l.yearsInBusiness ?? 8}+</div><div class="text-[11px] uppercase tracking-[0.2em] text-stone-500 mt-2 sans">Years in ${l.city.split(",")[0]}</div></div></div></section>
<section class="max-w-5xl mx-auto px-6 py-16"><div class="text-[11px] uppercase tracking-[0.2em] text-stone-500 sans">Services</div><h2 class="text-3xl font-medium tracking-tight text-stone-900 mt-2">What we do well.</h2><div class="grid sm:grid-cols-3 gap-px bg-stone-200 mt-8 border border-stone-200">${["Service one","Service two","Service three","Service four","Service five","Service six"].map((s)=>`<div class="bg-[#faf6ee] p-6"><div class="font-medium tracking-tight text-stone-900">${s}</div><div class="text-xs text-stone-500 mt-1.5 sans">Reliable · modern · affordable</div></div>`).join("")}</div></section>
<section class="max-w-5xl mx-auto px-6 py-16 border-t border-stone-200"><div class="text-[11px] uppercase tracking-[0.2em] text-stone-500 sans">Visit us</div><h2 class="text-3xl font-medium tracking-tight text-stone-900 mt-2">${l.address}</h2><div class="mt-6 rounded-lg overflow-hidden bg-stone-200/60 border border-stone-300 h-64 flex items-center justify-center text-stone-500 sans text-sm">[Google Maps embed]</div></section>
<a href="https://wa.me/${wa}" class="fixed bottom-6 right-6 bg-stone-900 text-stone-50 rounded-full w-14 h-14 flex items-center justify-center text-xl shadow-md">○</a>
<footer class="bg-[#ede4d3] border-t border-stone-200 sans"><div class="max-w-5xl mx-auto px-6 py-8 text-xs text-stone-500 flex justify-between"><span>© ${l.name}</span><span>${l.address}</span></div></footer>
</body></html>`;
}

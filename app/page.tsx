"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Stepper } from "@/components/Stepper";
import { Phase1Scrape } from "@/components/Phase1Scrape";
import { Phase2Audit } from "@/components/Phase2Audit";
import { Phase3Rank } from "@/components/Phase3Rank";
import { Phase4Build } from "@/components/Phase4Build";
import { Phase5Outreach } from "@/components/Phase5Outreach";
import type { Lead, AuditResult, RankedLead } from "@/lib/types";
import { Sparkles } from "lucide-react";

export default function Page() {
  const [phase, setPhase] = useState(1);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [audits, setAudits] = useState<Record<string, AuditResult>>({});
  const [ranked, setRanked] = useState<RankedLead[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [claudeOk, setClaudeOk] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/claude-status")
      .then((r) => r.json())
      .then((d) => setClaudeOk(!!d.installed))
      .catch(() => setClaudeOk(false));
  }, []);

  const completed = useMemo(() => {
    const s = new Set<number>();
    if (leads.length > 0) s.add(1);
    if (Object.keys(audits).length > 0) s.add(2);
    if (ranked.length > 0) s.add(3);
    if (selectedId) s.add(4);
    return s;
  }, [leads, audits, ranked, selectedId]);

  const selectedRanked = useMemo(
    () => ranked.find((r) => r.id === selectedId) ?? null,
    [ranked, selectedId],
  );

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:bg-foreground focus:text-background focus:px-3 focus:py-2 focus:rounded-md focus:text-sm"
      >
        Skip to content
      </a>
      <header className="border-b border-border bg-background/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-md bg-primary flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-primary-foreground" strokeWidth={1.5} aria-hidden="true" />
            </div>
            <div>
              <div className="font-display text-xl leading-none">Lead <span className="text-muted-foreground">→</span> Launch</div>
              <div className="text-[11px] text-muted-foreground leading-tight tracking-wide uppercase mt-1">Scrape · Audit · Rank · Build · Outreach</div>
            </div>
          </div>
          <ClaudeBadge ok={claudeOk} />
        </div>
        <Stepper current={phase} completed={completed} onJump={(n) => setPhase(n)} />
      </header>
      <main id="main" className="pt-6" tabIndex={-1}>
        <AnimatePresence mode="wait">
          {phase === 1 && (
            <Phase1Scrape
              key="p1"
              leads={leads}
              setLeads={setLeads}
              onNext={() => setPhase(2)}
            />
          )}
          {phase === 2 && (
            <Phase2Audit
              key="p2"
              leads={leads}
              audits={audits}
              setAudits={setAudits}
              onNext={() => setPhase(3)}
              onPrev={() => setPhase(1)}
            />
          )}
          {phase === 3 && (
            <Phase3Rank
              key="p3"
              leads={leads}
              audits={audits}
              ranked={ranked}
              setRanked={setRanked}
              selectedId={selectedId}
              setSelectedId={setSelectedId}
              onNext={() => setPhase(4)}
              onPrev={() => setPhase(2)}
            />
          )}
          {phase === 4 && (
            <Phase4Build
              key="p4"
              selected={selectedRanked}
              onNext={() => setPhase(5)}
              onPrev={() => setPhase(3)}
            />
          )}
          {phase === 5 && (
            <Phase5Outreach
              key="p5"
              selected={selectedRanked}
              onPrev={() => setPhase(4)}
            />
          )}
        </AnimatePresence>
      </main>
    </>
  );
}

function ClaudeBadge({ ok }: { ok: boolean | null }) {
  const color =
    ok === null ? "bg-muted-foreground/40" : ok ? "bg-emerald-500" : "bg-[color:var(--destructive)]";
  const label = ok === null ? "Checking…" : ok ? "OpenRouter connected" : "OpenRouter key missing";
  return (
    <div className="hidden sm:flex items-center gap-2 text-[11px] text-muted-foreground tracking-[0.12em] uppercase">
      <span className={`h-1.5 w-1.5 rounded-full ${color}`} aria-hidden="true" />
      {label}
    </div>
  );
}

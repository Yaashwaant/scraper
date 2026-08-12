import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Runs the local Claude Code CLI (`claude -p …`) as a subprocess, using the
 * user's own Claude Code subscription/auth — NO API key involved.
 *
 * Default context uses a 1M-context model that requires paid usage credits and
 * 429s on standard plans, so we pin `--model sonnet` (standard context).
 */

export type ClaudeResult<T> =
  | { ok: true; data: T }
  | { ok: false; notInstalled?: boolean; error: string };

export function resolveClaudeBin(): string | null {
  return process.env.OPENROUTER_API_KEY ? "openrouter" : null;
}

export function claudeInstalled(): boolean {
  return !!process.env.OPENROUTER_API_KEY;
}

function extractJSON<T>(text: string): T | null {
  let s = text.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  const firstObj = s.indexOf("{");
  const firstArr = s.indexOf("[");
  let start = -1;
  if (firstObj === -1) start = firstArr;
  else if (firstArr === -1) start = firstObj;
  else start = Math.min(firstObj, firstArr);
  if (start === -1) return null;
  const open = s[start];
  const close = open === "{" ? "}" : "]";
  const end = s.lastIndexOf(close);
  if (end <= start) return null;
  const candidate = s.slice(start, end + 1);
  try {
    return JSON.parse(candidate) as T;
  } catch {
    return null;
  }
}

export async function runClaudeJSON<T>(
  prompt: string,
  opts: { model?: string; timeoutMs?: number } = {},
): Promise<ClaudeResult<T>> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return { ok: false, notInstalled: true, error: "OPENROUTER_API_KEY is not set in your environment variables." };
  }

  // Map simple model names or allow CLAUDE_MODEL override from .env.local
  let model = process.env.CLAUDE_MODEL ?? opts.model ?? "anthropic/claude-3.5-sonnet";
  if (model === "sonnet") model = "anthropic/claude-3.5-sonnet";

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "Lead to Launch App",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      return { ok: false, error: `OpenRouter error: ${res.status} ${errorText}` };
    }

    const json = await res.json();
    const text = json.choices?.[0]?.message?.content;
    
    if (!text) {
      return { ok: false, error: "OpenRouter returned empty response." };
    }

    const data = extractJSON<T>(text);
    if (data === null) {
      return { ok: false, error: "OpenRouter did not return valid JSON." };
    }

    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

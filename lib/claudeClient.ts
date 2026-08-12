export type ClaudeCallOk<T> = { ok: true; data: T };
export type ClaudeCallErr = { ok: false; notInstalled: boolean; error: string };

export async function callClaude<T>(
  url: string,
  body: unknown,
): Promise<ClaudeCallOk<T> | ClaudeCallErr> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        ok: false,
        notInstalled: !!json.notInstalled || res.status === 503,
        error: json.error ?? `Request failed (${res.status})`,
      };
    }
    return { ok: true, data: json as T };
  } catch (e) {
    return { ok: false, notInstalled: false, error: (e as Error).message };
  }
}

import { metrics } from "./metrics.js";

/**
 * SPEC-021: injectable email delivery. FAIL SOFT by design (opposite of the
 * bridge's fail-closed): email is an accelerant, never a dependency — a failed
 * or no-op send must never block the flow that triggered it.
 */

export interface EmailMessage { to: string; subject: string; text: string }
export interface EmailProvider { send(msg: EmailMessage): Promise<boolean> }

export function noopProvider(log: (line: string) => void = console.log): EmailProvider {
  return {
    async send(msg) {
      log(JSON.stringify({ event: "email.noop", to: msg.to, subject: msg.subject }));
      metrics.increment("email.sent.noop");
      return true;
    },
  };
}

/** HTTP delivery — the harness target and the template for any future vendor adapter. */
export function testProvider(url: string, fetchImpl: typeof fetch): EmailProvider {
  return {
    async send(msg) {
      try {
        const res = await fetchImpl(url, {
          method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(msg),
        });
        metrics.increment(res.ok ? "email.sent.test" : "email.failed.test");
        return res.ok;
      } catch {
        metrics.increment("email.failed.test");
        return false;
      }
    },
  };
}

export function resolveEmailProvider(env: Record<string, string | undefined>, fetchImpl: typeof fetch = fetch): EmailProvider {
  const kind = env.EMAIL_PROVIDER ?? "noop";
  if (kind === "test" && env.EMAIL_TEST_URL) return testProvider(env.EMAIL_TEST_URL, fetchImpl);
  if (kind !== "noop") console.warn(JSON.stringify({ event: "email.unknown_provider", provider: kind, fallback: "noop" }));
  return noopProvider();
}

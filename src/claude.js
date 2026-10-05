// The one place SlopChop talks to a model.
//
// It runs on your own key and only when you ask: `triage` and `suggest`
// are the only callers, both are dry runs until --apply, and nothing else
// in the tool sends text anywhere. Plain fetch against the Messages API, so
// the package keeps its zero dependencies and the GitHub Action keeps
// working with nothing installed.

export const DEFAULT_MODEL = 'claude-opus-5-5';
export const DEFAULT_EFFORT = 'medium';

// Models that take server-side fallbacks. On a safety decline the API
// re-runs the request on Anthropic's recommended model instead of
// returning nothing; a copy review should not stall on a false positive.
const FALLBACK_MODELS = new Set(['claude-opus-5-5', 'claude-opus-5', 'claude-fable-5-1', 'claude-sonnet-5-5']);
const FALLBACK_BETA = 'server-side-fallback-2026-07-01';

const RETRYABLE = new Set([408, 409, 429, 500, 502, 503, 504, 529]);

export class ModelError extends Error {
  constructor(message, { status = null, retryable = false } = {}) {
    super(message);
    this.status = status;
    this.retryable = retryable;
  }
}

/** Credentials from the environment as { headers, betas }, or null. */
export function credentials(env = process.env) {
  if (env.ANTHROPIC_API_KEY) return { headers: { 'x-api-key': env.ANTHROPIC_API_KEY }, betas: [] };
  if (env.ANTHROPIC_AUTH_TOKEN) {
    return { headers: { authorization: `Bearer ${env.ANTHROPIC_AUTH_TOKEN}` }, betas: ['oauth-2025-04-20'] };
  }
  return null;
}

/**
 * One request for one JSON object matching `schema`. Returns
 * { data, model, usage }. Throws ModelError on anything else, including a
 * refusal or a response cut off by max_tokens.
 */
export async function askJson({
  system, user, schema, model = DEFAULT_MODEL, effort = DEFAULT_EFFORT,
  maxTokens = 16000, env = process.env, fetchImpl = globalThis.fetch,
  retries = 3, sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
}) {
  const auth = credentials(env);
  if (!auth) throw new ModelError('No API key. Set ANTHROPIC_API_KEY to your own Anthropic key.');

  const fallback = FALLBACK_MODELS.has(model);
  const betas = [...auth.betas, ...(fallback ? [FALLBACK_BETA] : [])];

  const body = {
    model,
    max_tokens: maxTokens,
    // The instructions are the same for every batch, so they are cached
    // once the prefix is long enough to qualify.
    system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: user }],
    output_config: { effort, format: { type: 'json_schema', schema } },
    ...(fallback ? { fallbacks: 'default' } : {}),
  };

  const url = `${(env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com').replace(/\/$/, '')}/v1/messages`;
  for (let attempt = 0; ; attempt++) {
    let res;
    try {
      res = await fetchImpl(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'anthropic-version': '2023-06-01',
          ...(betas.length ? { 'anthropic-beta': betas.join(',') } : {}),
          ...auth.headers,
        },
        body: JSON.stringify(body),
      });
    } catch (e) {
      if (attempt < retries) { await sleep(backoff(attempt)); continue; }
      throw new ModelError(`Could not reach the API: ${e.message}`, { retryable: true });
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      let message = text.slice(0, 300);
      try { message = JSON.parse(text).error?.message || message; } catch { /* not JSON */ }
      if (RETRYABLE.has(res.status) && attempt < retries) {
        const after = Number(res.headers.get('retry-after'));
        await sleep(Number.isFinite(after) && after > 0 ? after * 1000 : backoff(attempt));
        continue;
      }
      const hint = res.status === 401 ? ' Check ANTHROPIC_API_KEY.' : '';
      throw new ModelError(`API ${res.status}: ${hint ? message.replace(/\.?$/, '.') : message}${hint}`,{ status: res.status, retryable: RETRYABLE.has(res.status) });
    }

    const msg = await res.json();
    if (msg.stop_reason === 'refusal') {
      const why = msg.stop_details?.category ? ` (${msg.stop_details.category})` : '';
      throw new ModelError(`The model declined this batch${why}.`);
    }
    if (msg.stop_reason === 'max_tokens') {
      throw new ModelError('The response was cut off before it finished. Try a smaller --batch.');
    }
    const text = (msg.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
    try {
      return { data: JSON.parse(text), model: msg.model, usage: msg.usage };
    } catch {
      throw new ModelError('The response was not the JSON that was asked for.');
    }
  }
}

function backoff(attempt) {
  return Math.min(30000, 1000 * 2 ** attempt) + Math.floor(Math.random() * 250);
}

/**
 * Run `fn` over `items` with at most `limit` in flight. Results come back in
 * input order, each as { ok, value } or { ok: false, error }.
 */
export async function pool(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      try { out[i] = { ok: true, value: await fn(items[i], i) }; }
      catch (error) { out[i] = { ok: false, error }; }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

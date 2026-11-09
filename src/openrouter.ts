export type PaidModel = {
  id: string;
  name: string;
  provider: "openrouter-byok";
  pricing: { prompt: number; completion: number };
};

export type OpenRouterKeyInfo = {
  limitRemaining?: number | null;
  paidModels: PaidModel[];
};

type OpenRouterModelRecord = {
  id?: string;
  name?: string;
  pricing?: { prompt?: string | number; completion?: string | number };
};

function timeoutSignal(parentSignal: AbortSignal | undefined, timeoutMs: number) {
  const controller = new AbortController();
  let timedOut = false;
  const abortFromParent = () => controller.abort();
  if (parentSignal?.aborted) abortFromParent();
  else parentSignal?.addEventListener("abort", abortFromParent, { once: true });
  const timer = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  return {
    signal: controller.signal,
    timedOut: () => timedOut,
    cleanup: () => {
      window.clearTimeout(timer);
      parentSignal?.removeEventListener("abort", abortFromParent);
    }
  };
}

async function openRouterFetch<T>(
  url: string,
  init: RequestInit,
  parentSignal?: AbortSignal
): Promise<T> {
  const request = timeoutSignal(parentSignal, 12_000);
  try {
    const response = await fetch(url, { ...init, signal: request.signal });
    const payload = await response.json() as T & { error?: { message?: string } };
    if (!response.ok) {
      throw new Error(payload.error?.message || `OpenRouter returned HTTP ${response.status}.`);
    }
    return payload;
  } catch (error) {
    if (parentSignal?.aborted) {
      const cancelled = new Error("The workflow was cancelled.");
      cancelled.name = "AbortError";
      throw cancelled;
    }
    if (request.timedOut()) throw new Error("OpenRouter connection timed out. Try again.");
    throw error;
  } finally {
    request.cleanup();
  }
}

export async function connectOpenRouterKey(
  key: string,
  signal?: AbortSignal
): Promise<OpenRouterKeyInfo> {
  const keyPayload = await openRouterFetch<{ data?: { limit_remaining?: number | null } }>(
    "https://openrouter.ai/api/v1/key",
    { headers: { Authorization: `Bearer ${key}` } },
    signal
  );
  if (!keyPayload.data) throw new Error("OpenRouter did not return key details.");

  const catalog = await openRouterFetch<{ data?: OpenRouterModelRecord[] }>(
    "https://openrouter.ai/api/v1/models",
    {},
    signal
  );
  const paidModels = (catalog.data ?? []).flatMap((model): PaidModel[] => {
    const prompt = Number(model.pricing?.prompt);
    const completion = Number(model.pricing?.completion);
    if (!model.id || model.id.endsWith(":free") || !Number.isFinite(prompt) || !Number.isFinite(completion) || (prompt <= 0 && completion <= 0)) return [];
    return [{
      id: model.id,
      name: model.name || model.id,
      provider: "openrouter-byok",
      pricing: { prompt, completion }
    }];
  }).sort((a, b) => (a.pricing.prompt + a.pricing.completion) - (b.pricing.prompt + b.pricing.completion));

  return {
    limitRemaining: keyPayload.data.limit_remaining == null ? null : Number(keyPayload.data.limit_remaining),
    paidModels
  };
}


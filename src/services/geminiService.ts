import {
  extractJsonFromLlmOutput,
  GEMINI_GROUPING_RESPONSE_SCHEMA,
  SemanticCompletionClient,
} from '../engine/semantic';
import { AiProvider } from '../engine/types';

export const GROQ_CHAT_COMPLETIONS_URL =
  'https://api.groq.com/openai/v1/chat/completions';

/**
 * Ordered pool of Groq models with independent per-model TPM buckets.
 * If one model is unavailable (HTTP 404) or hits its per-minute token limit (HTTP 429),
 * Prism automatically routes the request to the next model in the pool.
 */
export const GROQ_FALLBACK_MODELS = [
  'qwen/qwen3.8-27b',
  'openai/gpt-oss-20b',
  'openai/gpt-oss-120b',
  'allam-2-7b',
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
] as const;

export class GeminiApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly isRateLimit: boolean = false,
    public readonly errorCode?: string
  ) {
    super(message);
    this.name = 'GeminiApiError';
  }
}

async function parseApiErrorDetails(response: Response): Promise<{
  detailMessage?: string;
  errorCode?: string;
}> {
  try {
    const body = (await response.json()) as {
      error?: { message?: string; code?: string };
    };
    return {
      detailMessage: body?.error?.message,
      errorCode: body?.error?.code,
    };
  } catch {
    return {};
  }
}

async function callOpenAiCompatibleProvider({
  providerLabel,
  endpoint,
  apiKey,
  model,
  systemPrompt,
  userPayload,
  signal,
}: {
  providerLabel: string;
  endpoint: string;
  apiKey: string;
  model: string;
  systemPrompt: string;
  userPayload: string;
  signal: AbortSignal;
}): Promise<unknown> {
  const cleanKey = apiKey.trim();
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cleanKey}`,
    },
    signal,
    body: JSON.stringify({
      model,
      temperature: 0.1,
      // Explicitly cap max_tokens so Groq's pre-flight TPM limiter does not reserve
      // 4096+ completion tokens upfront against the 8000 TPM free-tier quota
      max_tokens: 1200,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPayload },
      ],
    }),
  });

  if (!response.ok) {
    const { detailMessage, errorCode } = await parseApiErrorDetails(response);
    const shortDetail = detailMessage
      ? `: ${detailMessage.split('.')[0]}`
      : '';

    if (response.status === 429) {
      throw new GeminiApiError(
        `${providerLabel} API rate limit (HTTP 429)${shortDetail}`,
        429,
        true,
        errorCode
      );
    }
    if (
      response.status === 400 ||
      response.status === 401 ||
      response.status === 403
    ) {
      throw new GeminiApiError(
        `${providerLabel} API error (HTTP ${response.status})${shortDetail}`,
        response.status,
        false,
        errorCode
      );
    }
    throw new GeminiApiError(
      `${providerLabel} API returned HTTP ${response.status}${shortDetail}`,
      response.status,
      false,
      errorCode
    );
  }

  const data = (await response.json()) as {
    choices?: Array<{
      message?: {
        content?: string;
      };
    }>;
  };

  const rawText = data?.choices?.[0]?.message?.content;
  if (!rawText) {
    throw new GeminiApiError(
      `${providerLabel} API returned an empty completion`
    );
  }

  return extractJsonFromLlmOutput(rawText);
}

/**
 * Calls Groq's `/openai/v1/chat/completions` endpoint with automatic multi-model rotation:
 * - If a model returns HTTP 404 (`model_not_found`), HTTP 429 (per-model TPM rate limit),
 *   or HTTP 503, Prism immediately rotates to the next active model in `GROQ_FALLBACK_MODELS`
 *   (each model has its own independent 8,000 TPM quota on Groq).
 */
async function callGroqWithModelFallback({
  apiKey,
  preferredModel,
  systemPrompt,
  userPayload,
  signal,
}: {
  apiKey: string;
  preferredModel: string;
  systemPrompt: string;
  userPayload: string;
  signal: AbortSignal;
}): Promise<unknown> {
  const primary = (preferredModel || 'qwen/qwen3.8-27b').trim();
  const candidates = [
    primary,
    ...GROQ_FALLBACK_MODELS.filter((m) => m !== primary),
  ];

  let lastError: unknown = null;

  for (const candidateModel of candidates) {
    try {
      return await callOpenAiCompatibleProvider({
        providerLabel: 'Groq',
        endpoint: GROQ_CHAT_COMPLETIONS_URL,
        apiKey,
        model: candidateModel,
        systemPrompt,
        userPayload,
        signal,
      });
    } catch (err) {
      lastError = err;
      const shouldTryNextModel =
        err instanceof GeminiApiError &&
        (err.statusCode === 404 ||
          err.statusCode === 429 ||
          err.statusCode === 503 ||
          err.isRateLimit ||
          err.errorCode === 'model_not_found');

      if (!shouldTryNextModel) {
        throw err;
      }
      // Rotate to next Groq model with its own independent TPM bucket
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new GeminiApiError('Groq API: all models exhausted');
}

/**
 * Unified Multi-Provider AI Client supporting:
 * 1. Groq (`https://api.groq.com/openai/v1/chat/completions`) — LPU ultra-low latency
 * 2. Google Gemini (`generativelanguage.googleapis.com`) — Structured JSON Schema
 * 3. Custom OpenAI-Compatible endpoints (`${baseUrl}/chat/completions`)
 */
export const geminiClient: SemanticCompletionClient = {
  async generateGroups({
    provider = 'gemini',
    apiKey,
    model,
    baseUrl,
    systemPrompt,
    userPayload,
  }: {
    provider?: AiProvider;
    apiKey: string;
    model: string;
    baseUrl?: string;
    systemPrompt: string;
    userPayload: string;
  }): Promise<unknown> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 18000);

    const cleanKey = apiKey.trim();
    const effectiveProvider: AiProvider =
      provider ?? (cleanKey.startsWith('gsk_') ? 'groq' : 'gemini');

    try {
      if (effectiveProvider === 'groq') {
        return await callGroqWithModelFallback({
          apiKey: cleanKey,
          preferredModel: model || 'qwen/qwen3.8-27b',
          systemPrompt,
          userPayload,
          signal: controller.signal,
        });
      }

      if (effectiveProvider === 'custom') {
        const cleanBase = (baseUrl || 'https://api.openai.com/v1')
          .trim()
          .replace(/\/+$/, '');
        const endpoint = cleanBase.endsWith('/chat/completions')
          ? cleanBase
          : `${cleanBase}/chat/completions`;
        return await callOpenAiCompatibleProvider({
          providerLabel: 'Custom AI',
          endpoint,
          apiKey: cleanKey,
          model: model || 'gpt-4o-mini',
          systemPrompt,
          userPayload,
          signal: controller.signal,
        });
      }

      // Google Gemini provider
      const geminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        model || 'gemini-2.5-flash'
      )}:generateContent`;

      const response = await fetch(geminiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': cleanKey,
        },
        signal: controller.signal,
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: systemPrompt }],
          },
          contents: [
            {
              role: 'user',
              parts: [{ text: userPayload }],
            },
          ],
          generationConfig: {
            temperature: 0.15,
            responseMimeType: 'application/json',
            responseSchema: GEMINI_GROUPING_RESPONSE_SCHEMA,
          },
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          throw new GeminiApiError(
            'Gemini API rate limit exceeded (HTTP 429)',
            429,
            true
          );
        }
        if (
          response.status === 400 ||
          response.status === 401 ||
          response.status === 403
        ) {
          throw new GeminiApiError(
            `Gemini API authentication or request error (HTTP ${response.status})`,
            response.status,
            false
          );
        }
        throw new GeminiApiError(
          `Gemini API returned HTTP ${response.status}`,
          response.status,
          false
        );
      }

      const data = (await response.json()) as {
        candidates?: Array<{
          content?: {
            parts?: Array<{ text?: string }>;
          };
        }>;
      };

      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) {
        throw new GeminiApiError(
          'Gemini API returned an empty candidate payload'
        );
      }

      return extractJsonFromLlmOutput(rawText);
    } catch (error) {
      if (error instanceof GeminiApiError) {
        throw error;
      }
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new GeminiApiError('AI API request timed out after 18s');
      }
      throw new GeminiApiError(
        error instanceof Error ? error.message : 'Network error contacting AI API'
      );
    } finally {
      clearTimeout(timeoutId);
    }
  },
};

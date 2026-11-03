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
 * If one model is unavailable (HTTP 404), hits rate limits (HTTP 429),
 * or fails JSON validation (HTTP 400), Prism automatically routes to the next model.
 */
export const GROQ_FALLBACK_MODELS = [
  'llama-3.3-70b-versatile',
  'qwen/qwen3.8-27b',
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
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
    const data = (await response.json()) as {
      error?: {
        message?: string;
        code?: string | number;
      };
    };
    return {
      detailMessage: data?.error?.message,
      errorCode: data?.error?.code !== undefined ? String(data.error.code) : undefined,
    };
  } catch {
    return {};
  }
}

/**
 * Helper to dynamically compute token budget for OpenAI-compatible completions.
 * Scales with the number of tabs while respecting provider ceilings.
 */
function estimateMaxTokens(userPayload: string): number {
  // Approximate length of user payload to gauge tab count
  // 1200 tokens was insufficient for 75+ tabs when generating groups + tabIds
  const length = userPayload.length;
  if (length > 3000) return 2800;
  if (length > 1500) return 2200;
  return 1800;
}

/**
 * Calls any standard OpenAI-compatible Chat Completions API endpoint (Groq / OpenRouter / Custom).
 */
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
  const maxTokens = estimateMaxTokens(userPayload);

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
      max_tokens: maxTokens,
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
 *   HTTP 503, or HTTP 400 ("Failed to validate JSON" / truncation), Prism rotates to the next model in `GROQ_FALLBACK_MODELS`.
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
  const primary = (preferredModel || 'llama-3.3-70b-versatile').trim();
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
      const isJsonValidationError =
        err instanceof GeminiApiError &&
        err.statusCode === 400 &&
        err.message.toLowerCase().includes('failed to validate json');

      const shouldTryNextModel =
        err instanceof GeminiApiError &&
        (err.statusCode === 404 ||
          err.statusCode === 429 ||
          err.statusCode === 503 ||
          err.isRateLimit ||
          err.errorCode === 'model_not_found' ||
          isJsonValidationError);

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
 * Production implementation of `SemanticCompletionClient`.
 * Supports Google Gemini (`v1beta/models/...:generateContent`), Groq LPU (`/openai/v1/chat/completions`),
 * and arbitrary OpenAI-compatible custom endpoints.
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
    model?: string;
    baseUrl?: string;
    systemPrompt: string;
    userPayload: string;
  }): Promise<unknown> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 18000);
    const cleanKey = apiKey.trim();
    const activeProvider: AiProvider =
      provider ?? (cleanKey.startsWith('gsk_') ? 'groq' : 'gemini');

    try {
      if (activeProvider === 'groq') {
        return await callGroqWithModelFallback({
          apiKey: cleanKey,
          preferredModel: model || 'llama-3.3-70b-versatile',
          systemPrompt,
          userPayload,
          signal: controller.signal,
        });
      }

      if (activeProvider === 'custom') {
        const rawBase = (baseUrl || 'https://api.openai.com/v1')
          .trim()
          .replace(/\/+$/, '');
        const endpoint = rawBase.endsWith('/chat/completions')
          ? rawBase
          : `${rawBase}/chat/completions`;

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

      // Default: Google Gemini 2.5 Flash with native responseSchema
      const geminiModel = encodeURIComponent(model || 'gemini-2.5-flash');
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent`;

      const response = await fetch(url, {
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
        const { detailMessage, errorCode } = await parseApiErrorDetails(response);
        const shortDetail = detailMessage
          ? `: ${detailMessage.split('.')[0]}`
          : '';

        if (response.status === 429) {
          throw new GeminiApiError(
            `Gemini API rate limit exceeded (HTTP 429)${shortDetail}`,
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
            `Gemini API authentication or request error (HTTP ${response.status})${shortDetail}`,
            response.status,
            false,
            errorCode
          );
        }
        throw new GeminiApiError(
          `Gemini API returned HTTP ${response.status}${shortDetail}`,
          response.status,
          false,
          errorCode
        );
      }

      const data = (await response.json()) as {
        candidates?: Array<{
          content?: {
            parts?: Array<{
              text?: string;
            }>;
          };
        }>;
      };

      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) {
        throw new GeminiApiError('Gemini API returned an empty candidate payload');
      }

      return extractJsonFromLlmOutput(rawText);
    } catch (err) {
      if (err instanceof GeminiApiError) {
        throw err;
      }
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new GeminiApiError('AI API request timed out after 18s');
      }
      throw new GeminiApiError(
        err instanceof Error ? err.message : 'Network error contacting AI API'
      );
    } finally {
      clearTimeout(timeoutId);
    }
  },
};

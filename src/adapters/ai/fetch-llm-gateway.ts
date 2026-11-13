import { GROQ_MODEL_POOL } from '../../domain/types';
import { GEMINI_GROUPING_RESPONSE_SCHEMA } from '../../engine/meaning/prompt-builder';
import type {
  LlmGatewayPort,
  LlmGroupingRequest,
  LlmGroupingResponse,
} from '../../ports/llm-gateway.port';

export const GROQ_CHAT_COMPLETIONS_URL = 'https://api.groq.com/openai/v1/chat/completions';

export class AiGatewayError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly isRateLimit = false,
    public readonly errorCode?: string,
  ) {
    super(message);
    this.name = 'AiGatewayError';
  }
}

export function estimateMaxTokens(payloadLength: number): number {
  if (payloadLength > 3000) return 2800;
  if (payloadLength > 1500) return 2200;
  return 1800;
}

async function parseApiErrorDetails(response: Response): Promise<{
  detailMessage?: string;
  errorCode?: string;
}> {
  try {
    const data = (await response.json()) as {
      error?: { message?: string; code?: string | number };
    };
    return {
      detailMessage: data.error?.message,
      errorCode: data.error?.code !== undefined ? String(data.error.code) : undefined,
    };
  } catch {
    return {};
  }
}

export class FetchLlmGateway implements LlmGatewayPort {
  constructor(private readonly fetchImpl: typeof fetch = globalThis.fetch.bind(globalThis)) {}

  async requestGrouping(request: LlmGroupingRequest): Promise<LlmGroupingResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, request.timeoutMs);

    try {
      if (request.provider === 'groq') {
        return await this.callGroqWithRotation(request, controller.signal);
      }

      if (request.provider === 'custom') {
        const rawBase = (request.baseUrl || 'https://api.openai.com/v1').trim().replace(/\/+$/, '');
        const endpoint = rawBase.endsWith('/chat/completions')
          ? rawBase
          : `${rawBase}/chat/completions`;
        return await this.callOpenAiCompatible({
          providerLabel: 'Custom AI',
          endpoint,
          apiKey: request.apiKey.trim(),
          model: request.model || 'gpt-4o-mini',
          systemPrompt: request.systemPrompt,
          userPrompt: request.userPrompt,
          payloadLength: request.payloadLength,
          signal: controller.signal,
        });
      }

      return await this.callGemini(request, controller.signal);
    } catch (err) {
      if (err instanceof AiGatewayError) {
        throw err;
      }
      if (err instanceof Error && err.name === 'AbortError') {
        const sec = Math.round(request.timeoutMs / 1000);
        throw new AiGatewayError(`AI API request timed out after ${sec}s`);
      }
      throw new AiGatewayError(
        err instanceof Error ? err.message : 'Network error contacting AI API',
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async callGroqWithRotation(
    request: LlmGroupingRequest,
    signal: AbortSignal,
  ): Promise<LlmGroupingResponse> {
    const primary = (request.model || GROQ_MODEL_POOL[0]).trim();
    const candidates = [primary, ...GROQ_MODEL_POOL.filter((m) => m !== primary)];
    let lastError: unknown = null;

    for (const candidateModel of candidates) {
      try {
        return await this.callOpenAiCompatible({
          providerLabel: 'Groq',
          endpoint: GROQ_CHAT_COMPLETIONS_URL,
          apiKey: request.apiKey.trim(),
          model: candidateModel,
          systemPrompt: request.systemPrompt,
          userPrompt: request.userPrompt,
          payloadLength: request.payloadLength,
          signal,
        });
      } catch (err) {
        lastError = err;
        const isJsonValidationError =
          err instanceof AiGatewayError &&
          err.statusCode === 400 &&
          err.message.toLowerCase().includes('failed to validate json');

        const shouldRotate =
          err instanceof AiGatewayError &&
          (err.statusCode === 404 ||
            err.statusCode === 429 ||
            err.statusCode === 503 ||
            err.isRateLimit ||
            err.errorCode === 'model_not_found' ||
            isJsonValidationError);

        if (!shouldRotate) {
          throw err;
        }
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new AiGatewayError('Groq API: all models exhausted');
  }

  private async callOpenAiCompatible(params: {
    providerLabel: string;
    endpoint: string;
    apiKey: string;
    model: string;
    systemPrompt: string;
    userPrompt: string;
    payloadLength: number;
    signal: AbortSignal;
  }): Promise<LlmGroupingResponse> {
    const maxTokens = estimateMaxTokens(params.payloadLength);

    const response = await this.fetchImpl(params.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${params.apiKey}`,
      },
      signal: params.signal,
      body: JSON.stringify({
        model: params.model,
        temperature: 0.1,
        max_tokens: maxTokens,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: params.systemPrompt },
          { role: 'user', content: params.userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const { detailMessage, errorCode } = await parseApiErrorDetails(response);
      const shortDetail = detailMessage ? `: ${detailMessage.split('.')[0] ?? detailMessage}` : '';
      throw new AiGatewayError(
        `${params.providerLabel} API error (HTTP ${response.status})${shortDetail}`,
        response.status,
        response.status === 429,
        errorCode,
      );
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const rawText = data.choices?.[0]?.message?.content;
    if (!rawText) {
      throw new AiGatewayError(`${params.providerLabel} API returned an empty completion`);
    }

    return {
      rawText,
      modelUsed: params.model,
    };
  }

  private async callGemini(
    request: LlmGroupingRequest,
    signal: AbortSignal,
  ): Promise<LlmGroupingResponse> {
    const modelName = request.model || 'gemini-2.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelName)}:generateContent`;

    const generationConfig: Record<string, unknown> = {
      temperature: 0.15,
      responseMimeType: 'application/json',
    };
    if (request.useGeminiSchema) {
      generationConfig['responseSchema'] = GEMINI_GROUPING_RESPONSE_SCHEMA;
    }

    const response = await this.fetchImpl(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': request.apiKey.trim(),
      },
      signal,
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: request.systemPrompt }],
        },
        contents: [
          {
            role: 'user',
            parts: [{ text: request.userPrompt }],
          },
        ],
        generationConfig,
      }),
    });

    if (!response.ok) {
      const { detailMessage, errorCode } = await parseApiErrorDetails(response);
      const shortDetail = detailMessage ? `: ${detailMessage.split('.')[0] ?? detailMessage}` : '';
      throw new AiGatewayError(
        `Gemini API error (HTTP ${response.status})${shortDetail}`,
        response.status,
        response.status === 429,
        errorCode,
      );
    }

    const data = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      throw new AiGatewayError('Gemini API returned an empty candidate payload');
    }

    return {
      rawText,
      modelUsed: modelName,
    };
  }
}

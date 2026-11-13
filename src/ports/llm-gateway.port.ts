import type { AiProvider } from '../domain/types';

export interface LlmGroupingRequest {
  provider: AiProvider;
  apiKey: string;
  model: string;
  baseUrl?: string;
  systemPrompt: string;
  userPrompt: string;
  payloadLength: number;
  useGeminiSchema: boolean;
  timeoutMs: number;
}

export interface LlmGroupingResponse {
  rawText: string;
  modelUsed: string;
}

export interface LlmGatewayPort {
  requestGrouping(request: LlmGroupingRequest): Promise<LlmGroupingResponse>;
}

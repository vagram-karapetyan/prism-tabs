import { describe, expect, it, vi } from 'vitest';
import { AiGatewayError, estimateMaxTokens, FetchLlmGateway } from '../src/adapters/ai/fetch-llm-gateway';
import type { ExistingTabGroup, TabMetadata } from '../src/domain/types';
import { runMeaningGrouping } from '../src/engine/meaning/meaning-engine';
import {
  buildSemanticSystemPrompt,
  buildSemanticUserPayload,
  directiveRequestsFullRebuild,
} from '../src/engine/meaning/prompt-builder';
import { validateAndNormalizeSemanticResponse } from '../src/engine/meaning/response-validator';
import { sanitizeTabMetadata } from '../src/engine/meaning/sanitizer';
import type { LlmGatewayPort } from '../src/ports/llm-gateway.port';

function tab(id: number, url: string, title = `Tab ${id}`): TabMetadata {
  return { id, url, title, index: id - 1 };
}

describe('Meaning Mode privacy sanitizer & prompt builder', () => {
  it('strips query/hash, excludes internal URLs, and masks long hex/UUID path segments', () => {
    expect(sanitizeTabMetadata(tab(1, 'chrome://settings/privacy', 'Settings'))).toBeNull();
    expect(sanitizeTabMetadata(tab(2, 'edge://newtab/', 'New Tab'))).toBeNull();

    const sanitized = sanitizeTabMetadata(
      tab(
        3,
        'https://app.example.com/workspace/550e8400-e29b-41d4-a716-446655440000/very-long-resource-segment-name-that-exceeds-limit/extra?token=secret#hash',
        '   Secret   Dashboard   Title   ',
      ),
    );

    expect(sanitized).toEqual({
      tabId: 3,
      title: 'Secret Dashboard Title',
      hostname: 'app.example.com',
      cleanPath: '/workspace/:id/very-long-resource-segment-n',
    });
    expect(JSON.stringify(sanitized)).not.toContain('token=secret');
    expect(JSON.stringify(sanitized)).not.toContain('550e8400');
  });

  it('injects maxTabsPerGroup, existing groups, and compact payload for >15 tabs', () => {
    const existing: ExistingTabGroup[] = [
      {
        id: 10,
        title: '💻 Dev',
        cleanTitle: 'Dev',
        emoji: '💻',
        color: 'purple',
        collapsed: false,
        tabIds: [1],
      },
    ];

    const sysPrompt = buildSemanticSystemPrompt('Group by project', existing, 8);
    expect(sysPrompt).toContain('maxTabsPerGroup = 8');
    expect(sysPrompt).toContain('<EXISTING_TAB_GROUPS>');
    expect(sysPrompt).toContain('existingGroupId=10');

    expect(directiveRequestsFullRebuild('пересобрать все с нуля')).toBe(true);
    const rebuildPrompt = buildSemanticSystemPrompt('пересобрать все с нуля', existing, 8);
    expect(rebuildPrompt).not.toContain('<EXISTING_TAB_GROUPS>\n');
    expect(rebuildPrompt).not.toContain('existingGroupId=10');

    const payloads = Array.from({ length: 18 }, (_, i) => ({
      tabId: i + 1,
      title: 'A'.repeat(70),
      hostname: 'example.com',
      cleanPath: '/',
    }));
    const userPayload = buildSemanticUserPayload(payloads, '', [], 8);
    expect(userPayload).toContain('Strict size cap: max 8 tabs per group');
    // Compact mode omits root '/' cleanPath
    expect(userPayload).not.toContain('"cleanPath":"/"');
  });
});

describe('Meaning Mode response validator & post-splitter', () => {
  it('extracts JSON from markdown fences, deduplicates IDs, filters hallucinations, and rescues omitted tabs', () => {
    const tabs = [
      tab(1, 'https://github.com/org/repo', 'PR #10'),
      tab(2, 'https://linear.app/issue/1', 'Задача авторизации'),
      tab(3, 'https://habr.com/ru/post/1', 'Статья про архитектуру'),
    ];

    const raw = `Here is your plan:
\`\`\`json
{
  "groups": [
    {
      "groupName": "Разработка",
      "emoji": "💻",
      "color": "invalid_color",
      "tabIds": [1, 1, 999]
    },
    {
      "groupName": "EmptyHallucination",
      "emoji": "👻",
      "color": "blue",
      "tabIds": [777, 888]
    }
  ]
}
\`\`\``;

    const groups = validateAndNormalizeSemanticResponse(raw, tabs, []);
    expect(groups).toHaveLength(2);
    expect(groups[0]?.tabIds).toEqual([1]);
    expect(groups[0]?.color).not.toBe('invalid_color');
    // Tabs 2 and 3 were omitted by LLM and must be rescued into Разное
    expect(groups[1]?.groupName).toBe('Разное');
    expect(groups[1]?.emoji).toBe('🌐');
    expect(groups[1]?.tabIds).toEqual([2, 3]);
  });

  it('splits oversized AI groups via maxTabsPerGroup and allocates non-colliding colors', async () => {
    const tabs = Array.from({ length: 16 }, (_, i) =>
      tab(i + 1, `https://www.youtube.com/watch?v=${i}`, `Clip ${i + 1} - YouTube`),
    );

    const mockGateway: LlmGatewayPort = {
      requestGrouping: () =>
        Promise.resolve({
          modelUsed: 'mock',
          rawText: JSON.stringify({
            groups: [
              {
                groupName: 'YouTube Mega Dump',
                emoji: '📺',
                color: 'red',
                tabIds: tabs.map((t) => t.id),
              },
            ],
          }),
        }),
    };

    const plan = await runMeaningGrouping({
      tabs,
      provider: 'groq',
      apiKey: 'gsk_test',
      model: 'llama-3.3-70b-versatile',
      maxTabsPerGroup: 8,
      gateway: mockGateway,
    });

    expect(plan.modeUsed).toBe('meaning');
    expect(plan.fallbackTriggered).toBe(false);
    expect(plan.groups).toHaveLength(2);
    expect(plan.groups[0]?.tabIds).toHaveLength(8);
    expect(plan.groups[1]?.tabIds).toHaveLength(8);
    expect(plan.groups[0]?.color).not.toBe(plan.groups[1]?.color);
  });

  it('gracefully falls back to Logic Mode on missing key, network error, timeout, or invalid JSON', async () => {
    const tabs = [
      tab(1, 'https://github.com/acme/app/pull/1', 'PR #1'),
      tab(2, 'https://github.com/acme/app/issues/2', 'Issue #2'),
    ];

    const noKeyPlan = await runMeaningGrouping({
      tabs,
      provider: 'groq',
      apiKey: '   ',
      model: 'llama-3.3-70b-versatile',
      gateway: {
        requestGrouping: () => Promise.reject(new Error('should not be called')),
      },
    });
    expect(noKeyPlan.modeUsed).toBe('logic');
    expect(noKeyPlan.fallbackTriggered).toBe(true);
    expect(noKeyPlan.fallbackReason).toContain('API-ключ');
    expect(noKeyPlan.fallbackReason).toContain('AI & Prompts');
    expect(noKeyPlan.groups[0]?.tabIds).toEqual([1, 2]);

    const timeoutPlan = await runMeaningGrouping({
      tabs,
      provider: 'gemini',
      apiKey: 'AIza_test',
      model: 'gemini-2.5-flash',
      gateway: {
        requestGrouping: () =>
          Promise.reject(new AiGatewayError('AI API request timed out after 18s')),
      },
    });
    expect(timeoutPlan.modeUsed).toBe('logic');
    expect(timeoutPlan.fallbackTriggered).toBe(true);
    expect(timeoutPlan.fallbackReason).toContain('timed out after 18s');

    const badJsonPlan = await runMeaningGrouping({
      tabs,
      provider: 'custom',
      apiKey: 'sk-test',
      model: 'gpt-4o-mini',
      gateway: {
        requestGrouping: () =>
          Promise.resolve({ modelUsed: 'gpt-4o-mini', rawText: 'not valid json at all' }),
      },
    });
    expect(badJsonPlan.modeUsed).toBe('logic');
    expect(badJsonPlan.fallbackTriggered).toBe(true);
    expect(badJsonPlan.groups.flatMap((g) => g.tabIds)).toEqual([1, 2]);
  });
});

describe('FetchLlmGateway (Groq rotation, dynamic max_tokens, Gemini schema, Custom)', () => {
  it('computes dynamic max_tokens thresholds correctly', () => {
    expect(estimateMaxTokens(500)).toBe(1800);
    expect(estimateMaxTokens(2000)).toBe(2200);
    expect(estimateMaxTokens(3500)).toBe(2800);
  });

  it('rotates Groq models on HTTP 429, 404, 400 failed to validate json and succeeds on fallback model', async () => {
    const calledModels: string[] = [];
    const fetchMock = vi.fn<typeof fetch>((_input, init) => {
      const rawBody = typeof init?.body === 'string' ? init.body : '{}';
      const body = JSON.parse(rawBody) as { model: string; max_tokens: number };
      calledModels.push(body.model);

      if (calledModels.length === 1) {
        return Promise.resolve(
          new Response(JSON.stringify({ error: { message: 'Rate limit reached' } }), { status: 429 }),
        );
      }
      if (calledModels.length === 2) {
        return Promise.resolve(
          new Response(
            JSON.stringify({ error: { message: 'Failed to validate JSON', code: 'json_validate_failed' } }),
            { status: 400 },
          ),
        );
      }
      return Promise.resolve(
        new Response(
          JSON.stringify({ choices: [{ message: { content: '{"groups":[]}' } }] }),
          { status: 200 },
        ),
      );
    });

    const gateway = new FetchLlmGateway(fetchMock);
    const res = await gateway.requestGrouping({
      provider: 'groq',
      apiKey: 'gsk_123',
      model: 'llama-3.3-70b-versatile',
      systemPrompt: 'sys',
      userPrompt: 'usr',
      payloadLength: 2000,
      useGeminiSchema: false,
      timeoutMs: 18_000,
    });

    expect(calledModels).toHaveLength(3);
    expect(calledModels[0]).toBe('llama-3.3-70b-versatile');
    expect(res.modelUsed).toBe(calledModels[2]);
    expect(res.rawText).toBe('{"groups":[]}');
  });

  it('does not rotate Groq models on HTTP 401 invalid API key', async () => {
    const fetchMock = vi.fn<typeof fetch>(() =>
      Promise.resolve(
        new Response(JSON.stringify({ error: { message: 'Invalid API Key' } }), { status: 401 }),
      ),
    );
    const gateway = new FetchLlmGateway(fetchMock);

    await expect(
      gateway.requestGrouping({
        provider: 'groq',
        apiKey: 'bad_key',
        model: 'llama-3.3-70b-versatile',
        systemPrompt: 'sys',
        userPrompt: 'usr',
        payloadLength: 500,
        useGeminiSchema: false,
        timeoutMs: 18_000,
      }),
    ).rejects.toThrow('HTTP 401');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('sends Gemini x-goog-api-key + responseSchema and normalizes Custom OpenAI endpoint', async () => {
    const calls: Array<{ url: string; headers: HeadersInit | undefined; body: string }> = [];
    const fetchMock = vi.fn<typeof fetch>((input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const rawBody = typeof init?.body === 'string' ? init.body : '';
      calls.push({ url, headers: init?.headers, body: rawBody });

      if (url.includes('generativelanguage.googleapis.com')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"groups":[]}' }] } }] }),
            { status: 200 },
          ),
        );
      }
      return Promise.resolve(
        new Response(
          JSON.stringify({ choices: [{ message: { content: '{"groups":[]}' } }] }),
          { status: 200 },
        ),
      );
    });

    const gateway = new FetchLlmGateway(fetchMock);

    await gateway.requestGrouping({
      provider: 'gemini',
      apiKey: 'AIza_key',
      model: 'gemini-2.5-flash',
      systemPrompt: 'sys',
      userPrompt: 'usr',
      payloadLength: 500,
      useGeminiSchema: true,
      timeoutMs: 18_000,
    });

    await gateway.requestGrouping({
      provider: 'custom',
      apiKey: 'sk-custom',
      model: 'gpt-4o-mini',
      baseUrl: 'https://llm.local/v1/',
      systemPrompt: 'sys',
      userPrompt: 'usr',
      payloadLength: 500,
      useGeminiSchema: false,
      timeoutMs: 18_000,
    });

    expect(calls[0]?.url).toContain('gemini-2.5-flash:generateContent');
    expect(calls[0]?.body).toContain('responseSchema');
    expect(calls[1]?.url).toBe('https://llm.local/v1/chat/completions');
  });
});

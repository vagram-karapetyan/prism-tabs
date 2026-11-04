import { describe, expect, it, vi } from 'vitest';
import {
  buildSemanticSystemPrompt,
  buildSemanticUserPayload,
  DEFAULT_PROMPT_PRESETS,
  extractJsonFromLlmOutput,
  runSemanticGrouping,
  sanitizeTabMetadata,
  SemanticCompletionClient,
  validateAndNormalizeSemanticResponse,
} from '../src/engine/semantic';
import {
  CHROME_TAB_GROUP_COLORS,
  ExistingTabGroup,
  TabMetadata,
} from '../src/engine/types';

describe('Semantic Engine — Privacy Sanitizer & Payload Builder', () => {
  it('strips query parameters, session tokens, and long UUIDs from URLs', () => {
    const sensitiveTab: TabMetadata = {
      id: 42,
      title: '   Checkout   Session   ',
      url: 'https://shop.example.com/orders/550e8400e29b41d4a7164466554400009999/confirm?token=secret_jwt_123&session_id=abc#frag',
    };

    const sanitized = sanitizeTabMetadata(sensitiveTab);
    expect(sanitized).not.toBeNull();
    expect(sanitized?.hostname).toBe('shop.example.com');
    expect(sanitized?.title).toBe('Checkout Session');
    expect(sanitized?.cleanPath).toBe('/orders/:id/confirm');
    expect(JSON.stringify(sanitized)).not.toContain('secret_jwt_123');
    expect(JSON.stringify(sanitized)).not.toContain('session_id');
  });

  it('returns null for internal chrome:// or file:// URLs', () => {
    expect(
      sanitizeTabMetadata({
        id: 1,
        title: 'Settings',
        url: 'chrome://settings/passwords',
      })
    ).toBeNull();
  });
});

describe('Semantic Engine — Custom User Prompt & Existing Groups Injection', () => {
  it('includes "✨ Smart Magic (Default)" as the single master preset in DEFAULT_PROMPT_PRESETS and injects properly', () => {
    expect(DEFAULT_PROMPT_PRESETS).toHaveLength(1);
    const magicPreset = DEFAULT_PROMPT_PRESETS[0];
    expect(magicPreset.id).toBe('preset-magic-smart');
    expect(magicPreset.label).toBe('✨ Smart Magic (Default)');
    expect(magicPreset.directive).toContain('YouTube Разное');
    expect(magicPreset.directive).toContain('Разное');
    expect(magicPreset.directive).toContain('cross-domain project intent');

    const prompt = buildSemanticSystemPrompt(magicPreset.directive);
    expect(prompt).toContain('<USER_SORTING_DIRECTIVES>');
    expect(prompt).toContain(magicPreset.directive);
    expect(prompt).toContain('YOUTUBE ISOLATION & CLUSTERING');
    expect(prompt).toContain('SINGLETON TAB SUPPRESSION');
  });

  it('dynamically injects custom user sorting directives into the system prompt', () => {
    const directive =
      'Cluster shopping tabs by gift recipient and strictly separate personal research from dev tickets.';
    const systemPrompt = buildSemanticSystemPrompt(directive);

    expect(systemPrompt).toContain('<USER_SORTING_DIRECTIVES>');
    expect(systemPrompt).toContain(directive);
    expect(systemPrompt).toContain('</USER_SORTING_DIRECTIVES>');
  });

  it('injects <EXISTING_TAB_GROUPS> into the system prompt and user payload for non-destructive smart merging', () => {
    const existingGroups: ExistingTabGroup[] = [
      {
        id: 12,
        title: '🐙 GitHub',
        cleanTitle: 'GitHub',
        emoji: '🐙',
        color: 'purple',
        collapsed: false,
        tabIds: [1, 2],
      },
    ];

    const systemPrompt = buildSemanticSystemPrompt('Group by task', existingGroups);
    expect(systemPrompt).toContain('<EXISTING_TAB_GROUPS>');
    expect(systemPrompt).toContain('existingGroupId=12');
    expect(systemPrompt).toContain('title="GitHub"');

    const payload = buildSemanticUserPayload(
      [
        {
          tabId: 3,
          title: 'PR #12',
          hostname: 'github.com',
          cleanPath: '/org/repo/pull/12',
        },
      ],
      'Group by task',
      existingGroups
    );

    expect(payload).toContain('"existingGroupId": 12');
    expect(payload).toContain('Apply user sorting directive: "Group by task"');
  });

  it('omits the custom directive block when directive is empty or whitespace', () => {
    const systemPrompt = buildSemanticSystemPrompt('   ');
    expect(systemPrompt).not.toContain('<USER_SORTING_DIRECTIVES>');
  });
});

describe('Semantic Engine — Multi-Provider JSON Extractor & Smart Merge Validator', () => {
  const sampleTabs: TabMetadata[] = [
    { id: 101, title: 'GitHub PR', url: 'https://github.com/a/b/pull/1' },
    { id: 102, title: 'Linear Issue', url: 'https://linear.app/team/issue/1' },
    { id: 103, title: 'Amazon Gift', url: 'https://amazon.com/dp/123' },
  ];

  it('extracts structured JSON reliably from Groq/Gemini/Custom outputs with markdown fences or conversational text', () => {
    const wrapped =
      'Here is the JSON result:\n```json\n{"groups":[{"groupName":"Dev","emoji":"💻","color":"blue","tabIds":[101,102,103]}]}\n```\nDone!';
    const parsed = extractJsonFromLlmOutput(wrapped) as { groups: unknown[] };
    expect(Array.isArray(parsed.groups)).toBe(true);
    expect(parsed.groups).toHaveLength(1);
  });

  it('merges ungrouped tabs into existing groups when AI provider returns matching existingGroupId', () => {
    const existingGroups: ExistingTabGroup[] = [
      {
        id: 50,
        title: '🔐 Auth Sprint',
        cleanTitle: 'Auth Sprint',
        emoji: '🔐',
        color: 'blue',
        collapsed: false,
        tabIds: [100],
      },
    ];

    const aiResponse = {
      groups: [
        {
          groupName: 'Auth Sprint',
          emoji: '🔐',
          color: 'blue',
          existingGroupId: 50,
          tabIds: [101, 102],
        },
        {
          groupName: 'Gifts',
          emoji: '🎁',
          color: 'pink',
          tabIds: [103],
        },
      ],
    };

    const groups = validateAndNormalizeSemanticResponse(
      aiResponse,
      sampleTabs,
      existingGroups
    );

    expect(groups).toHaveLength(2);
    expect(groups[0].existingGroupId).toBe(50);
    expect(groups[0].existingTabIds).toEqual([100]);
    expect(groups[0].addedTabIds).toEqual([101, 102]);
    expect(groups[0].tabIds).toEqual([100, 101, 102]);

    expect(groups[1].groupName).toBe('Gifts');
    expect(groups[1].existingGroupId).toBeUndefined();
    expect(groups[1].tabIds).toEqual([103]);
  });

  it('normalizes invalid colors, deduplicates tabIds, filters hallucinated IDs, and rescues omitted tabs', () => {
    const messyResponse = JSON.stringify({
      groups: [
        {
          groupName: 'Dev Task',
          emoji: '🛠️',
          color: 'chartreuse-invalid-color',
          tabIds: [101, 101, 99999],
        },
      ],
    });

    const groups = validateAndNormalizeSemanticResponse(messyResponse, sampleTabs);
    expect(groups).toHaveLength(2);
    expect(groups[0].tabIds).toEqual([101]);
    expect(CHROME_TAB_GROUP_COLORS).toContain(groups[0].color);
    expect(groups[1].groupName).toBe('Other Tabs');
    expect(groups[1].tabIds).toEqual([102, 103]);
  });
});

describe('Semantic Engine — Multi-Provider Execution & Graceful Fallback', () => {
  const tabs: TabMetadata[] = [
    { id: 1, title: 'GitHub 1', url: 'https://github.com/org/repo/1' },
    { id: 2, title: 'GitHub 2', url: 'https://github.com/org/repo/2' },
  ];

  it('executes with Groq provider and passes provider parameters to client', async () => {
    const mockClient: SemanticCompletionClient = {
      generateGroups: vi.fn().mockResolvedValue({
        groups: [
          {
            groupName: 'Core Repo',
            emoji: '🚀',
            color: 'purple',
            tabIds: [1, 2],
          },
        ],
      }),
    };

    const plan = await runSemanticGrouping({
      tabs,
      provider: 'groq',
      apiKey: 'gsk_test_key_123',
      model: 'llama-3.3-70b-versatile',
      client: mockClient,
    });

    expect(plan.modeUsed).toBe('meaning');
    expect(plan.fallbackTriggered).toBe(false);
    expect(plan.groups[0].groupName).toBe('Core Repo');
    expect(mockClient.generateGroups).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'groq',
        apiKey: 'gsk_test_key_123',
        model: 'llama-3.3-70b-versatile',
      })
    );
  });

  it('gracefully falls back to deterministic Logic Mode when API key is missing or HTTP 429 occurs', async () => {
    const failingClient: SemanticCompletionClient = {
      generateGroups: vi
        .fn()
        .mockRejectedValue(new Error('Groq API rate limit exceeded (HTTP 429)')),
    };

    const plan = await runSemanticGrouping({
      tabs,
      provider: 'groq',
      apiKey: 'gsk_test_key',
      model: 'llama-3.3-70b-versatile',
      client: failingClient,
    });

    expect(plan.fallbackTriggered).toBe(true);
    expect(plan.fallbackReason).toContain('HTTP 429');
    expect(plan.modeUsed).toBe('logic');
    expect(plan.groups[0].tabIds).toEqual([1, 2]);
  });

  it('includes detailed provider error message in fallbackReason when Gemini API fails', async () => {
    const failingGeminiClient: SemanticCompletionClient = {
      generateGroups: vi
        .fn()
        .mockRejectedValue(
          new Error('Gemini API authentication or request error (HTTP 400): API key not valid')
        ),
    };

    const plan = await runSemanticGrouping({
      tabs,
      provider: 'gemini',
      apiKey: 'invalid_gemini_key',
      model: 'gemini-2.5-flash',
      client: failingGeminiClient,
    });

    expect(plan.fallbackTriggered).toBe(true);
    expect(plan.fallbackReason).toContain('API key not valid');
    expect(plan.modeUsed).toBe('logic');
  });
});

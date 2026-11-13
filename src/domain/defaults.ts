import type {
  CustomPromptPreset,
  DeterministicOptions,
  DeterministicRule,
  PrismSettings,
} from './types';

export const DEFAULT_MAX_TABS_PER_GROUP = 8 as const;

export const MAX_TABS_PER_GROUP_PRESETS = [6, 8, 10, 12, null] as const;

export const DEFAULT_PROMPT_PRESETS: readonly CustomPromptPreset[] = [
  {
    id: 'preset-magic-smart',
    label: '✨ Smart Magic (Default)',
    directive:
      'Group tabs by cross-domain project intent (code + PR + docs + tickets together). Strictly separate work from personal entertainment and shopping. Keep each group focused and compact within the maxTabsPerGroup limit. Isolate YouTube videos into tight topic groups (Gaming, Coding, Music), sending orphan videos into "YouTube Разное". Group remaining orphan web tabs into "Разное" to prevent 1-tab clutter. Match group titles to tab language (Russian for Russian tabs).',
  },
];

export const DEFAULT_DETERMINISTIC_OPTIONS: DeterministicOptions = {
  mergeSubdomains: true,
  groupByFirstPathSegment: false,
  minTabsPerGroup: 2,
  groupSingletonsIntoMisc: false,
  ignorePinnedTabs: true,
  preserveExistingGroups: true,
};

export const DEFAULT_DETERMINISTIC_RULES: readonly DeterministicRule[] = [
  {
    id: 'rule-dev-code',
    name: 'Code & Dev',
    emoji: '💻',
    color: 'purple',
    matchTarget: 'hostname',
    pattern: 'bitbucket.org, stackoverflow.com, localhost, 127.0.0.1',
    isRegex: false,
    priority: 20,
    enabled: false,
  },
  {
    id: 'rule-docs-workspace',
    name: 'Docs & Notes',
    emoji: '📄',
    color: 'blue',
    matchTarget: 'url',
    pattern: '(notion\\.so|confluence|readthedocs|developer\\.mozilla\\.org)',
    isRegex: true,
    priority: 30,
    enabled: false,
  },
  {
    id: 'rule-design-product',
    name: 'Design & Tasks',
    emoji: '🎨',
    color: 'pink',
    matchTarget: 'hostname',
    pattern: 'figma.com, linear.app, jira.atlassian.com, trello.com, miro.com',
    isRegex: false,
    priority: 40,
    enabled: false,
  },
  {
    id: 'rule-media-video',
    name: 'Media & Audio',
    emoji: '🎧',
    color: 'red',
    matchTarget: 'hostname',
    pattern: 'youtube.com, twitch.tv, netflix.com, open.spotify.com, soundcloud.com',
    isRegex: false,
    priority: 50,
    enabled: false,
  },
];

export function createDefaultSettings(): PrismSettings {
  return {
    theme: 'prism-deep',
    mode: 'logic',
    aiProvider: 'groq',
    groqApiKey: '',
    groqModel: 'llama-3.3-70b-versatile',
    geminiApiKey: '',
    geminiModel: 'gemini-2.5-flash',
    customApiKey: '',
    customBaseUrl: 'https://api.openai.com/v1',
    customModel: 'gpt-4o-mini',
    customPromptDirective: DEFAULT_PROMPT_PRESETS[0]?.directive ?? '',
    promptPresets: DEFAULT_PROMPT_PRESETS.map((p) => ({ ...p })),
    collapseOthersOnGroup: true,
    closeEmptyTabs: true,
    closeYouTubeHomeTabs: false,
    discardInactiveTabs: false,
    maxTabsPerGroup: DEFAULT_MAX_TABS_PER_GROUP,
    deterministicOptions: { ...DEFAULT_DETERMINISTIC_OPTIONS },
    customRules: DEFAULT_DETERMINISTIC_RULES.map((r) => ({ ...r })),
  };
}

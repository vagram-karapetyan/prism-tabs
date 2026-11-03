export const CHROME_TAB_GROUP_COLORS = [
  'grey',
  'blue',
  'red',
  'yellow',
  'green',
  'pink',
  'purple',
  'cyan',
  'orange',
] as const;

export type ChromeTabGroupColor = (typeof CHROME_TAB_GROUP_COLORS)[number];

export type EngineMode = 'logic' | 'meaning';

export type AiProvider = 'groq' | 'gemini' | 'custom';

export type GroqModelId =
  | 'llama-3.3-70b-versatile'
  | 'openai/gpt-oss-120b'
  | 'openai/gpt-oss-20b'
  | 'qwen/qwen3.8-27b'
  | 'llama-3.1-8b-instant';

export type GeminiModelId =
  | 'gemini-2.5-flash'
  | 'gemini-2.5-flash-lite'
  | 'gemini-2.0-flash';

export interface TabMetadata {
  id: number;
  title: string;
  url: string;
  favIconUrl?: string;
  pinned?: boolean;
  groupId?: number;
  openerTabId?: number;
  /** Tab index in the browser window (used for positional/temporal proximity scoring) */
  index?: number;
  /** Timestamp (ms) when tab was last accessed/created */
  lastAccessed?: number;
  metaDescription?: string;
}

export interface ExistingTabGroup {
  id: number;
  title: string;
  /** Group title with any leading emoji stripped for semantic/domain matching */
  cleanTitle: string;
  emoji?: string;
  color: ChromeTabGroupColor;
  collapsed: boolean;
  tabIds: number[];
}

export interface SanitizedTabPayload {
  tabId: number;
  title: string;
  hostname: string;
  cleanPath: string;
  metaDescription?: string;
}

export type RuleMatchTarget = 'hostname' | 'url' | 'path' | 'title';

export interface DeterministicRule {
  id: string;
  name: string;
  emoji: string;
  color: ChromeTabGroupColor;
  matchTarget: RuleMatchTarget;
  /** Regex pattern or comma-separated domain/path patterns */
  pattern: string;
  isRegex: boolean;
  /** Lower number = higher priority */
  priority: number;
  enabled: boolean;
}

export interface DeterministicOptions {
  mergeSubdomains: boolean;
  groupByFirstPathSegment: boolean;
  minTabsPerGroup: number;
  groupSingletonsIntoMisc: boolean;
  ignorePinnedTabs: boolean;
  preserveExistingGroups: boolean;
}

export type GroupSource =
  | 'existing-merge'
  | 'rule'
  | 'platform'
  | 'domain'
  | 'opener'
  | 'title-nlp'
  | 'context-chain'
  | 'semantic'
  | 'fallback';

export interface ProposedTabGroup {
  id: string;
  groupName: string;
  emoji: string;
  color: ChromeTabGroupColor;
  tabIds: number[];
  /** Present when this group preserves/extends an existing or newly created Chrome Tab Group */
  existingGroupId?: number;
  /** Tabs already inside the existing group prior to sorting */
  existingTabIds?: number[];
  /** Newly matched ungrouped tabs to be merged into the existing group */
  addedTabIds?: number[];
  source: GroupSource;
  reasoning?: string;
}

export interface GroupingPlan {
  modeUsed: EngineMode;
  fallbackTriggered: boolean;
  fallbackReason?: string;
  groups: ProposedTabGroup[];
  ungroupedTabIds: number[];
  latencyMs: number;
}

export interface SortChoreographyProgress {
  activeGroupId: string | null;
  activeTabId: number | null;
  completedGroupIds: string[];
  completedGroups: number;
  totalGroups: number;
  progressRatio: number;
  phase: 'idle' | 'gliding' | 'merging' | 'grouping' | 'complete';
}

export interface CustomPromptPreset {
  id: string;
  label: string;
  directive: string;
}

export interface TabUndoEntry {
  tabId: number;
  index: number;
  previousGroupId: number;
  groupTitle?: string;
  groupColor?: ChromeTabGroupColor;
  groupCollapsed?: boolean;
}

export interface UndoSnapshot {
  timestamp: number;
  windowId: number;
  entries: TabUndoEntry[];
}

export type PrismThemeId =
  | 'prism-deep'
  | 'midnight-nebula'
  | 'emerald-forest'
  | 'sunset-amber'
  | 'arctic-frost'
  | 'pure-light';

export interface PrismSettings {
  /** Visual theme for the popup interface (default: 'prism-deep') */
  theme?: PrismThemeId;
  mode: EngineMode;
  /** Active AI provider for Meaning Mode ('groq' recommended by default) */
  aiProvider: AiProvider;
  groqApiKey: string;
  groqModel: GroqModelId;
  geminiApiKey: string;
  geminiModel: GeminiModelId;
  customApiKey: string;
  customBaseUrl: string;
  customModel: string;
  customPromptDirective: string;
  promptPresets: CustomPromptPreset[];
  collapseOthersOnGroup: boolean;
  /** Automatically close blank/New Tab pages in the current window after grouping (default: true) */
  closeEmptyTabs: boolean;
  /** Automatically close unpinned YouTube homepage tabs (https://www.youtube.com/) during grouping */
  closeYouTubeHomeTabs: boolean;
  deterministicOptions: DeterministicOptions;
  customRules: DeterministicRule[];
}

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

export const GROQ_MODEL_POOL = [
  'llama-3.3-70b-versatile',
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
  'qwen/qwen3.8-27b',
  'llama-3.1-8b-instant',
] as const;

export type GroqModelId = (typeof GROQ_MODEL_POOL)[number];

export const GEMINI_MODEL_POOL = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash',
] as const;

export type GeminiModelId = (typeof GEMINI_MODEL_POOL)[number];

export const THEME_IDS = [
  'system',
  'prism-deep',
  'midnight-nebula',
  'emerald-forest',
  'sunset-amber',
  'arctic-frost',
  'pure-light',
] as const;

export type ThemeId = (typeof THEME_IDS)[number];

export type ConcreteThemeId = Exclude<ThemeId, 'system'>;

export interface TabMetadata {
  id: number;
  title: string;
  url: string;
  favIconUrl?: string;
  pinned?: boolean;
  active?: boolean;
  audible?: boolean;
  discarded?: boolean;
  groupId?: number;
  openerTabId?: number;
  /** Tab index in the browser window (used for positional/temporal proximity scoring). */
  index?: number;
  /** Timestamp (ms) when tab was last accessed/created. */
  lastAccessed?: number;
}

export interface ExistingTabGroup {
  id: number;
  title: string;
  /** Group title with any leading emoji stripped for semantic/domain matching. */
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
}

export const RULE_MATCH_TARGETS = ['hostname', 'url', 'path', 'title'] as const;

export type RuleMatchTarget = (typeof RULE_MATCH_TARGETS)[number];

export interface DeterministicRule {
  id: string;
  name: string;
  emoji: string;
  color: ChromeTabGroupColor;
  matchTarget: RuleMatchTarget;
  /** Regex pattern or comma-separated domain/path/title patterns. */
  pattern: string;
  isRegex: boolean;
  /** Lower number = higher priority (< 10 evaluates before platform clusters). */
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
  | 'split'
  | 'fallback';

export interface ProposedGroup {
  id: string;
  groupName: string;
  emoji: string;
  color: ChromeTabGroupColor;
  tabIds: number[];
  /** Present when this group preserves/extends an existing Chrome Tab Group. */
  existingGroupId?: number;
  /** Tabs already inside the existing group prior to sorting. */
  existingTabIds?: number[];
  /** Newly matched ungrouped tabs to be merged into the existing group. */
  addedTabIds?: number[];
  source: GroupSource;
  reasoning?: string;
}

export interface GroupingPlan {
  modeUsed: EngineMode;
  fallbackTriggered: boolean;
  fallbackReason?: string;
  groups: ProposedGroup[];
  ungroupedTabIds: number[];
  latencyMs: number;
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

export type MaxTabsPerGroup = number | null;

export interface PrismSettings {
  theme: ThemeId;
  mode: EngineMode;
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
  closeEmptyTabs: boolean;
  closeYouTubeHomeTabs: boolean;
  discardInactiveTabs: boolean;
  /** Maximum tabs allowed per group before post-splitting; null disables limit. */
  maxTabsPerGroup: MaxTabsPerGroup;
  deterministicOptions: DeterministicOptions;
  customRules: DeterministicRule[];
}

export interface PrismExportConfig {
  version: 1 | 2;
  schemaVersion?: 2;
  exportedAt: string;
  theme?: ThemeId;
  mode?: EngineMode;
  aiProvider?: AiProvider;
  groqModel?: GroqModelId;
  geminiModel?: GeminiModelId;
  customBaseUrl?: string;
  customModel?: string;
  customPromptDirective?: string;
  promptPresets?: CustomPromptPreset[];
  collapseOthersOnGroup?: boolean;
  closeEmptyTabs?: boolean;
  closeYouTubeHomeTabs?: boolean;
  discardInactiveTabs?: boolean;
  maxTabsPerGroup?: MaxTabsPerGroup;
  deterministicOptions?: Partial<DeterministicOptions>;
  customRules?: DeterministicRule[];
}

export interface SortWindowResult {
  plan: GroupingPlan;
  closedTabsCount: number;
  discardedTabsCount: number;
  collapsedGroupsCount: number;
  estimatedRamSavedMb: number;
  appliedGroupIds: Record<string, number>;
}

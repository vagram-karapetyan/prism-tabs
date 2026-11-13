import type { ChromeTabGroupColor } from '../../domain/types';
import type { ConceptId } from './topic-taxonomy';

export interface BrandMeta {
  label: string;
  emoji: string;
  color: ChromeTabGroupColor;
  /** Unifies aliases/mirrors (e.g. x.com & twitter.com, ozon.ru & wildberries.ru) into one bucket. */
  canonicalKey?: string;
  conceptId?: ConceptId;
}

export const KNOWN_BRAND_NAMES: Readonly<Record<string, BrandMeta>> = {
  // Dev & Code
  'github.com': { label: 'GitHub', emoji: '🐙', color: 'purple', canonicalKey: 'brand:github', conceptId: 'dev' },
  'gitlab.com': { label: 'GitLab', emoji: '🦊', color: 'orange', canonicalKey: 'brand:gitlab', conceptId: 'dev' },
  'bitbucket.org': { label: 'Bitbucket', emoji: '🪣', color: 'blue', canonicalKey: 'brand:bitbucket', conceptId: 'dev' },
  'stackoverflow.com': { label: 'Stack Overflow', emoji: '🥞', color: 'orange', canonicalKey: 'brand:stackoverflow', conceptId: 'dev' },
  'developer.mozilla.org': { label: 'MDN Docs', emoji: '📘', color: 'blue', canonicalKey: 'brand:mdn', conceptId: 'dev' },
  'typescriptlang.org': { label: 'TypeScript', emoji: '📘', color: 'blue', canonicalKey: 'brand:typescript', conceptId: 'dev' },
  'react.dev': { label: 'React Docs', emoji: '⚛️', color: 'cyan', canonicalKey: 'brand:react', conceptId: 'dev' },
  'vuejs.org': { label: 'Vue Docs', emoji: '💚', color: 'green', canonicalKey: 'brand:vue', conceptId: 'dev' },
  'vitejs.dev': { label: 'Vite', emoji: '⚡', color: 'purple', canonicalKey: 'brand:vite', conceptId: 'dev' },
  'npmjs.com': { label: 'npm', emoji: '📦', color: 'red', canonicalKey: 'brand:npm', conceptId: 'dev' },
  'pypi.org': { label: 'PyPI', emoji: '🐍', color: 'blue', canonicalKey: 'brand:pypi', conceptId: 'dev' },
  'crates.io': { label: 'Crates.io', emoji: '🦀', color: 'orange', canonicalKey: 'brand:crates', conceptId: 'dev' },
  'docs.rs': { label: 'Docs.rs', emoji: '🦀', color: 'orange', canonicalKey: 'brand:docsrs', conceptId: 'dev' },
  localhost: { label: 'Local Dev', emoji: '🛠️', color: 'green', canonicalKey: 'brand:local-dev', conceptId: 'dev' },
  '127.0.0.1': { label: 'Local Dev', emoji: '🛠️', color: 'green', canonicalKey: 'brand:local-dev', conceptId: 'dev' },

  // Cloud & Infra
  'vercel.com': { label: 'Vercel', emoji: '▲', color: 'cyan', canonicalKey: 'brand:vercel', conceptId: 'devops' },
  'netlify.com': { label: 'Netlify', emoji: '🌐', color: 'cyan', canonicalKey: 'brand:netlify', conceptId: 'devops' },
  'cloudflare.com': { label: 'Cloudflare', emoji: '☁️', color: 'orange', canonicalKey: 'brand:cloudflare', conceptId: 'devops' },
  'aws.amazon.com': { label: 'AWS', emoji: '☁️', color: 'orange', canonicalKey: 'brand:aws', conceptId: 'devops' },
  'console.cloud.google.com': { label: 'GCP', emoji: '☁️', color: 'blue', canonicalKey: 'brand:gcp', conceptId: 'devops' },
  'supabase.com': { label: 'Supabase', emoji: '⚡', color: 'green', canonicalKey: 'brand:supabase', conceptId: 'devops' },
  'docker.com': { label: 'Docker', emoji: '🐳', color: 'blue', canonicalKey: 'brand:docker', conceptId: 'devops' },

  // AI & LLM
  'chatgpt.com': { label: 'ChatGPT', emoji: '🤖', color: 'green', canonicalKey: 'brand:chatgpt', conceptId: 'ai' },
  'chat.openai.com': { label: 'ChatGPT', emoji: '🤖', color: 'green', canonicalKey: 'brand:chatgpt', conceptId: 'ai' },
  'openai.com': { label: 'OpenAI', emoji: '🤖', color: 'green', canonicalKey: 'brand:openai', conceptId: 'ai' },
  'platform.openai.com': { label: 'OpenAI API', emoji: '🤖', color: 'green', canonicalKey: 'brand:openai', conceptId: 'ai' },
  'claude.ai': { label: 'Claude', emoji: '🧡', color: 'orange', canonicalKey: 'brand:claude', conceptId: 'ai' },
  'anthropic.com': { label: 'Anthropic', emoji: '🧡', color: 'orange', canonicalKey: 'brand:claude', conceptId: 'ai' },
  'groq.com': { label: 'Groq', emoji: '⚡', color: 'orange', canonicalKey: 'brand:groq', conceptId: 'ai' },
  'console.groq.com': { label: 'Groq', emoji: '⚡', color: 'orange', canonicalKey: 'brand:groq', conceptId: 'ai' },
  'gemini.google.com': { label: 'Gemini', emoji: '✨', color: 'blue', canonicalKey: 'brand:gemini', conceptId: 'ai' },
  'aistudio.google.com': { label: 'AI Studio', emoji: '✨', color: 'blue', canonicalKey: 'brand:aistudio', conceptId: 'ai' },
  'deepseek.com': { label: 'DeepSeek', emoji: '🤖', color: 'blue', canonicalKey: 'brand:deepseek', conceptId: 'ai' },
  'huggingface.co': { label: 'Hugging Face', emoji: '🤗', color: 'yellow', canonicalKey: 'brand:huggingface', conceptId: 'ai' },
  'openrouter.ai': { label: 'OpenRouter', emoji: '🤖', color: 'purple', canonicalKey: 'brand:openrouter', conceptId: 'ai' },

  // Productivity & Design
  'figma.com': { label: 'Figma', emoji: '🎨', color: 'pink', canonicalKey: 'brand:figma', conceptId: 'design' },
  'notion.so': { label: 'Notion', emoji: '📓', color: 'grey', canonicalKey: 'brand:notion' },
  'linear.app': { label: 'Linear', emoji: '📐', color: 'purple', canonicalKey: 'brand:linear', conceptId: 'dev' },
  'miro.com': { label: 'Miro', emoji: '🗂️', color: 'yellow', canonicalKey: 'brand:miro', conceptId: 'design' },
  'mail.google.com': { label: 'Gmail', emoji: '✉️', color: 'red', canonicalKey: 'brand:gmail' },
  'drive.google.com': { label: 'Google Drive', emoji: '📁', color: 'blue', canonicalKey: 'brand:gdrive' },
  'calendar.google.com': { label: 'Calendar', emoji: '📅', color: 'blue', canonicalKey: 'brand:gcal' },

  // Search, Knowledge & Media
  'google.com': { label: 'Google', emoji: '🔍', color: 'blue', canonicalKey: 'brand:google' },
  'youtube.com': { label: 'YouTube', emoji: '🎬', color: 'red', canonicalKey: 'brand:youtube' },
  'open.spotify.com': { label: 'Music & Audio', emoji: '🎧', color: 'green', canonicalKey: 'brand:spotify', conceptId: 'music' },
  'music.youtube.com': { label: 'Music & Audio', emoji: '🎧', color: 'red', canonicalKey: 'brand:ytmusic', conceptId: 'music' },
  'music.yandex.ru': { label: 'Music & Audio', emoji: '🎧', color: 'yellow', canonicalKey: 'brand:ymusic', conceptId: 'music' },
  'wikipedia.org': { label: 'Wikipedia', emoji: '📚', color: 'grey', canonicalKey: 'brand:wikipedia' },
  'arxiv.org': { label: 'arXiv', emoji: '📄', color: 'red', canonicalKey: 'brand:arxiv', conceptId: 'science' },
  'medium.com': { label: 'Medium', emoji: '📝', color: 'grey', canonicalKey: 'brand:medium' },
  'habr.com': { label: 'Habr', emoji: '🤓', color: 'cyan', canonicalKey: 'brand:habr', conceptId: 'dev' },
  'career.habr.com': { label: 'Хабр Карьера', emoji: '💼', color: 'blue', canonicalKey: 'brand:habr-career', conceptId: 'career' },
  'vc.ru': { label: 'VC.ru', emoji: '📰', color: 'blue', canonicalKey: 'brand:vc' },
  'dtf.ru': { label: 'DTF', emoji: '🎮', color: 'purple', canonicalKey: 'brand:dtf', conceptId: 'gaming' },
  'kinopoisk.ru': { label: 'Кинопоиск', emoji: '🎬', color: 'orange', canonicalKey: 'brand:kinopoisk', conceptId: 'cinema' },

  // Social & Community
  'reddit.com': { label: 'Reddit', emoji: '👽', color: 'orange', canonicalKey: 'brand:reddit' },
  'news.ycombinator.com': { label: 'Hacker News', emoji: '🟧', color: 'orange', canonicalKey: 'brand:hn', conceptId: 'dev' },
  'x.com': { label: 'X (Twitter)', emoji: '🐦', color: 'blue', canonicalKey: 'brand:x' },
  'twitter.com': { label: 'X (Twitter)', emoji: '🐦', color: 'blue', canonicalKey: 'brand:x' },
  'telegram.org': { label: 'Telegram', emoji: '✈️', color: 'cyan', canonicalKey: 'brand:telegram' },
  'web.telegram.org': { label: 'Telegram', emoji: '✈️', color: 'cyan', canonicalKey: 'brand:telegram' },
  'vk.com': { label: 'VK', emoji: '🔵', color: 'blue', canonicalKey: 'brand:vk' },
  'discord.com': { label: 'Discord', emoji: '🎮', color: 'purple', canonicalKey: 'brand:discord' },

  // Shopping & Marketplaces
  'amazon.com': { label: 'Amazon', emoji: '📦', color: 'yellow', canonicalKey: 'brand:amazon', conceptId: 'shopping' },
  'wildberries.ru': { label: 'Wildberries', emoji: '🛍️', color: 'purple', canonicalKey: 'brand:wildberries', conceptId: 'shopping' },
  'ozon.ru': { label: 'Ozon', emoji: '🛍️', color: 'blue', canonicalKey: 'brand:ozon', conceptId: 'shopping' },
  'market.yandex.ru': { label: 'Яндекс Маркет', emoji: '🛍️', color: 'yellow', canonicalKey: 'brand:ymarket', conceptId: 'shopping' },
  'megamarket.ru': { label: 'Мегамаркет', emoji: '🛍️', color: 'purple', canonicalKey: 'brand:megamarket', conceptId: 'shopping' },
  'dns-shop.ru': { label: 'DNS', emoji: '🛍️', color: 'orange', canonicalKey: 'brand:dns', conceptId: 'shopping' },
  'avito.ru': { label: 'Авито', emoji: '🛍️', color: 'green', canonicalKey: 'brand:avito', conceptId: 'shopping' },
  'aliexpress.com': { label: 'AliExpress', emoji: '🛍️', color: 'orange', canonicalKey: 'brand:aliexpress', conceptId: 'shopping' },
  'aliexpress.ru': { label: 'AliExpress', emoji: '🛍️', color: 'orange', canonicalKey: 'brand:aliexpress', conceptId: 'shopping' },

  // Career & Finance
  'hh.ru': { label: 'hh.ru', emoji: '💼', color: 'red', canonicalKey: 'brand:hh', conceptId: 'career' },
  'linkedin.com': { label: 'LinkedIn', emoji: '💼', color: 'blue', canonicalKey: 'brand:linkedin', conceptId: 'career' },
  'leetcode.com': { label: 'LeetCode', emoji: '💻', color: 'yellow', canonicalKey: 'brand:leetcode', conceptId: 'career' },
  'tbank.ru': { label: 'Т-Банк', emoji: '🏦', color: 'yellow', canonicalKey: 'brand:tbank', conceptId: 'finance' },
  'tinkoff.ru': { label: 'Т-Банк', emoji: '🏦', color: 'yellow', canonicalKey: 'brand:tbank', conceptId: 'finance' },
  'sberbank.ru': { label: 'СберБанк', emoji: '🏦', color: 'green', canonicalKey: 'brand:sber', conceptId: 'finance' },
};

import type { ChromeTabGroupColor, TabMetadata } from '../../domain/types';
import { hasCyrillicText, type ExtractedDomainInfo } from '../shared/url-classifier';

export type ConceptId =
  | 'ai'
  | 'dev'
  | 'devops'
  | 'design'
  | 'gaming'
  | 'music'
  | 'hardware'
  | 'science'
  | 'finance'
  | 'career'
  | 'cooking'
  | 'travel'
  | 'cinema'
  | 'auto'
  | 'health'
  | 'language'
  | 'shopping'
  | 'news';

export interface ConceptDefinition {
  id: ConceptId;
  labelRu: string;
  labelEn: string;
  shortRu: string;
  shortEn: string;
  emoji: string;
  color: ChromeTabGroupColor;
  hosts: ReadonlySet<string>;
  strongPhrases?: readonly string[];
  phrases: readonly string[];
  stems: readonly string[];
  exactWords: ReadonlySet<string>;
  mediumTerms?: readonly string[];
  secondaryTerms: readonly string[];
}

export const CONCEPT_DEFINITIONS: readonly ConceptDefinition[] = [
  {
    id: 'ai',
    labelRu: 'ИИ и нейросети',
    labelEn: 'AI & LLM',
    shortRu: 'ИИ',
    shortEn: 'AI',
    emoji: '🤖',
    color: 'green',
    hosts: new Set([
      'groq.com',
      'console.groq.com',
      'chatgpt.com',
      'chat.openai.com',
      'openai.com',
      'platform.openai.com',
      'claude.ai',
      'anthropic.com',
      'gemini.google.com',
      'aistudio.google.com',
      'huggingface.co',
      'openrouter.ai',
      'deepseek.com',
      'chat.deepseek.com',
      'mistral.ai',
      'poe.com',
      'replicate.com',
      'cohere.com',
      'cursor.com',
      'v0.dev',
      'bolt.new',
      'lovable.dev',
      'midjourney.com',
      'civitai.com',
      'ollama.com',
      'lmstudio.ai',
      'elevenlabs.io',
      'suno.com',
      'runwayml.com',
      'character.ai',
      'notebooklm.google.com',
      'vllm.ai',
      'langchain.com',
    ]),
    strongPhrases: [
      'claude code',
      'claude sonnet',
      'claude opus',
      'claude haiku',
      'cursor ai',
      'github copilot',
      'openai o3',
      'deepseek r1',
    ],
    phrases: [
      'ai agent',
      'ai agents',
      'ai coding',
      'ai factory',
      'multi agent',
      'mcp server',
      'mcp сервер',
      'mcp-сервер',
      'mcp протокол',
      'computer use',
      'tool use',
      'function calling',
      'ии агент',
      'ии-агент',
      'ai-агент',
      'искусственн интеллект',
      'искусственного интеллекта',
      'машинн обучен',
      'machine learning',
      'deep learning',
      'reinforcement learning',
      'computer vision',
      'neural network',
      'neural networks',
      'neural net',
      'neural nets',
      'diffusion model',
      'stable diffusion',
      'chain of thought',
      'context window',
      'system prompt',
      'нейронн сет',
      'нейронные сети',
      'нейронная сеть',
      'нейронной сети',
      'большая языков',
      'большие языков',
      'language model',
      'vibe coding',
      'вайб код',
      'вайбкод',
      'fine tuning',
      'fine-tuning',
      'prompt engineering',
    ],
    stems: [
      'нейросет',
      'нейросетев',
      'нейронк',
      'chatgpt',
      'openai',
      'claude',
      'anthropic',
      'антропик',
      'gemini',
      'deepseek',
      'дипсик',
      'чатгпт',
      'mistral',
      'llama',
      'langgraph',
      'langchain',
      'huggingface',
      'openrouter',
      'perplexity',
      'midjourney',
      'windsurf',
      'промпт',
      'промт',
      'генеративн',
      'трансформер',
      'transformer',
      'ollama',
      'lmstudio',
      'elevenlabs',
      'reasoning',
      'agentic',
      'агентн',
      'мультиагент',
      'quantiz',
      'квантиз',
      'диффузи',
      'инференс',
      'copilot',
      'эмбеддинг',
      'embedding',
      'tokeniz',
    ],
    exactWords: new Set([
      'ai',
      'ии',
      'llm',
      'llms',
      'gpt',
      'gpt4',
      'gpt5',
      'ml',
      'nlp',
      'rag',
      'mcp',
      'lora',
      'qlora',
      'gguf',
      'vllm',
      'sonnet',
      'opus',
      'haiku',
      'suno',
      'groq',
      'grok',
      'qwen',
      'gemma',
      'sora',
      'cursor',
      'cline',
      'aider',
      'codex',
      'notebooklm',
      'crewai',
      'autogen',
      'xai',
      'karpathy',
      'карпатый',
      'карпатого',
      'агент',
      'агенты',
      'агентов',
      'agent',
      'agents',
      'токены',
      'токенов',
      'нейросеть',
      'нейросети',
      'нейросетей',
      'нейронка',
      'нейронки',
      'нейронок',
    ]),
    secondaryTerms: ['модел', 'model', 'models', 'weights', 'benchmark', 'training', 'обучен', 'локально'],
  },
  {
    id: 'dev',
    labelRu: 'Разработка',
    labelEn: 'Coding & Dev',
    shortRu: 'Разработка',
    shortEn: 'Dev',
    emoji: '💻',
    color: 'purple',
    hosts: new Set([
      'github.com',
      'gitlab.com',
      'bitbucket.org',
      'stackoverflow.com',
      'stackexchange.com',
      'developer.mozilla.org',
      'npmjs.com',
      'pypi.org',
      'crates.io',
      'docs.rs',
      'pkg.go.dev',
      'typescriptlang.org',
      'react.dev',
      'preactjs.com',
      'vuejs.org',
      'svelte.dev',
      'nextjs.org',
      'vitejs.dev',
      'nodejs.org',
      'python.org',
      'rust-lang.org',
      'codepen.io',
      'codesandbox.io',
      'stackblitz.com',
      'habr.com',
      'tproger.ru',
      'proglib.io',
      'dev.to',
      'hashnode.com',
      'geeksforgeeks.org',
      'roadmap.sh',
      'bun.sh',
      'deno.com',
      'tailwindcss.com',
      'vitest.dev',
      'playwright.dev',
      'astro.build',
      'prisma.io',
      'zod.dev',
      'localhost',
      '127.0.0.1',
    ]),
    phrases: [
      'chrome extension',
      'chrome-расширен',
      'manifest v3',
      'service worker',
      'web worker',
      'web dev',
      'front end',
      'back end',
      'full stack',
      'структур данн',
      'clean architecture',
      'чистая архитектур',
      'clean code',
      'чистый код',
      'системн дизайн',
      'system design',
      'unit test',
      'type checking',
      'strict mode',
      'source code',
      'pull request',
      'open source',
      'из it',
      'в it',
      'про it',
      'для it',
      'it сфер',
      'it рынк',
      'it индустр',
      'it компан',
    ],
    stems: [
      'typescript',
      'javascript',
      'программир',
      'программист',
      'разработк',
      'разработчик',
      'высоконагруж',
      'айтишник',
      'фронтенд',
      'бэкенд',
      'frontend',
      'backend',
      'fullstack',
      'алгоритм',
      'компилятор',
      'рефакторинг',
      'репозитор',
      'компонент',
      'гидратац',
      'hydrat',
      'suspense',
      'микросервис',
      'тестирован',
      'асинхрон',
      'postgresql',
      'postgres',
      'mongodb',
      'graphql',
      'webgpu',
      'webassembly',
      'шейдер',
      'shader',
      'preact',
      'nextjs',
      'svelte',
      'angular',
      'webpack',
      'vitest',
      'playwright',
      'tailwind',
      'верстк',
      'кодинг',
      'кодер',
      'отладк',
      'дебаг',
      'debugg',
      'микрофронтенд',
    ],
    exactWords: new Set([
      'code',
      'coding',
      'код',
      'кода',
      'коду',
      'коде',
      'dev',
      'айти',
      'python',
      'rust',
      'golang',
      'java',
      'kotlin',
      'swift',
      'react',
      'vue',
      'vite',
      'node',
      'nodejs',
      'deno',
      'bun',
      'sql',
      'redis',
      'api',
      'sdk',
      'html',
      'css',
      'js',
      'ts',
      'c++',
      'c#',
      'php',
      'wasm',
      'git',
      'npm',
      'crate',
      'generics',
      'computed',
      'signals',
      'signal',
      'regex',
      'json',
      'async',
      'await',
    ]),
    secondaryTerms: ['библиотек', 'фреймворк', 'framework', 'library', 'package', 'module', 'типизац', 'архитектур'],
  },
  {
    id: 'devops',
    labelRu: 'Cloud и DevOps',
    labelEn: 'Cloud & DevOps',
    shortRu: 'DevOps',
    shortEn: 'DevOps',
    emoji: '☁️',
    color: 'cyan',
    hosts: new Set([
      'aws.amazon.com',
      'console.cloud.google.com',
      'portal.azure.com',
      'vercel.com',
      'netlify.com',
      'cloudflare.com',
      'dash.cloudflare.com',
      'hub.docker.com',
      'docker.com',
      'kubernetes.io',
      'grafana.com',
      'datadoghq.com',
      'sentry.io',
      'supabase.com',
      'railway.app',
      'fly.io',
      'render.com',
      'digitalocean.com',
      'terraform.io',
    ]),
    phrases: ['ci cd', 'ci/cd', 'load balancer', 'reverse proxy', 'cloud native'],
    stems: [
      'kubernetes',
      'docker',
      'terraform',
      'ansible',
      'devops',
      'cloudflare',
      'supabase',
      'grafana',
      'prometheus',
      'инфраструктур',
      'контейнер',
      'хостинг',
      'деплой',
      'deploy',
      'мониторинг',
      'кластер',
      'серверн',
      'балансир',
    ],
    exactWords: new Set([
      'k8s',
      'aws',
      'gcp',
      'azure',
      'nginx',
      'linux',
      'ubuntu',
      'debian',
      'bash',
      'vercel',
      'netlify',
      'сервер',
      'сервера',
      'серверы',
      'ssh',
      'dns',
      'ssl',
      'tls',
      'vps',
      'cdn',
    ]),
    secondaryTerms: ['облако', 'облачн', 'cloud', 'pipeline', 'ingress'],
  },
  {
    id: 'design',
    labelRu: 'Дизайн и UI',
    labelEn: 'Design & UI',
    shortRu: 'Дизайн',
    shortEn: 'Design',
    emoji: '🎨',
    color: 'pink',
    hosts: new Set([
      'figma.com',
      'dribbble.com',
      'behance.net',
      'framer.com',
      'canva.com',
      'coolors.co',
      'fonts.google.com',
      'lucide.dev',
      'miro.com',
    ]),
    phrases: [
      'ui ux',
      'ux ui',
      'design system',
      'дизайн систем',
      'веб дизайн',
      'веб-дизайн',
      'motion design',
      'моушн дизайн',
    ],
    stems: [
      'figma',
      'дизайн',
      'типографик',
      'брендинг',
      'прототип',
      'иллюстрац',
      'photoshop',
      'illustrator',
      'blender',
      'framer',
      'интерфейс',
      'анимац',
      'палитр',
    ],
    exactWords: new Set([
      'ui',
      'ux',
      '3d',
      'макет',
      'макеты',
      'шрифт',
      'шрифты',
      'иконки',
      'иконок',
      'логотип',
      'canva',
    ]),
    secondaryTerms: ['цвета', 'сетка', 'композиц', 'layout', 'typography', 'motion'],
  },
  {
    id: 'gaming',
    labelRu: 'Игры',
    labelEn: 'Gaming',
    shortRu: 'Игры',
    shortEn: 'Gaming',
    emoji: '🎮',
    color: 'purple',
    hosts: new Set([
      'store.steampowered.com',
      'steamcommunity.com',
      'twitch.tv',
      'epicgames.com',
      'gog.com',
      'ign.com',
      'stopgame.ru',
      'igromania.ru',
      'playground.ru',
      'nexusmods.com',
      'wowhead.com',
      'dotabuff.com',
      'liquipedia.net',
      'hltv.org',
      'metacritic.com',
      'itch.io',
      'wowprogress.com',
    ]),
    phrases: [
      'elden ring',
      'baldurs gate',
      'baldur gate',
      'mobile legends',
      'dark souls',
      'league of legends',
      'world of warcraft',
      'counter strike',
      'apex legends',
      'hollow knight',
      'space age',
      'path of exile',
      'stalker 2',
      'сталкер 2',
      'expedition 33',
      'death stranding',
      'grand theft auto',
      'gta 6',
      'witcher 4',
      'ведьмак 4',
      'silent hill',
      'resident evil',
      'disco elysium',
      'honor mode',
      'boss guide',
      'tier list',
      'bleed build',
      'тир лист',
    ],
    stems: [
      'геймплей',
      'gameplay',
      'прохожден',
      'киберспорт',
      'видеоигр',
      'гейминг',
      'геймер',
      'gaming',
      'playstation',
      'nintendo',
      'minecraft',
      'майнкрафт',
      'роблокс',
      'cyberpunk',
      'valorant',
      'валорант',
      'warcraft',
      'hearthstone',
      'overwatch',
      'fortnite',
      'genshin',
      'honkai',
      'skyrim',
      'witcher',
      'ведьмак',
      'сталкер',
      'silksong',
      'factorio',
      'soulslike',
      'metroidvania',
      'метроидвани',
      'инди-игр',
      'спидран',
      'speedrun',
      'roguelike',
      'квест',
      'персонаж',
      'мультиплеер',
      'игрово',
    ],
    exactWords: new Set([
      'game',
      'games',
      'игра',
      'игры',
      'игре',
      'игру',
      'игр',
      'играм',
      'играх',
      'rpg',
      'mmorpg',
      'fps',
      'steam',
      'ps5',
      'xbox',
      'dota',
      'dota2',
      'дота',
      'cs2',
      'кс2',
      'gta',
      'sekiro',
      'diablo',
      'stalker',
      'tarkov',
      'тарков',
      'босс',
      'босса',
      'боссов',
      'боссы',
      'билд',
      'билды',
      'патч',
      'патча',
      'мета',
      'меты',
      'мид',
      'мидер',
      'мидера',
      'герой',
      'героя',
      'турнир',
      'dlc',
      'lore',
      'weapons',
      'boss',
    ]),
    secondaryTerms: ['уровн', 'оружи', 'достижен', 'стример', 'esports', 'erdtree', 'финал'],
  },
  {
    id: 'music',
    labelRu: 'Музыка',
    labelEn: 'Music & Audio',
    shortRu: 'Музыка',
    shortEn: 'Music',
    emoji: '🎧',
    color: 'pink',
    hosts: new Set([
      'music.youtube.com',
      'open.spotify.com',
      'spotify.com',
      'soundcloud.com',
      'music.yandex.ru',
      'bandcamp.com',
      'tidal.com',
      'deezer.com',
      'podcasts.apple.com',
      'music.apple.com',
      'last.fm',
    ]),
    phrases: [
      'lo-fi',
      'lofi',
      'hip hop',
      'hip-hop',
      'deep work',
      'study music',
      'focus music',
      'fl studio',
      'chill beats',
      'jazz piano',
      'группа крови',
      'interstellar live',
      'hans zimmer',
      'tiny desk',
      'boiler room',
      'full album',
      'deep house',
      'tech house',
      'house music',
      'музыка для фокуса',
    ],
    stems: [
      'музык',
      'synthwave',
      'ambient',
      'эмбиент',
      'soundtrack',
      'саундтрек',
      'плейлист',
      'playlist',
      'гитар',
      'guitar',
      'пианин',
      'синтезатор',
      'концерт',
      'мелоди',
      'акустик',
      'ableton',
      'вокал',
      'symphon',
      'симфон',
      'orchestr',
      'оркестр',
      'remaster',
      'ремастер',
      'кавер',
      'барабан',
    ],
    exactWords: new Set([
      'music',
      'audio',
      'beats',
      'beat',
      'биты',
      'трек',
      'треки',
      'песня',
      'песни',
      'песен',
      'альбом',
      'jazz',
      'piano',
      'rock',
      'metal',
      'techno',
      'chill',
      'mix',
      'микс',
      'radio',
      'радио',
      'ost',
      'spotify',
      'soundcloud',
      'dj',
      'zimmer',
      'remastered',
      'acoustic',
      'unplugged',
      'instrumental',
      'инструментал',
      'винил',
      'vinyl',
    ]),
    secondaryTerms: ['study', 'focus', 'фокус', 'relax', 'calm', 'sound', 'live', 'cover'],
  },
  {
    id: 'hardware',
    labelRu: 'Железо и ПК',
    labelEn: 'Tech & Gear',
    shortRu: 'Железо',
    shortEn: 'Tech',
    emoji: '🖥️',
    color: 'blue',
    hosts: new Set(['3dnews.ru', 'ixbt.com', 'overclockers.ru', 'tomshardware.com', 'anandtech.com', 'rtings.com']),
    phrases: [
      'сборка пк',
      'сборк пк',
      'apple silicon',
      'механическ клавиатур',
      'mechanical keyboard',
      'core ultra',
      'core i5',
      'core i7',
      'core i9',
      'тест фпс',
    ],
    stems: [
      'видеокарт',
      'процессор',
      'материнск',
      'оперативн',
      'ноутбук',
      'клавиатур',
      'монитор',
      'наушник',
      'микрофон',
      'смартфон',
      'компьютер',
      'гаджет',
      'бенчмарк',
      'macbook',
      'iphone',
      'samsung',
      'xiaomi',
      'radeon',
      'nvidia',
      'geforce',
    ],
    exactWords: new Set([
      'пк',
      'pc',
      'gpu',
      'cpu',
      'rtx',
      'gtx',
      'amd',
      'ryzen',
      'intel',
      'ssd',
      'nvme',
      'ddr5',
      'ddr4',
      'm1',
      'm2',
      'm3',
      'm4',
      'laptop',
      'keyboard',
      'keychron',
      'mouse',
      'мышка',
      'мышь',
      'oled',
      'ips',
      'hardware',
      'benchmark',
      'fps',
    ]),
    secondaryTerms: ['рубл', 'мощн', 'охлажден', 'блок питан', 'корпус', 'желез'],
  },
  {
    id: 'science',
    labelRu: 'Наука и космос',
    labelEn: 'Science & Space',
    shortRu: 'Наука',
    shortEn: 'Science',
    emoji: '🧬',
    color: 'cyan',
    hosts: new Set([
      'nasa.gov',
      'nature.com',
      'science.org',
      'sciencedirect.com',
      'quantamagazine.org',
      'nplus1.ru',
      'elementy.ru',
      'postnauka.org',
    ]),
    phrases: [
      'james webb',
      'телескоп уэбб',
      'черн дыр',
      'черные дыр',
      'black hole',
      'квантов механик',
      'quantum mechanics',
      'теория относительн',
    ],
    stems: [
      'телескоп',
      'космос',
      'космонавт',
      'галактик',
      'астроном',
      'астрофизик',
      'квантов',
      'физик',
      'математик',
      'биолог',
      'нейробиолог',
      'генетик',
      'молекул',
      'эволюц',
      'вселенн',
      'гравитац',
      'теорем',
      'научн',
      'научпоп',
    ],
    exactWords: new Set([
      'nasa',
      'spacex',
      'уэбба',
      'webb',
      'наука',
      'науки',
      'химия',
      'химии',
      'атом',
      'атомы',
      'днк',
      'dna',
      'physics',
      'quantum',
      'galaxy',
      'universe',
      'biology',
      'astronomy',
      'science',
      'optics',
      'планет',
      'планеты',
      'марс',
    ]),
    secondaryTerms: ['ученые', 'открыт', 'гипотез', 'лаборатор', 'эксперимент', 'исследован', 'звезды'],
  },
  {
    id: 'finance',
    labelRu: 'Финансы',
    labelEn: 'Finance',
    shortRu: 'Финансы',
    shortEn: 'Finance',
    emoji: '📈',
    color: 'yellow',
    hosts: new Set([
      'tbank.ru',
      'tinkoff.ru',
      'sberbank.ru',
      'alfabank.ru',
      'vtb.ru',
      'investing.com',
      'tradingview.com',
      'finance.yahoo.com',
      'coingecko.com',
      'coinmarketcap.com',
      'binance.com',
      'bybit.com',
      'smart-lab.ru',
      'moex.com',
    ]),
    phrases: [
      'фондов рын',
      'ключев ставк',
      'курс доллар',
      'бизнес план',
      'личн финанс',
      'stock market',
      'venture capital',
    ],
    stems: [
      'инвестиц',
      'инвестор',
      'дивиденд',
      'облигац',
      'трейдинг',
      'криптовалют',
      'биткоин',
      'финанс',
      'экономик',
      'инфляц',
      'ипотек',
      'кредит',
      'бюджет',
      'портфел',
      'стартап',
      'венчур',
      'капитал',
      'валют',
      'налог',
      'заработ',
      'bitcoin',
      'ethereum',
      'trading',
      'portfolio',
    ],
    exactWords: new Set([
      'акции',
      'акций',
      'биржа',
      'бирже',
      'вклад',
      'вклады',
      'доход',
      'прибыль',
      'крипта',
      'крипты',
      'btc',
      'eth',
      'etf',
      'ipo',
      'saas',
      'stocks',
      'stock',
      'crypto',
      'finance',
      'revenue',
      'startup',
      'рубл',
      'доллар',
      'банк',
      'банки',
    ]),
    secondaryTerms: ['рынок', 'рынка', 'экономический', 'цб', 'ставка', 'деньги', 'денег'],
  },
  {
    id: 'career',
    labelRu: 'Карьера',
    labelEn: 'Career',
    shortRu: 'Карьера',
    shortEn: 'Career',
    emoji: '💼',
    color: 'blue',
    hosts: new Set([
      'hh.ru',
      'linkedin.com',
      'career.habr.com',
      'levels.fyi',
      'glassdoor.com',
      'leetcode.com',
      'hackerrank.com',
      'neetcode.io',
      'indeed.com',
    ]),
    phrases: [
      'system design',
      'системн дизайн',
      'senior engineer',
      'staff engineer',
      'tech career',
      'без менеджмент',
      'алгоритмическ секц',
      'тайм менеджмент',
      'job search',
      'поиск работы',
      'рынок труда',
      'live coding',
    ],
    stems: [
      'собеседован',
      'интервью',
      'резюме',
      'ваканс',
      'карьер',
      'зарплат',
      'джуниор',
      'тимлид',
      'менеджмент',
      'выгоран',
      'продуктивн',
      'трудоустрой',
      'стажировк',
      'рекрутер',
      'лайфкодинг',
      'interview',
      'internship',
      'salary',
      'career',
      'hiring',
      'roadmap',
      'leetcode',
    ],
    exactWords: new Set([
      'оффер',
      'офферы',
      'офер',
      'собес',
      'техсобес',
      'найм',
      'найма',
      'мидл',
      'сеньор',
      'сеньора',
      'resume',
      'cv',
      'senior',
      'staff',
      'junior',
      'prep',
    ]),
    secondaryTerms: ['инженер', 'engineer', 'team', 'команд', 'опыт работы', 'работа', 'работу', 'работы', 'growth'],
  },
  {
    id: 'cooking',
    labelRu: 'Кулинария',
    labelEn: 'Cooking',
    shortRu: 'Кулинария',
    shortEn: 'Cooking',
    emoji: '🍳',
    color: 'orange',
    hosts: new Set(['eda.ru', 'povarenok.ru', 'gastronom.ru', 'allrecipes.com', 'seriouseats.com']),
    phrases: ['том ям', 'tom yum', 'sourdough baking'],
    stems: [
      'приготов',
      'готовк',
      'кулинар',
      'рецепт',
      'выпечк',
      'десерт',
      'ингредиент',
      'маринад',
      'закваск',
      'sourdough',
      'cooking',
      'recipe',
      'baking',
      'бариста',
    ],
    exactWords: new Set([
      'блюдо',
      'блюда',
      'кухня',
      'кухни',
      'борщ',
      'паста',
      'пицца',
      'стейк',
      'торт',
      'тесто',
      'ужин',
      'завтрак',
      'обед',
      'соус',
      'кофе',
      'chef',
      'food',
      'мясо',
      'рыба',
      'суп',
      'салат',
      'салаты',
      'курица',
      'курицы',
      'курицу',
      'куриный',
      'гриль',
      'гриле',
      'пирог',
      'блины',
      'плов',
      'шашлык',
      'омлет',
      'pasta',
      'pizza',
      'steak',
      'cake',
      'soup',
      'salad',
      'chicken',
      'grill',
    ]),
    secondaryTerms: ['вкусн', 'духовк', 'сковород', 'дома'],
  },
  {
    id: 'travel',
    labelRu: 'Путешествия',
    labelEn: 'Travel',
    shortRu: 'Поездки',
    shortEn: 'Travel',
    emoji: '✈️',
    color: 'cyan',
    hosts: new Set([
      'aviasales.ru',
      'tutu.ru',
      'booking.com',
      'airbnb.com',
      'ostrovok.ru',
      'skyscanner.com',
      'tripadvisor.com',
    ]),
    phrases: ['квартиры в', 'квартира в'],
    stems: [
      'путешеств',
      'поездк',
      'перелет',
      'авиабилет',
      'гостиниц',
      'туризм',
      'маршрут',
      'экскурс',
      'переезд',
      'эмиграц',
      'travel',
      'itinerary',
      'airbnb',
      'достопримечат',
    ],
    exactWords: new Set([
      'виза',
      'визы',
      'визу',
      'отель',
      'отели',
      'внж',
      'токио',
      'tokyo',
      'япония',
      'японии',
      'japan',
      'париж',
      'лондон',
      'дубай',
      'стамбул',
      'бали',
      'таиланд',
      'flight',
      'flights',
      'hotel',
      'квартира',
      'квартиры',
      'аренда',
      'переезд',
    ]),
    secondaryTerms: ['город', 'страна', 'аэропорт', 'билеты'],
  },
  {
    id: 'cinema',
    labelRu: 'Кино и сериалы',
    labelEn: 'Movies & TV',
    shortRu: 'Кино',
    shortEn: 'Cinema',
    emoji: '🎬',
    color: 'red',
    hosts: new Set([
      'kinopoisk.ru',
      'hd.kinopoisk.ru',
      'imdb.com',
      'rottentomatoes.com',
      'netflix.com',
      'okko.tv',
      'ivi.ru',
      'kion.ru',
      'letterboxd.com',
      'shikimori.one',
      'myanimelist.net',
    ]),
    phrases: [
      'season finale',
      'обзор фильма',
      'разбор концовки',
      'ending explained',
      'movie review',
      'box office',
    ],
    stems: [
      'сериал',
      'кинопоиск',
      'кинематограф',
      'кинообзор',
      'киновселен',
      'экранизац',
      'режиссер',
      'сценари',
      'мультфильм',
      'документалк',
      'сиквел',
      'приквел',
      'трилоги',
      'netflix',
      'оскар',
    ],
    exactWords: new Set([
      'кино',
      'фильм',
      'фильмы',
      'фильма',
      'фильмов',
      'аниме',
      'anime',
      'манга',
      'манги',
      'мангу',
      'манге',
      'manga',
      'movie',
      'movies',
      'cinema',
      'film',
      'актер',
      'актеры',
      'драма',
      'триллер',
      'комедия',
      'хоррор',
      'дюна',
      'дюны',
      'дюну',
    ]),
    mediumTerms: [
      'трейлер',
      'trailer',
      'сюжет',
      'plot',
      'премьер',
      'концовк',
      'спойлер',
      'spoiler',
      'сезон',
      'season',
      'каст',
    ],
    secondaryTerms: ['тизер', 'озвучк', 'серия', 'эпизод'],
  },
  {
    id: 'auto',
    labelRu: 'Авто',
    labelEn: 'Auto',
    shortRu: 'Авто',
    shortEn: 'Auto',
    emoji: '🚗',
    color: 'blue',
    hosts: new Set(['auto.ru', 'drom.ru', 'drive2.ru', 'kolesa.ru']),
    phrases: ['тест драйв', 'тест-драйв', 'коробк передач'],
    stems: [
      'автомоб',
      'автообзор',
      'электромоб',
      'двигател',
      'мотоцикл',
      'тюнинг',
      'внедорожн',
      'кроссовер',
      'mercedes',
      'porsche',
    ],
    exactWords: new Set([
      'авто',
      'машина',
      'машины',
      'тачка',
      'tesla',
      'bmw',
      'audi',
      'toyota',
      'geely',
      'zeekr',
      'дтп',
      'пдд',
      'гибдд',
      'седан',
    ]),
    secondaryTerms: ['пробег', 'привод', 'лошадин', 'запас хода'],
  },
  {
    id: 'health',
    labelRu: 'Здоровье',
    labelEn: 'Fitness & Health',
    shortRu: 'Здоровье',
    shortEn: 'Fitness',
    emoji: '💪',
    color: 'green',
    hosts: new Set(['examine.com', 'pubmed.ncbi.nlm.nih.gov']),
    phrases: ['здоровый сон', 'правильн питан', 'набор массы'],
    stems: [
      'тренировк',
      'похуден',
      'калори',
      'медицин',
      'здоровь',
      'психолог',
      'терапи',
      'дофамин',
      'вынослив',
      'фитнес',
      'nutrition',
      'workout',
      'fitness',
    ],
    exactWords: new Set([
      'спорт',
      'мышцы',
      'мышц',
      'питание',
      'белок',
      'сон',
      'сна',
      'бег',
      'бега',
      'gym',
      'health',
      'sleep',
      'витамины',
      'стресс',
    ]),
    secondaryTerms: ['организм', 'энерги', 'тело', 'привычк'],
  },
  {
    id: 'language',
    labelRu: 'Языки',
    labelEn: 'Languages',
    shortRu: 'Языки',
    shortEn: 'Langs',
    emoji: '🗣️',
    color: 'orange',
    hosts: new Set(['duolingo.com', 'deepl.com', 'translate.google.com', 'translate.yandex.ru', 'reverso.net']),
    phrases: [
      'английск язык',
      'испанск язык',
      'японск язык',
      'немецк язык',
      'французск язык',
      'изучен язык',
    ],
    stems: [
      'испанск',
      'японск',
      'немецк',
      'французск',
      'китайск',
      'корейск',
      'грамматик',
      'лексик',
      'произношен',
      'полиглот',
      'vocabulary',
      'grammar',
      'pronunciation',
    ],
    exactWords: new Set([
      'язык',
      'языка',
      'языки',
      'языков',
      'ielts',
      'toefl',
      'spanish',
      'japanese',
      'french',
      'german',
      'английский',
      'словарь',
    ]),
    secondaryTerms: ['выучил', 'учить', 'носител', 'акцент', 'слова'],
  },
  {
    id: 'shopping',
    labelRu: 'Покупки',
    labelEn: 'Shopping',
    shortRu: 'Покупки',
    shortEn: 'Shop',
    emoji: '🛍️',
    color: 'yellow',
    hosts: new Set([
      'ozon.ru',
      'wildberries.ru',
      'market.yandex.ru',
      'megamarket.ru',
      'aliexpress.com',
      'aliexpress.ru',
      'amazon.com',
      'amazon.co.uk',
      'amazon.de',
      'dns-shop.ru',
      'citilink.ru',
      'mvideo.ru',
      'eldorado.ru',
      'avito.ru',
      'lamoda.ru',
      'ebay.com',
      'ikea.com',
    ]),
    phrases: ['в корзине', 'оформление заказа'],
    stems: [
      'распаковк',
      'маркетплейс',
      'доставк',
      'промокод',
      'покупк',
      'магазин',
      'каталог',
      'товар',
    ],
    exactWords: new Set([
      'купить',
      'скидки',
      'скидка',
      'заказ',
      'заказа',
      'корзина',
      'ozon',
      'wildberries',
      'aliexpress',
      'amazon',
      'avito',
      'shop',
      'store',
      'buy',
      'price',
      'коврик',
    ]),
    secondaryTerms: ['отзывы', 'руб', 'доставка', 'цена', 'цены'],
  },
  {
    id: 'news',
    labelRu: 'Мир и политика',
    labelEn: 'News & World',
    shortRu: 'Новости',
    shortEn: 'World',
    emoji: '🌍',
    color: 'grey',
    hosts: new Set(['bbc.com', 'bbc.co.uk', 'reuters.com', 'bloomberg.com', 'meduza.io', 'rbc.ru', 'kommersant.ru']),
    phrases: ['ближний восток', 'торговая война', 'мировая экономика'],
    stems: ['политик', 'геополитик', 'санкц', 'расследован', 'парламент', 'правительств', 'законопроект'],
    exactWords: new Set(['выборы', 'война', 'закон', 'законы', 'politics']),
    secondaryTerms: ['страна', 'государств', 'история', 'новости', 'news', 'world'],
  },
];

const CONCEPT_BY_ID = new Map<ConceptId, ConceptDefinition>(
  CONCEPT_DEFINITIONS.map((def) => [def.id, def]),
);

interface IndexedTermEntry {
  conceptIdx: number;
  term: string;
  weight: number;
  termId: number;
}

interface IndexedPhraseEntry {
  conceptIdx: number;
  parts: readonly string[];
  weight: number;
  termId: number;
}

const PREFIX3_INDEX = new Map<string, IndexedTermEntry[]>();
const SHORT_TERM_ENTRIES: IndexedTermEntry[] = [];
const EXACT_WORD_INDEX = new Map<string, Array<{ conceptIdx: number; weight: number; termId: number }>>();
const PHRASE_PREFIX3_INDEX = new Map<string, IndexedPhraseEntry[]>();
const SHORT_PHRASE_ENTRIES: IndexedPhraseEntry[] = [];

(() => {
  let nextTermId = 0;
  CONCEPT_DEFINITIONS.forEach((def, conceptIdx) => {
    const addSinglePattern = (term: string, weight: number): void => {
      if (!term) return;
      const entry: IndexedTermEntry = { conceptIdx, term, weight, termId: nextTermId++ };
      if (term.length < 3) {
        SHORT_TERM_ENTRIES.push(entry);
        return;
      }
      const key = term.slice(0, 3);
      const list = PREFIX3_INDEX.get(key);
      if (list) {
        list.push(entry);
      } else {
        PREFIX3_INDEX.set(key, [entry]);
      }
    };

    const addPhrasePattern = (phrase: string, weight: number): void => {
      const parts = phrase
        .trim()
        .split(/[\s-]+/)
        .filter(Boolean);
      if (parts.length === 0) return;
      if (parts.length === 1 && parts[0]) {
        addSinglePattern(parts[0], weight);
        return;
      }
      const first = parts[0] ?? '';
      const entry: IndexedPhraseEntry = { conceptIdx, parts, weight, termId: nextTermId++ };
      if (first.length < 3) {
        SHORT_PHRASE_ENTRIES.push(entry);
        return;
      }
      const key = first.slice(0, 3);
      const list = PHRASE_PREFIX3_INDEX.get(key);
      if (list) {
        list.push(entry);
      } else {
        PHRASE_PREFIX3_INDEX.set(key, [entry]);
      }
    };

    if (def.strongPhrases) {
      for (const sp of def.strongPhrases) addPhrasePattern(sp, 8.5);
    }
    for (const phrase of def.phrases) addPhrasePattern(phrase, 5.5);
    for (const stem of def.stems) {
      if (stem.includes(' ')) addPhrasePattern(stem, 3.0);
      else addSinglePattern(stem, 3.0);
    }
    if (def.mediumTerms) {
      for (const med of def.mediumTerms) {
        if (med.includes(' ')) addPhrasePattern(med, 1.5);
        else addSinglePattern(med, 1.5);
      }
    }
    for (const sec of def.secondaryTerms) {
      if (sec.includes(' ')) addPhrasePattern(sec, 1.0);
      else addSinglePattern(sec, 1.0);
    }

    for (const word of def.exactWords) {
      const list = EXACT_WORD_INDEX.get(word);
      const entry = { conceptIdx, weight: 3.0, termId: nextTermId++ };
      if (list) {
        list.push(entry);
      } else {
        EXACT_WORD_INDEX.set(word, [entry]);
      }
    }
  });
})();

const RU_DOMAIN_SUFFIXES = ['.ru', '.рф', '.su', '.by', '.kz'];

export function isRussianFocusedTab(tab: TabMetadata, domainInfo?: ExtractedDomainInfo): boolean {
  if (hasCyrillicText(tab.title)) return true;
  if (domainInfo) {
    return RU_DOMAIN_SUFFIXES.some((sfx) => domainInfo.rootDomain.endsWith(sfx));
  }
  return /\.(ru|рф|su|by|kz)(?:\/|$)/i.test(tab.url);
}

export function getConceptDisplayMeta(
  conceptId: ConceptId,
  preferRussian: boolean,
): { label: string; emoji: string; color: ChromeTabGroupColor } {
  const def = CONCEPT_BY_ID.get(conceptId);
  if (!def) {
    return { label: preferRussian ? 'Разное' : 'Misc', emoji: '✨', color: 'grey' };
  }
  return {
    label: preferRussian ? def.labelRu : def.labelEn,
    emoji: def.emoji,
    color: def.color,
  };
}

export function getShortConceptLabel(conceptId: ConceptId, preferRussian: boolean): string {
  const def = CONCEPT_BY_ID.get(conceptId);
  if (!def) {
    return preferRussian ? 'Другое' : 'Other';
  }
  return preferRussian ? def.shortRu : def.shortEn;
}

export function formatYouTubeConceptLabel(conceptId: ConceptId, preferRussian: boolean): string {
  return `YouTube · ${getShortConceptLabel(conceptId, preferRussian)}`;
}

/**
 * Checks whether a normalized lowercase token/stem directly matches a primary concept keyword
 * (weight >= 3.0), helping distinguish domain anchors from generic clickbait/adverb noise.
 */
export function isPrimaryConceptKeyword(lowerToken: string): boolean {
  if (!lowerToken) return false;
  const norm = lowerToken.toLowerCase().replace(/ё/g, 'е').trim();
  if (EXACT_WORD_INDEX.has(norm)) return true;
  if (norm.length >= 3) {
    const bucket = PREFIX3_INDEX.get(norm.slice(0, 3));
    if (bucket) {
      for (const entry of bucket) {
        if (entry.weight >= 3.0 && !entry.term.includes(' ') && norm.startsWith(entry.term)) {
          return true;
        }
      }
    }
  }
  return false;
}

export interface ConceptClassification {
  readonly conceptId: ConceptId;
  readonly score: number;
  readonly hostMatched: boolean;
}

interface RawConceptProfile {
  readonly scores: readonly number[];
  readonly hostMatches: readonly number[];
  readonly bestIdx: number;
  readonly bestScore: number;
  readonly secondScore: number;
}

const MAX_CONCEPT_CACHE_SIZE = 1024;
const RAW_CONCEPT_CACHE = new Map<string, RawConceptProfile>();

export const MULTI_TOPIC_CONTENT_HOSTS = new Set([
  'habr.com',
  'github.com',
  'gitlab.com',
  'bitbucket.org',
  'stackoverflow.com',
  'stackexchange.com',
  'dev.to',
  'hashnode.com',
  'tproger.ru',
  'proglib.io',
  'medium.com',
  'reddit.com',
  'vc.ru',
  'dzen.ru',
  'wikipedia.org',
  'substack.com',
  'youtube.com',
  'youtu.be',
]);

function normalizeClassificationText(raw: string): string {
  return raw.toLowerCase().replace(/ё/g, 'е').replace(/['’ʼ`]/g, '');
}

function computeRawConceptProfile(
  tab: TabMetadata,
  domainInfo: ExtractedDomainInfo,
  ignoreHost: boolean,
): RawConceptProfile {
  const cleanTitleLower = normalizeClassificationText(tab.title);
  const pathText =
    domainInfo.meaningfulPathSegments.length > 0
      ? normalizeClassificationText(domainInfo.meaningfulPathSegments.join(' '))
      : '';
  const combinedText = pathText ? `${cleanTitleLower} ${pathText}`.trim() : cleanTitleLower.trim();

  const cacheKey = `${ignoreHost ? '1' : '0'}|${domainInfo.hostname}|${domainInfo.rootDomain}|${combinedText}`;
  const cached = RAW_CONCEPT_CACHE.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  const numConcepts = CONCEPT_DEFINITIONS.length;
  const scores = new Array<number>(numConcepts).fill(0);
  const hostMatches = new Array<number>(numConcepts).fill(0);

  if (!ignoreHost) {
    const isMultiTopicHost =
      MULTI_TOPIC_CONTENT_HOSTS.has(domainInfo.rootDomain) ||
      MULTI_TOPIC_CONTENT_HOSTS.has(domainInfo.hostname);
    const hostWeight = isMultiTopicHost ? 2.0 : 6.0;
    for (let i = 0; i < numConcepts; i++) {
      const def = CONCEPT_DEFINITIONS[i];
      if (def && (def.hosts.has(domainInfo.hostname) || def.hosts.has(domainInfo.rootDomain))) {
        scores[i] = hostWeight;
        hostMatches[i] = 1;
      }
    }
  }

  if (combinedText.length > 0) {
    const matchedTermIds = new Set<number>();
    // Prevent double-counting when both a phrase, exactWord, and stem match the same word positions
    const bestWeightPerWordConcept = new Map<string, number>();

    const awardWordMatch = (wordIdx: number, conceptIdx: number, weight: number, termId: number): void => {
      if (matchedTermIds.has(termId)) return;
      matchedTermIds.add(termId);
      const wcKey = `${wordIdx}:${conceptIdx}`;
      const prev = bestWeightPerWordConcept.get(wcKey) ?? 0;
      if (weight > prev) {
        scores[conceptIdx] = (scores[conceptIdx] ?? 0) + (weight - prev);
        bestWeightPerWordConcept.set(wcKey, weight);
      }
    };

    const rawWords = combinedText
      .replace(/[^\p{L}\p{N}+#-]+/gu, ' ')
      .split(/\s+/)
      .filter(Boolean);

    const flatWords: string[] = [];
    const flatToRawIdx: number[] = [];

    rawWords.forEach((rawWord, rawIdx) => {
      const subParts = rawWord.includes('-') ? rawWord.split('-').filter(Boolean) : [rawWord];
      for (const part of subParts) {
        flatWords.push(part);
        flatToRawIdx.push(rawIdx);
      }
    });

    // 1. Multi-word inflected phrase matching first so constituent words do not double-score as stems
    const matchesPhrasePart = (word: string, part: string): boolean =>
      part.length <= 2 ? word === part : word.startsWith(part);

    const tryMatchPhraseList = (
      candidates: readonly IndexedPhraseEntry[] | undefined,
      startFlatIdx: number,
    ): void => {
      if (!candidates) return;
      for (const entry of candidates) {
        if (matchedTermIds.has(entry.termId)) continue;
        if (startFlatIdx + entry.parts.length > flatWords.length) continue;

        let ok = true;
        for (let k = 0; k < entry.parts.length; k++) {
          const w = flatWords[startFlatIdx + k] ?? '';
          const p = entry.parts[k] ?? '';
          if (!matchesPhrasePart(w, p)) {
            ok = false;
            break;
          }
        }
        if (ok) {
          matchedTermIds.add(entry.termId);
          // Mark constituent word positions as already covered up to entry.weight
          let coveredPrev = 0;
          const seenRaw = new Set<number>();
          for (let k = 0; k < entry.parts.length; k++) {
            const rawIdx = flatToRawIdx[startFlatIdx + k];
            if (rawIdx === undefined || seenRaw.has(rawIdx)) continue;
            seenRaw.add(rawIdx);
            const wcKey = `${rawIdx}:${entry.conceptIdx}`;
            const prev = bestWeightPerWordConcept.get(wcKey) ?? 0;
            coveredPrev += prev;
            if (entry.weight > prev) {
              bestWeightPerWordConcept.set(wcKey, entry.weight);
            }
          }
          const delta = Math.max(0, entry.weight - coveredPrev);
          scores[entry.conceptIdx] = (scores[entry.conceptIdx] ?? 0) + delta;
        }
      }
    };

    for (let fIdx = 0; fIdx < flatWords.length; fIdx++) {
      const w = flatWords[fIdx] ?? '';
      if (w.length >= 3) {
        tryMatchPhraseList(PHRASE_PREFIX3_INDEX.get(w.slice(0, 3)), fIdx);
      } else {
        tryMatchPhraseList(SHORT_PHRASE_ENTRIES, fIdx);
      }
    }

    // 2. Single-token exact, stem, medium & secondary matches (superseded per position if already covered by phrase)
    rawWords.forEach((rawWord, rawIdx) => {
      const wholeExact = EXACT_WORD_INDEX.get(rawWord);
      if (wholeExact) {
        for (const m of wholeExact) {
          awardWordMatch(rawIdx, m.conceptIdx, m.weight, m.termId);
        }
      }

      const subParts = rawWord.includes('-') ? rawWord.split('-').filter(Boolean) : [rawWord];
      for (const part of subParts) {
        if (part !== rawWord) {
          const partExact = EXACT_WORD_INDEX.get(part);
          if (partExact) {
            for (const m of partExact) {
              awardWordMatch(rawIdx, m.conceptIdx, m.weight, m.termId);
            }
          }
        }

        if (part.length >= 3) {
          const bucket = PREFIX3_INDEX.get(part.slice(0, 3));
          if (bucket) {
            for (const entry of bucket) {
              if (part.startsWith(entry.term)) {
                awardWordMatch(rawIdx, entry.conceptIdx, entry.weight, entry.termId);
              }
            }
          }
        } else {
          for (const entry of SHORT_TERM_ENTRIES) {
            if (part === entry.term) {
              awardWordMatch(rawIdx, entry.conceptIdx, entry.weight, entry.termId);
            }
          }
        }
      }
    });
  }

  let bestIdx = -1;
  let bestScore = 0;
  let secondScore = 0;

  for (let i = 0; i < numConcepts; i++) {
    const score = scores[i] ?? 0;
    if (score > bestScore) {
      secondScore = bestScore;
      bestScore = score;
      bestIdx = i;
    } else if (score > secondScore) {
      secondScore = score;
    }
  }

  const profile: RawConceptProfile = {
    scores,
    hostMatches,
    bestIdx,
    bestScore,
    secondScore,
  };

  if (RAW_CONCEPT_CACHE.size >= MAX_CONCEPT_CACHE_SIZE) {
    const oldestKey = RAW_CONCEPT_CACHE.keys().next().value;
    if (oldestKey !== undefined) {
      RAW_CONCEPT_CACHE.delete(oldestKey);
    }
  }
  RAW_CONCEPT_CACHE.set(cacheKey, profile);

  return profile;
}

/**
 * Computes window-level concept distribution from unambiguous tabs so ambiguous ties
 * (e.g. "нейросети: математика на пальцах" -> AI 3.0 vs Science 3.0) resolve cleanly to the active context.
 */
export function computeWindowConceptPriors(
  tabs: readonly { tab: TabMetadata; domainInfo: ExtractedDomainInfo; ignoreHostPrior?: boolean }[],
): Map<ConceptId, number> {
  const priors = new Map<ConceptId, number>();

  for (const item of tabs) {
    if (item.domainInfo.isInternalBrowserUrl) continue;
    const profile = computeRawConceptProfile(
      item.tab,
      item.domainInfo,
      item.ignoreHostPrior === true,
    );
    if (profile.bestIdx === -1) continue;

    const bestDef = CONCEPT_DEFINITIONS[profile.bestIdx];
    if (!bestDef) continue;

    const bestHostMatched = profile.hostMatches[profile.bestIdx] === 1;
    const isClear =
      bestHostMatched ||
      (profile.bestScore >= 2.5 &&
        (profile.secondScore === 0 || profile.bestScore >= profile.secondScore * 1.15));

    if (isClear) {
      const weight = profile.bestScore >= 5.0 ? 1.5 : 1.0;
      priors.set(bestDef.id, (priors.get(bestDef.id) ?? 0) + weight);
    }
  }

  return priors;
}

export function classifyTabConcept(
  tab: TabMetadata,
  domainInfo: ExtractedDomainInfo,
  options: { ignoreHostPrior?: boolean; windowPriors?: ReadonlyMap<ConceptId, number> } = {},
): ConceptClassification | null {
  const ignoreHost = options.ignoreHostPrior === true;
  const profile = computeRawConceptProfile(tab, domainInfo, ignoreHost);
  const { bestIdx, bestScore, secondScore, scores, hostMatches } = profile;

  const bestDef = bestIdx !== -1 ? CONCEPT_DEFINITIONS[bestIdx] : undefined;
  if (!bestDef) return null;

  const bestHostMatched = hostMatches[bestIdx] === 1;
  const lacksSignal = bestScore < 2.5 && !bestHostMatched;
  if (lacksSignal) return null;

  const ambiguousTie = !bestHostMatched && secondScore > 0 && bestScore < secondScore * 1.15;
  if (!ambiguousTie) {
    return {
      conceptId: bestDef.id,
      score: Number(bestScore.toFixed(2)),
      hostMatched: bestHostMatched,
    };
  }

  // Resolve near-tie using window-level concept distribution when available
  const priors = options.windowPriors;
  if (!priors || priors.size === 0) {
    return null;
  }

  const tieFloor = bestScore / 1.15;
  const tiedCandidates: Array<{ conceptId: ConceptId; score: number; prior: number }> = [];
  for (let i = 0; i < CONCEPT_DEFINITIONS.length; i++) {
    const s = scores[i] ?? 0;
    const def = CONCEPT_DEFINITIONS[i];
    if (def && s >= tieFloor && s >= 2.5) {
      tiedCandidates.push({
        conceptId: def.id,
        score: s,
        prior: priors.get(def.id) ?? 0,
      });
    }
  }

  if (tiedCandidates.length < 2) return null;

  tiedCandidates.sort((a, b) => b.prior - a.prior || b.score - a.score);
  const top = tiedCandidates[0];
  const second = tiedCandidates[1];
  if (!top || !second) return null;

  if (top.prior >= 1.0 && (second.prior === 0 || top.prior >= second.prior * 1.25)) {
    return {
      conceptId: top.conceptId,
      score: Number(top.score.toFixed(2)),
      hostMatched: false,
    };
  }

  return null;
}

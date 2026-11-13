export interface ParsedGroupTitle {
  emoji?: string;
  cleanTitle: string;
}

/**
 * Strips leading emoji characters (including compound ZWJ sequences like 👨‍💻 or 🏳️‍🌈)
 * even when attached directly without whitespace (`📁Work` -> `emoji: '📁', cleanTitle: 'Work'`).
 */
export function parseExistingGroupTitle(rawTitle: string): ParsedGroupTitle {
  const trimmed = rawTitle.trim();
  if (!trimmed) {
    return { cleanTitle: '' };
  }

  const match =
    /^(\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*)\s*(.*)$/u.exec(
      trimmed,
    );

  if (match) {
    const emoji = match[1];
    const remainder = (match[2] ?? '').trim();
    if (emoji) {
      return {
        emoji,
        cleanTitle: remainder || emoji,
      };
    }
  }

  return { cleanTitle: trimmed };
}

export function inferEmojiFromDomain(domain: string): string {
  const d = domain.toLowerCase();
  if (d.includes('mail') || d.includes('inbox')) return '✉️';
  if (d.includes('doc') || d.includes('wiki') || d.includes('read')) return '📘';
  if (d.includes('shop') || d.includes('store') || d.includes('cart') || d.includes('buy')) {
    return '🛍️';
  }
  if (d.includes('cloud') || d.includes('aws') || d.includes('azure')) return '☁️';
  if (d.includes('ai') || d.includes('chat') || d.includes('claude') || d.includes('openai')) {
    return '🤖';
  }
  if (d.includes('news') || d.includes('blog') || d.includes('medium')) return '📰';
  if (d.includes('dev') || d.includes('code') || d.includes('git')) return '💻';
  if (d.includes('music') || d.includes('audio') || d.includes('video')) return '🎧';
  return '🌐';
}

export function inferHarmoniousEmojiForTopic(words: readonly string[]): string {
  const joined = words.join(' ').toLowerCase();
  if (/(shader|webgpu|gpu|render|graphics|canvas|шейдер|графика)/i.test(joined)) return '⚡';
  if (/(auth|oauth|jwt|security|token|login|безопасность|авторизация|пароль)/i.test(joined)) {
    return '🔐';
  }
  if (
    /(kubernetes|docker|deploy|aws|cloud|infra|ingress|terraform|сервер|деплой|инфраструктура)/i.test(
      joined,
    )
  ) {
    return '☁️';
  }
  if (
    /(react|vite|typescript|rust|python|node|api|code|bug|разработка|код|программирование|ошибка)/i.test(
      joined,
    )
  ) {
    return '🛠️';
  }
  if (/(llm|gpt|claude|gemini|neural|agent|agents|нейросет|искусств|модел|промпт)/i.test(joined)) {
    return '🤖';
  }
  if (/(career|interview|resume|salary|hiring|карьера|собеседован|резюме|работа)/i.test(joined)) {
    return '💼';
  }
  if (
    /(research|guide|benchmark|paper|study|docs|spec|статья|гайд|документация|исследование|руководство)/i.test(
      joined,
    )
  ) {
    return '📘';
  }
  if (/(design|figma|ui|ux|css|animation|layout|дизайн|верстка|анимация|макет)/i.test(joined)) {
    return '🎨';
  }
  if (/(buy|price|review|keyboard|gift|shop|купить|цена|скидки|заказ|магазин|корзина)/i.test(joined)) {
    return '🛍️';
  }
  if (
    /(music|video|podcast|stream|song|beats|музыка|видео|клип|фильм|трек|песня|подкаст)/i.test(
      joined,
    )
  ) {
    return '🎧';
  }
  if (/(game|gaming|steam|play|elden|rpg|игра|игры|гейминг)/i.test(joined)) return '🎮';
  return '✨';
}

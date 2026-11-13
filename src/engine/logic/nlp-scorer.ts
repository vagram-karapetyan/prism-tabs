import type { TabMetadata } from '../../domain/types';
import { inferHarmoniousEmojiForTopic } from '../shared/emoji-parser';
import { extractDomainInfo, hasCyrillicText } from '../shared/url-classifier';
import { formatDomainGroupMeta } from './platform-clusterer';
import {
  classifyTabConcept,
  getConceptDisplayMeta,
  isPrimaryConceptKeyword,
  type ConceptId,
} from './topic-taxonomy';

const RAW_STOP_WORDS = [
  // English articles, pronouns, prepositions, conjunctions, auxiliaries, adverbs
  'the', 'a', 'an', 'and', 'or', 'for', 'nor', 'but', 'yet', 'so',
  'how', 'to', 'in', 'on', 'of', 'with', 'by', 'from', 'at', 'as',
  'into', 'like', 'through', 'after', 'over', 'between', 'out', 'against',
  'during', 'without', 'before', 'under', 'around', 'among', 'above', 'below',
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
  'do', 'does', 'did', 'doing', 'done', 'will', 'would', 'should', 'can', 'could',
  'may', 'might', 'must', 'this', 'that', 'these', 'those', 'what', 'which',
  'who', 'whom', 'whose', 'where', 'when', 'why', 'all', 'any', 'both', 'each',
  'few', 'more', 'most', 'other', 'others', 'some', 'such', 'no', 'not', 'only',
  'own', 'same', 'than', 'too', 'very', 'just', 'also', 'already', 'always',
  'again', 'almost', 'alone', 'along', 'although', 'amongst', 'another', 'around',
  'away', 'back', 'because', 'become', 'became', 'behind', 'beyond', 'came',
  'come', 'coming', 'even', 'ever', 'every', 'everyone', 'everything', 'find',
  'found', 'get', 'getting', 'give', 'given', 'goes', 'going', 'gone', 'good',
  'got', 'great', 'here', 'high', 'however', 'instead', 'keep', 'know', 'known',
  'last', 'late', 'later', 'least', 'less', 'let', 'little', 'long', 'look',
  'looking', 'made', 'make', 'making', 'many', 'maybe', 'mean', 'means', 'much',
  'need', 'needs', 'never', 'new', 'next', 'nothing', 'now', 'often', 'once',
  'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'hundred', 'thousand', 'million', 'billion', 'first', 'second', 'third',
  'our', 'ours', 'out', 'own', 'per', 'please', 'possible', 'pretty', 'probably',
  'put', 'quite', 'rather', 'real', 'really', 'right', 'said', 'say', 'says',
  'see', 'seem', 'seems', 'seen', 'several', 'she', 'him', 'his', 'her', 'hers',
  'they', 'them', 'their', 'theirs', 'you', 'your', 'yours', 'yourself',
  'since', 'small', 'someone', 'something', 'sometimes', 'soon', 'still', 'sure',
  'take', 'taking', 'tell', 'telling', 'then', 'there', 'thing', 'things',
  'think', 'thinking', 'though', 'thought', 'thus', 'today', 'together', 'told',
  'took', 'tried', 'true', 'try', 'trying', 'until', 'upon', 'use', 'used',
  'using', 'usually', 'want', 'wants', 'way', 'ways', 'well', 'went', 'whether',
  'while', 'within', 'without', 'worth', 'wrong', 'yes', 'yet',
  // English time/quantity/web/media filler
  'year', 'years', 'month', 'months', 'week', 'weeks', 'day', 'days', 'hour',
  'hours', 'minute', 'minutes', 'seconds', 'time', 'times', 'today', 'tomorrow',
  'yesterday', 'page', 'home', 'tab', 'tabs', 'web', 'site', 'com', 'org', 'net',
  'io', 'app', 'http', 'https', 'www', 'html', 'php', 'index', 'main', 'welcome',
  'github', 'gitlab', 'google', 'search', 'perplexity', 'duckduckgo', 'bing',
  'yandex', 'youtube', 'linear', 'jira', 'figma', 'notion', 'medium', 'reddit',
  'stackoverflow', 'wikipedia', 'habr', 'pull', 'request', 'issue', 'issues',
  'shorts', 'official', 'reaction', 'stream', 'podcast', 'full', 'best', 'top',
  'review', 'part', 'episode', 'clip', 'channel', 'video', 'videos', 'watch',
  'watching', 'explained', 'complete', 'ultimate', 'beginner', 'beginners',
  'tutorial', 'overview', 'crash', 'course', 'deep', 'dive', 'english',
  'russian', 'free', 'online', 'live', 'real', 'honest', 'actually', 'simply',
  'fast', 'quick', 'easy', 'hard', 'simple', 'better', 'worse', 'worst', 'biggest',
  // Russian pronouns, prepositions, conjunctions, particles, adverbs
  'и', 'в', 'во', 'не', 'что', 'он', 'на', 'я', 'с', 'со', 'как', 'а', 'то',
  'все', 'всё', 'она', 'оно', 'они', 'так', 'его', 'но', 'да', 'ты', 'к', 'ко',
  'у', 'же', 'вы', 'за', 'бы', 'по', 'только', 'ее', 'её', 'мне', 'было', 'вот',
  'от', 'ото', 'меня', 'мной', 'еще', 'ещё', 'нет', 'о', 'об', 'обо', 'из',
  'изо', 'ему', 'ей', 'им', 'их', 'для', 'при', 'или', 'либо', 'это', 'про',
  'под', 'подо', 'над', 'надо', 'без', 'безо', 'уже', 'если', 'ли', 'до', 'через',
  'после', 'перед', 'передо', 'между', 'меж', 'вокруг', 'около', 'возле', 'внутри',
  'вне', 'вместо', 'кроме', 'помимо', 'ради', 'благодаря', 'вопреки', 'согласно',
  'среди', 'против', 'напротив', 'вдоль', 'поперек', 'сквозь',
  'мы', 'нас', 'нам', 'нами', 'вас', 'вам', 'вами', 'тебя', 'тебе', 'тобой',
  'них', 'ним', 'ними', 'ней', 'него', 'себя', 'себе', 'собой', 'кто', 'кого',
  'кому', 'кем', 'чего', 'чему', 'чем', 'какой', 'какая', 'какое', 'какие',
  'каких', 'каким', 'какую', 'который', 'которая', 'которое', 'которые', 'которых',
  'которым', 'которой', 'этот', 'эта', 'эти', 'этого', 'этому', 'этим', 'этом',
  'этой', 'этих', 'эту', 'тот', 'та', 'те', 'того', 'тому', 'тем', 'том', 'той',
  'тех', 'такой', 'такая', 'такое', 'такие', 'таких', 'сам', 'сама', 'само',
  'сами', 'самый', 'самая', 'самое', 'самые', 'самых', 'самым', 'весь', 'вся',
  'всех', 'всем', 'всего', 'всему', 'каждый', 'каждая', 'каждое', 'каждые',
  'любой', 'любая', 'любое', 'любые', 'другой', 'другая', 'другое', 'другие',
  'других', 'иной', 'свой', 'своя', 'свое', 'свои', 'своих', 'наш', 'наша',
  'наше', 'наши', 'наших', 'ваш', 'ваша', 'ваше', 'ваши', 'ваших', 'мой', 'моя',
  'мое', 'мои', 'твой', 'твоя', 'твое', 'твои', 'ничто', 'никто', 'нечего',
  'почему', 'зачем', 'сколько', 'насколько', 'когда', 'куда', 'откуда', 'где',
  'здесь', 'тут', 'там', 'туда', 'сюда', 'оттуда', 'отсюда', 'тогда', 'потом',
  'теперь', 'сейчас', 'сегодня', 'вчера', 'завтра', 'скоро', 'давно', 'недавно',
  'сначала', 'снова', 'опять', 'всегда', 'никогда', 'иногда', 'часто', 'редко',
  'пока', 'потому', 'поэтому', 'зато', 'однако', 'причем', 'притом', 'хотя',
  'чтобы', 'чтоб', 'будто', 'словно', 'точно', 'вроде', 'ведь', 'даже', 'лишь',
  'очень', 'просто', 'прямо', 'именно', 'конечно', 'наверное', 'возможно',
  'вероятно', 'действительно', 'реально', 'вообще', 'кстати', 'короче', 'впрочем',
  'наконец', 'почти', 'совсем', 'слишком', 'весьма', 'крайне', 'более', 'менее',
  'больше', 'меньше', 'лучше', 'хуже', 'много', 'мало', 'несколько', 'столько',
  'достаточно', 'можно', 'нужно', 'нельзя', 'пора', 'хватит', 'стоит', 'жаль',
  'ничего', 'нормально', 'хорошо', 'плохо', 'быстро', 'долго', 'вместе', 'рядом',
  'дальше', 'раньше', 'позже', 'дома', 'уж', 'ни',
  // Russian numbers, time-units, conversational verbs & YouTube/Web filler
  'год', 'года', 'году', 'годов', 'годах', 'лет', 'летие', 'месяц', 'месяца',
  'месяцев', 'неделя', 'недели', 'недель', 'день', 'дня', 'дней', 'час', 'часа',
  'часов', 'минута', 'минуты', 'минут', 'секунда', 'секунды', 'секунд', 'раз',
  'раза', 'время', 'времени', 'один', 'одна', 'одно', 'одного', 'два', 'две',
  'двух', 'три', 'трех', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять',
  'десять', 'сто', 'тысяча', 'тысяч', 'миллион', 'миллионов', 'миллиард',
  'первый', 'первая', 'первое', 'первых', 'второй', 'третий', 'последний',
  'следующий', 'новый', 'новая', 'новое', 'новые', 'нового', 'новых', 'новом',
  'старый', 'старая', 'старое', 'старые', 'большой', 'большая', 'большое',
  'большие', 'больших', 'маленький', 'огромный', 'настоящий', 'полный', 'полная',
  'полное', 'полные', 'главный', 'главная', 'главное', 'важный', 'важная',
  'важное', 'нужный', 'интересный', 'необычный', 'странный', 'крутой', 'жесткий',
  'сумасшедший', 'секретный', 'честный', 'лучшее', 'лучший', 'лучшая', 'лучшие',
  'худшее', 'популярный', 'быть', 'есть', 'были', 'была', 'будет', 'будут',
  'буду', 'стал', 'стала', 'стало', 'стали', 'станет', 'может', 'могут', 'мог',
  'могла', 'мочь', 'хочу', 'хочет', 'хотят', 'хотел', 'хотеть', 'делаю', 'делает',
  'делают', 'делал', 'сделал', 'сделать', 'делать', 'говорю', 'говорит', 'говорят',
  'сказал', 'сказать', 'знаю', 'знает', 'знают', 'узнал', 'узнать', 'понял',
  'понять', 'думаю', 'думает', 'считает', 'вижу', 'видит', 'видел', 'видеть',
  'смотрю', 'смотрит', 'смотреть', 'посмотрел', 'показать', 'показываю',
  'рассказываю', 'рассказал', 'объясняю', 'объяснил', 'разбираем', 'проверяю',
  'проверил', 'тестирую', 'попробовал', 'купил', 'нашел', 'найти', 'получил',
  'получить', 'взял', 'взять', 'дал', 'дать', 'идет', 'пошел', 'пришел', 'вышел',
  'прошел', 'оказался', 'живет', 'жить', 'прожил', 'поможет', 'привет',
  'видео', 'ролик', 'ролика', 'выпуск', 'серия', 'сезон', 'эпизод', 'часть',
  'канал', 'канала', 'стрим', 'подкаст', 'реакция', 'обзор', 'разбор', 'мнение',
  'итоги', 'мысли', 'ответ', 'ответы', 'вопрос', 'вопросы', 'совет', 'советы',
  'секрет', 'секреты', 'лайфхаки', 'ошибки', 'причина', 'причины', 'факты',
  'история', 'случай', 'опыт', 'пример', 'примеры', 'руководство', 'инструкция',
  'озвучка', 'перевод', 'субтитры', 'русский', 'русском', 'русская', 'русских',
  'русскому', 'английский', 'английском', 'бесплатно', 'онлайн', 'скачать',
  'подробно', 'коротко', 'целиком', 'полностью', 'впервые', 'случайно',
  'официальный', 'трейлер', 'тизер', 'анонс', 'релиз', 'премьера', 'клип',
  'шортс', 'топ', 'яндекс', 'поиск', 'статья', 'форум', 'блог', 'сайт',
  'страница', 'главная', 'новости', 'вкладка', 'гайд', 'туториал', 'строят',
  'ждёт', 'ждет', 'меняет', 'будут', 'нуля', 'с нуля',
  'правда', 'ложь', 'миф', 'мифы', 'реально', 'работает', 'работают', 'работать',
  'сделал', 'сделали', 'назад', 'ушел', 'ушёл', 'пришел', 'пришёл',
  'должен', 'должны', 'должна', 'ожидали', 'ожидал', 'случилось', 'произошло',
  'разница', 'отличие', 'своего', 'своей', 'своих', 'своему', 'моего', 'моей',
  'наших', 'ваших', 'шок', 'секрет', 'секреты', 'тайна', 'тайны', 'невероятно',
  'проверка', 'реакция', 'рейтинг', 'подборка', 'сравнение', 'итоги', 'ошибки',
  'главное', 'самое', 'простыми', 'словами', 'пальцах', 'почему', 'зачем',
  'когда', 'откуда', 'куда', 'сколько', 'какой', 'какая', 'какие',
  'который', 'которая', 'которые',
  'локальный', 'локальная', 'локальное', 'локальные', 'локально',
  'простой', 'простая', 'простое', 'простые', 'идеальный', 'идеальная', 'идеальное',
  'классический', 'классическая', 'классическое', 'домашний', 'домашняя', 'домашнее',
  'настоящий', 'настоящая', 'настоящее', 'быстрый', 'быстрая', 'быстрое',
  'полный', 'полная', 'полное', 'большой', 'огромный', 'секретный', 'секретная',
  // RU unseen clickbait / conversational predicates & adverbs
  'устроен', 'устроена', 'устроено', 'устроены', 'скрывают', 'скрывает', 'скрывали',
  'молчали', 'молчат', 'догадывался', 'догадывалась', 'догадывались',
  'десятилетиями', 'десятилетия', 'столетиями', 'годами', 'вслух', 'наяву',
  'навсегда', 'тайно', 'скрытно', 'происходит', 'происходят', 'произошли',
  'оказалось', 'оказались', 'никому', 'самом', 'целом', 'целый', 'главных',
  'первых', 'вторых', 'третьих', 'буквально', 'серьезно', 'честно', 'половина',
  'треть', 'миллионы', 'тысячи', 'сотни', 'забыли', 'узнали', 'поняли', 'решили',
  'внезапно', 'неожиданно', 'подробности', 'итого', 'далее', 'вперед', 'удивляет',
  'удивили', 'сломали', 'потеряли', 'обманывали', 'прятали', 'боялись', 'ждали',
  'запретил', 'запретила', 'запретили', 'потратил', 'потратила', 'потратили',
  'исчез', 'исчезла', 'исчезли', 'раскрыл', 'раскрыла', 'раскрыли', 'раскрыта', 'раскрыто',
  'обманул', 'обманула', 'обманули', 'сломал', 'сломала', 'убрал', 'убрала', 'убрали',
  'закрыл', 'закрыла', 'закрыли', 'открыл', 'открыла', 'открыли',
  'увидел', 'увидела', 'увидели', 'показал', 'показала', 'показали',
  'рассказал', 'рассказала', 'рассказали', 'выпустил', 'выпустила', 'выпустили',
  'делать', 'миллион', 'вещи', 'вещей', 'штука', 'штуки', 'штуку', 'приемы',
  // EN clickbait / conversational fillers
  'truth', 'really', 'actually', 'works', 'back', 'ago', 'left', 'came',
  'should', 'must', 'expected', 'happened', 'difference', 'shocking', 'insane',
  'crazy', 'ultimate', 'simple', 'easily', 'mistakes', 'reasons', 'everything',
  'nothing', 'anyone', 'everyone', 'someone', 'nobody', 'tells', 'hidden',
  'weird', 'strange', 'shocked', 'broken', 'honestly', 'literally', 'basically',
  'seriously', 'totally', 'decade', 'decades',
  'forever', 'overnight', 'stopped', 'changed', 'ruined', 'destroyed', 'banned',
  'doing', 'making', 'getting',
];

/**
 * Words that carry some context for matching/concepts, but MUST NEVER become a standalone group title.
 */
const TITLE_BANNED_STANDALONE = new Set([
  // RU generic nouns/adjectives & cooking/location modifiers
  'работа', 'работу', 'работы', 'жизнь', 'жизни', 'люди', 'людей', 'человек',
  'людьми', 'мир', 'мира', 'мире', 'дело', 'дела', 'город', 'города', 'страна',
  'страны', 'россия', 'россии', 'будущее', 'будущего', 'прошлое', 'настоящее',
  'ошибка', 'проблема', 'проблемы', 'способ', 'способы', 'результат', 'тест',
  'тесты', 'сравнение', 'выбор', 'список', 'рынок', 'рынка', 'компания',
  'компании', 'система', 'системы', 'проект', 'проекты', 'данные', 'данных',
  'сервис', 'уровень', 'режим', 'формат', 'модель', 'модели', 'версия',
  'деньги', 'денег', 'цена', 'цены', 'бизнес', 'доход', 'дом', 'дома', 'вещи',
  'вещь', 'слова', 'слово', 'идея', 'идеи', 'план', 'планы', 'курс', 'урок',
  'уроки', 'книга', 'книги', 'задача', 'задачи', 'решение', 'решения', 'путь',
  'шанс', 'повод', 'тема', 'темы', 'суть', 'факт', 'факта', 'эффект', 'сила',
  'роль', 'место', 'центр', 'база', 'основа', 'основы', 'финал', 'начало', 'конец',
  'рецепт', 'рецепты', 'духовка', 'духовке', 'духовки', 'духовку', 'духовкой',
  'сковорода', 'сковороде', 'сковородка', 'сковородке', 'кастрюля', 'кастрюле',
  'плита', 'плите', 'мультиварка', 'мультиварке', 'кухня', 'кухне', 'тарелка',
  'тарелке', 'блюдо', 'блюда', 'ужин', 'обед', 'завтрак', 'вкусный', 'вкусная',
  'вкусное', 'вкусно', 'сочный', 'сочная', 'хрустящий', 'хрустящая', 'пошаговый',
  'домашний', 'домашняя', 'домашнее',
  // EN generic nouns/adjectives & cooking/location modifiers
  'work', 'working', 'life', 'people', 'world', 'city', 'country', 'future',
  'past', 'error', 'errors', 'problem', 'problems', 'result', 'results', 'test',
  'tests', 'testing', 'comparison', 'choice', 'list', 'market', 'company',
  'system', 'systems', 'project', 'projects', 'data', 'service', 'level', 'mode',
  'format', 'model', 'models', 'version', 'money', 'price', 'business', 'home',
  'house', 'word', 'words', 'idea', 'ideas', 'plan', 'plans', 'lesson', 'lessons',
  'book', 'books', 'task', 'tasks', 'solution', 'solutions', 'story', 'stories',
  'tips', 'tricks', 'secrets', 'hacks', 'guide', 'guides', 'build', 'builds',
  'notes', 'note', 'docs', 'doc', 'stuff', 'update', 'updates', 'patch', 'news',
  'study', 'hours', 'hour', 'mix', 'chill', 'deep', 'prep', 'growth', 'roadmap',
  'explained', 'question', 'questions', 'answer', 'answers', 'type', 'types',
  'item', 'items', 'topic', 'topics', 'thing', 'things', 'recipe', 'recipes',
  'oven', 'skillet', 'pan', 'kitchen', 'dinner', 'lunch', 'breakfast',
  'delicious', 'crispy', 'tasty', 'homemade',
  'documentation', 'remastered', 'live', 'official', 'edition', 'complete',
  'part', 'episode', 'reason', 'reasons', 'truth', 'difference', 'secret',
  'документация', 'документации', 'часть', 'серия', 'выпуск', 'эпизод',
  'правда', 'работают', 'работает', 'разница', 'секрет', 'секреты', 'секретные',
  'концовка', 'концовки', 'фишка', 'фишки', 'причина', 'причины',
  'история', 'истории', 'книга', 'книги',
  'chrome', 'firefox', 'safari', 'edge', 'browser', 'extensions', 'extension',
  'браузер', 'браузере', 'браузера', 'расширение', 'расширения', 'расширений',
  'обучение', 'обучения', 'обучению', 'изучение', 'изучения', 'введение', 'тренировка', 'практика',
  'learning', 'training', 'course', 'courses', 'tutorial', 'tutorials',
  'intro', 'introduction', 'basics', 'fundamentals',
]);

/** Whitelisted 2-char technical / domain tokens allowed as content tokens. */
const SHORT_WHITELIST_TOKENS = new Set([
  'ai',
  'ии',
  'ml',
  'ui',
  'ux',
  'vr',
  'ar',
  '3d',
  'pc',
  'пк',
  'js',
  'ts',
  'db',
  'os',
  'io',
]);

const PROTECTED_ENGLISH_STUBS = new Set([
  'kubernetes',
  'linux',
  'macos',
  'windows',
  'nextjs',
  'vuejs',
  'threejs',
  'nodejs',
  'physics',
  'graphics',
  'electronics',
  'economics',
  'analytics',
  'mechanics',
  'redis',
  'basis',
  'analysis',
  'crisis',
  'news',
  'series',
  'species',
  'status',
  'focus',
  'opus',
  'corpus',
  'genius',
  'gaming',
  'coding',
  'cooking',
  'shopping',
  'hosting',
  'building',
  'learning',
  'trading',
  'string',
  'thing',
  'spring',
  'during',
  'nothing',
  'claude',
  'aws',
  'css',
  'rss',
  'ios',
]);

const CYRILLIC_SUFFIXES: readonly string[] = [
  'иями', 'оями', 'еями',
  'ями', 'ами', 'ого', 'его', 'ему', 'ому', 'ыми', 'ими', 'иях', 'ией', 'йте',
  'ать', 'ять', 'ить', 'еть', 'уть', 'оть', 'ешь', 'ете', 'ите', 'ишь', 'ьте',
  'ают', 'яют', 'уют', 'ает', 'яет', 'аем', 'яем',
  'ала', 'яла', 'ила', 'ела', 'ало', 'яло', 'ило', 'ело', 'али', 'яли', 'или', 'ели',
  'ях', 'ах', 'ев', 'ов', 'ей', 'ам', 'ям', 'ем', 'ом', 'ой', 'ий', 'ый',
  'ая', 'ое', 'ее', 'яя', 'ые', 'их', 'ых', 'ую', 'юю', 'ия', 'ие', 'ью', 'ть', 'ти',
  'ет', 'ут', 'ют', 'ит', 'ат', 'ят', 'ил', 'ал', 'ла', 'ло', 'ли', 'аю', 'яю',
  'а', 'я', 'у', 'ю', 'е', 'и', 'ы', 'о', 'ь', 'й',
];

const STEM_CACHE = new Map<string, string>();
const MAX_STEM_CACHE_SIZE = 2048;

function computeStemWord(normalized: string): string {
  if (!normalized || normalized.length < 4) {
    return normalized;
  }

  // Cyrillic inflectional stemmer (keeps stem length >= 3)
  if (/[\u0400-\u04FF]/u.test(normalized)) {
    let stem = normalized;
    if (stem.length >= 6 && (stem.endsWith('ся') || stem.endsWith('сь'))) {
      stem = stem.slice(0, -2);
    }
    for (const suffix of CYRILLIC_SUFFIXES) {
      if (stem.endsWith(suffix) && stem.length - suffix.length >= 3) {
        return stem.slice(0, -suffix.length);
      }
    }
    return stem;
  }

  // Conservative English stemmer
  if (/^[a-z][a-z0-9-]*$/.test(normalized)) {
    if (PROTECTED_ENGLISH_STUBS.has(normalized)) {
      return normalized;
    }
    if (normalized.length >= 5 && normalized.endsWith('ies')) {
      return `${normalized.slice(0, -3)}y`;
    }
    if (normalized.length >= 7 && normalized.endsWith('ing')) {
      return normalized.slice(0, -3);
    }
    if (normalized.length >= 6 && normalized.endsWith('ed')) {
      return normalized.slice(0, -2);
    }
    if (
      normalized.length >= 5 &&
      normalized.endsWith('es') &&
      !normalized.endsWith('sses') &&
      !normalized.endsWith('ies')
    ) {
      if (/(ches|shes|xes|zes|sses|oes)$/.test(normalized)) {
        return normalized.slice(0, -2);
      }
      return normalized.slice(0, -1);
    }
    if (
      normalized.length >= 4 &&
      normalized.endsWith('s') &&
      !normalized.endsWith('ss') &&
      !normalized.endsWith('us') &&
      !normalized.endsWith('is') &&
      !normalized.endsWith('ics') &&
      !normalized.endsWith('js') &&
      !normalized.endsWith('ts')
    ) {
      return normalized.slice(0, -1);
    }
  }

  return normalized;
}

export function stemWord(rawToken: string): string {
  const normalized = rawToken.toLowerCase().replace(/ё/g, 'е').trim();
  if (!normalized || normalized.length < 4) {
    return normalized;
  }

  const cached = STEM_CACHE.get(normalized);
  if (cached !== undefined) {
    return cached;
  }

  const result = computeStemWord(normalized);
  if (STEM_CACHE.size >= MAX_STEM_CACHE_SIZE) {
    const oldestKey = STEM_CACHE.keys().next().value;
    if (oldestKey !== undefined) {
      STEM_CACHE.delete(oldestKey);
    }
  }
  STEM_CACHE.set(normalized, result);
  return result;
}

const STOP_WORDS = new Set<string>(RAW_STOP_WORDS.map((w) => w.replace(/ё/g, 'е')));
const STOP_WORDS_STEMMED = new Set<string>(RAW_STOP_WORDS.map((w) => stemWord(w)));
const BANNED_STANDALONE_STEMMED = new Set<string>(
  [...TITLE_BANNED_STANDALONE].map((w) => stemWord(w)),
);

export function isGenericOrStopWord(tokenOrStem: string): boolean {
  const norm = tokenOrStem.toLowerCase().replace(/ё/g, 'е').trim();
  if (!norm) return true;
  if (STOP_WORDS.has(norm) || STOP_WORDS_STEMMED.has(norm)) return true;
  const stemmed = stemWord(norm);
  if (STOP_WORDS.has(stemmed) || STOP_WORDS_STEMMED.has(stemmed)) return true;
  return false;
}

export function isBannedStandaloneTitleWord(tokenOrStem: string): boolean {
  if (isGenericOrStopWord(tokenOrStem)) return true;
  const norm = tokenOrStem.toLowerCase().replace(/ё/g, 'е').trim();
  const stemmed = stemWord(norm);
  return (
    TITLE_BANNED_STANDALONE.has(norm) ||
    BANNED_STANDALONE_STEMMED.has(norm) ||
    TITLE_BANNED_STANDALONE.has(stemmed) ||
    BANNED_STANDALONE_STEMMED.has(stemmed)
  );
}

export function stripSiteTitleBoilerplate(rawTitle: string): string {
  if (!rawTitle) return '';
  return rawTitle
    .replace(/^\(\d+\)\s+/, '')
    .replace(/^\[\d+\]\s+/, '')
    .replace(
      /\s*[-–—|·•/]\s*(YouTube|Google Search|Поиск в Google|Google Поиск|Яндекс|Bing|DuckDuckGo|Perplexity|GitHub|GitLab|Stack Overflow|Wikipedia|Википедия|Хабр|Habr|Medium|Reddit|Wildberries|Ozon|AliExpress|Amazon|MDN Web Docs|MDN)\s*$/iu,
      '',
    )
    .replace(/\[(4K|HD|FHD|60fps|Official[^[\]]*|Sub|Rus|Eng|Lyrics|Audio|Video)\]/giu, ' ')
    .replace(
      /\((Official\s+(Music\s+)?(Video|Audio|Trailer|Teaser)|Lyrics|4K|HD|1080p|Remastered(\s+\d{4})?|202\d)\)/giu,
      ' ',
    )
    .replace(/#(shorts|video|youtube)\b/giu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractTicketIdentifiers(title: string): string[] {
  if (!title) return [];
  const results = new Set<string>();

  const jiraRegex = /\b([A-Z]{2,10}-\d{1,7})\b/g;
  let match: RegExpExecArray | null;
  while ((match = jiraRegex.exec(title)) !== null) {
    if (match[1]) {
      results.add(match[1].toUpperCase());
    }
  }

  const prHashRegex = /(?:\bPR\s*#?|\B#)(\d{2,7})\b/gi;
  while ((match = prHashRegex.exec(title)) !== null) {
    if (match[1]) {
      results.add(`#${match[1]}`);
    }
  }

  return [...results];
}

export type TokenSalienceTier = 0 | 1 | 2;

export interface AnalyzedToken {
  raw: string;
  lower: string;
  stem: string;
  salience: 1 | 2;
}

export interface AnalyzedTitleSemantics {
  tokens: readonly AnalyzedToken[];
  stems: readonly string[];
  highSalienceStems: readonly string[];
  bigrams: ReadonlyArray<{ key: string; display: string }>;
}

const RU_VERB_PARTICIPLE_SUFFIX_RE =
  /(?:ться|тся|лся|лась|лось|лись|ают|яют|уют|еют|ает|яет|ует|еет|аем|яем|уем|ешь|ишь|айте|яйте|уйте|итесь|айтесь|яйтесь|устроен[аоы]?|ывал(?:а|о|и)?|ивал(?:а|о)?|ано|яно|ено|аны|яны|ены|шло|шли|шла)$/u;

const EN_ADVERB_FILLER_SUFFIX_RE =
  /(?:ingly|edly|ously|lessly|fully|tely|sely|vely|nely|ally)$/i;

const RU_OBLIQUE_OR_GENERIC_ADJ_RE =
  /(?:ами|ями|ах|ях|ая|ое|ые|ый|ого|ому|ым|ых|ую|его|ему)$/u;

const RU_CLICKBAIT_PAST_VERB_RE = /(?:или|али|яли|нули|езли)$/u;
const RU_SAFE_PLURAL_NOUN_RE = /(?:фестивал|спирал|вертикал|диагонал|магистрал)и$/u;
const EN_NON_CONCEPT_VERB_RE =
  /^[a-z]{5,}(?:pped|tted|nned|gged|dded|shed|ched|nied|ried|ated|ized|ised|ened|ined|oyed|nged|oved|rted)$/;

/**
 * Morphological filter blocking unseen clickbait predicates, verbs,
 * and conversational adverbs when not recognized as primary concept keywords.
 */
export function isMorphologicalNoiseToken(
  rawToken: string,
  lowerToken?: string,
  allowProperCase = true,
): boolean {
  const raw = rawToken.trim();
  const lower = (lowerToken ?? raw.toLowerCase()).replace(/ё/g, 'е');
  if (lower.length < 4) return false;
  // Preserve mid-sentence capitalized proper nouns when casing is reliable
  if (allowProperCase && /^[A-ZА-ЯЁ]/.test(raw)) return false;
  if (isPrimaryConceptKeyword(lower)) return false;
  if (TITLE_BANNED_STANDALONE.has(lower)) return false;

  if (/[а-я]/.test(lower) && RU_VERB_PARTICIPLE_SUFFIX_RE.test(lower)) {
    return true;
  }
  if (/^[a-z]+$/.test(lower) && EN_ADVERB_FILLER_SUFFIX_RE.test(lower)) {
    return true;
  }
  return false;
}

function classifyTokenSalience(
  raw: string,
  lower: string,
  stem: string,
  allowCapitalProperSignal = true,
  isAllCapsTitle = false,
): TokenSalienceTier {
  if (/^\d+$/.test(lower)) return 0;
  if (lower.length < 3 && !SHORT_WHITELIST_TOKENS.has(lower)) return 0;
  if (STOP_WORDS.has(lower)) return 0;
  if (stem.length < 2) return 0;
  if (STOP_WORDS.has(stem) || STOP_WORDS_STEMMED.has(stem)) return 0;
  if (isMorphologicalNoiseToken(raw, lower, allowCapitalProperSignal)) return 0;

  if (isBannedStandaloneTitleWord(lower) || isBannedStandaloneTitleWord(stem)) {
    return 1;
  }

  const isShortAcronym = !isAllCapsTitle && /^[A-ZА-ЯЁ0-9]{2,5}$/.test(raw);
  const isCamelCase = /[a-z][A-Z]/.test(raw);
  const isMidSentenceProper = allowCapitalProperSignal && /^[A-ZА-ЯЁ]/.test(raw);
  const isProperOrTechForm = isShortAcronym || isCamelCase || isMidSentenceProper;

  if (isProperOrTechForm || isPrimaryConceptKeyword(lower) || isPrimaryConceptKeyword(stem)) {
    return 2;
  }

  // Unseen Russian past-plural clickbait verbs & oblique forms stay Tier 1 when capitalization isn't proper-noun signal
  if (
    /[а-я]/.test(lower) &&
    (RU_OBLIQUE_OR_GENERIC_ADJ_RE.test(lower) ||
      (lower.length >= 7 &&
        RU_CLICKBAIT_PAST_VERB_RE.test(lower) &&
        !RU_SAFE_PLURAL_NOUN_RE.test(lower)))
  ) {
    return 1;
  }

  if (EN_NON_CONCEPT_VERB_RE.test(lower)) {
    return 1;
  }

  return 2;
}

function computeTitleCasingProfile(rawWords: readonly string[]): {
  isAllCapsTitle: boolean;
  isTitleCaseTitle: boolean;
} {
  let alphaCount = 0;
  let allCapsCount = 0;
  let capStartCount = 0;
  for (const w of rawWords) {
    if (!/\p{L}/u.test(w)) continue;
    alphaCount++;
    if (w === w.toUpperCase() && w !== w.toLowerCase()) allCapsCount++;
    if (/^[A-ZА-ЯЁ]/u.test(w)) capStartCount++;
  }
  const isAllCapsTitle = alphaCount >= 2 && allCapsCount === alphaCount;
  const isTitleCaseTitle =
    !isAllCapsTitle && alphaCount >= 3 && capStartCount >= Math.ceil(alphaCount * 0.75);
  return { isAllCapsTitle, isTitleCaseTitle };
}

const ANALYZED_TOKENS_CACHE = new Map<string, readonly AnalyzedToken[]>();
const STEMMED_TOKENS_CACHE = new Map<string, readonly string[]>();
const ENTITY_BIGRAMS_CACHE = new Map<string, ReadonlyArray<{ key: string; display: string }>>();
const SEMANTICS_CACHE = new Map<string, AnalyzedTitleSemantics>();

function extractAnalyzedTokens(title: string): readonly AnalyzedToken[] {
  const cached = ANALYZED_TOKENS_CACHE.get(title);
  if (cached) return cached;

  const cleaned = stripSiteTitleBoilerplate(title);
  if (!cleaned) {
    return [];
  }

  const rawWords = cleaned
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);

  const { isAllCapsTitle, isTitleCaseTitle } = computeTitleCasingProfile(rawWords);
  const result: AnalyzedToken[] = [];

  for (let idx = 0; idx < rawWords.length; idx++) {
    const raw = rawWords[idx];
    if (!raw) continue;
    const lower = raw.toLowerCase().replace(/ё/g, 'е');
    const stem = stemWord(lower);
    const allowCapitalProperSignal = !isAllCapsTitle && !isTitleCaseTitle && idx > 0;
    const salience = classifyTokenSalience(
      raw,
      lower,
      stem,
      allowCapitalProperSignal,
      isAllCapsTitle,
    );
    if (salience === 0) continue;

    result.push({ raw, lower, stem, salience });
  }

  if (ANALYZED_TOKENS_CACHE.size >= 1024) ANALYZED_TOKENS_CACHE.clear();
  ANALYZED_TOKENS_CACHE.set(title, result);
  return result;
}

export function tokenizeTitle(title: string): string[] {
  const cached = STEMMED_TOKENS_CACHE.get(title);
  if (cached) return [...cached];

  const analyzed = extractAnalyzedTokens(title);
  const seen = new Set<string>();
  const filtered: string[] = [];

  for (const item of analyzed) {
    if (!seen.has(item.stem)) {
      seen.add(item.stem);
      filtered.push(item.stem);
    }
  }

  if (STEMMED_TOKENS_CACHE.size >= 1024) STEMMED_TOKENS_CACHE.clear();
  STEMMED_TOKENS_CACHE.set(title, filtered);
  return [...filtered];
}

/**
 * Extracts normalized high-salience bigrams with display text for phrase/entity detection
 * (e.g. "Mobile Legends", "Elden Ring", "AI Agents", "System Design").
 */
export function extractEntityBigrams(title: string): Array<{ key: string; display: string }> {
  const cached = ENTITY_BIGRAMS_CACHE.get(title);
  if (cached) return [...cached];

  const cleaned = stripSiteTitleBoilerplate(title);
  if (!cleaned) return [];

  const words = cleaned
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);

  const { isAllCapsTitle, isTitleCaseTitle } = computeTitleCasingProfile(words);
  const bigrams: Array<{ key: string; display: string }> = [];
  const seen = new Set<string>();

  for (let i = 0; i < words.length - 1; i++) {
    const w1 = words[i];
    const w2 = words[i + 1];
    if (!w1 || !w2) continue;

    const l1 = w1.toLowerCase().replace(/ё/g, 'е');
    const l2 = w2.toLowerCase().replace(/ё/g, 'е');
    const s1 = stemWord(l1);
    const s2 = stemWord(l2);

    const allowCap1 = !isAllCapsTitle && !isTitleCaseTitle && i > 0;
    const allowCap2 = !isAllCapsTitle && !isTitleCaseTitle && i + 1 > 0;

    // Require both words to pass 3-tier high-salience gating so clickbait/modifiers never form entity phrases
    if (classifyTokenSalience(w1, l1, s1, allowCap1, isAllCapsTitle) !== 2) continue;
    if (classifyTokenSalience(w2, l2, s2, allowCap2, isAllCapsTitle) !== 2) continue;

    const key = `${s1} ${s2}`;
    if (!seen.has(key)) {
      seen.add(key);
      bigrams.push({ key, display: `${w1} ${w2}` });
    }
  }

  if (ENTITY_BIGRAMS_CACHE.size >= 1024) ENTITY_BIGRAMS_CACHE.clear();
  ENTITY_BIGRAMS_CACHE.set(title, bigrams);
  return [...bigrams];
}

export function analyzeTitleSemantics(title: string): AnalyzedTitleSemantics {
  const cached = SEMANTICS_CACHE.get(title);
  if (cached) return cached;

  const tokens = extractAnalyzedTokens(title);
  const stems = tokenizeTitle(title);
  const highSalienceSeen = new Set<string>();
  const highSalienceStems: string[] = [];
  for (const item of tokens) {
    if (item.salience === 2 && !highSalienceSeen.has(item.stem)) {
      highSalienceSeen.add(item.stem);
      highSalienceStems.push(item.stem);
    }
  }
  const bigrams = extractEntityBigrams(title);
  const result: AnalyzedTitleSemantics = { tokens, stems, highSalienceStems, bigrams };

  if (SEMANTICS_CACHE.size >= 1024) SEMANTICS_CACHE.clear();
  SEMANTICS_CACHE.set(title, result);
  return result;
}

export function computeJaccardSimilarity(
  tokensA: readonly string[],
  tokensB: readonly string[],
): number {
  if (tokensA.length === 0 || tokensB.length === 0) return 0;
  const setA = new Set(tokensA);
  const setB = new Set(tokensB);

  let intersection = 0;
  for (const t of setA) {
    if (setB.has(t)) {
      intersection++;
    }
  }

  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export function computeContextualAffinityScore(
  tabA: TabMetadata,
  tabB: TabMetadata,
  tokensA?: readonly string[],
  tokensB?: readonly string[],
): number {
  const tA = tokensA ?? tokenizeTitle(tabA.title);
  const tB = tokensB ?? tokenizeTitle(tabB.title);

  const jaccard = computeJaccardSimilarity(tA, tB);

  let sharedCount = 0;
  let strongSharedCount = 0;
  const setB = new Set(tB);
  for (const w of tA) {
    if (setB.has(w)) {
      sharedCount++;
      if (!isBannedStandaloneTitleWord(w)) {
        strongSharedCount++;
      }
    }
  }
  const minLen = Math.min(tA.length, tB.length);
  const overlapCoeff = minLen > 0 ? sharedCount / minLen : 0;

  let score = Math.max(jaccard, overlapCoeff * 0.65);

  if (tabA.openerTabId === tabB.id || tabB.openerTabId === tabA.id) {
    score += 0.55;
  } else if (
    typeof tabA.openerTabId === 'number' &&
    tabA.openerTabId === tabB.openerTabId
  ) {
    score += 0.35;
  }

  // Only grant temporal/positional proximity bonus when strong content overlap actually exists
  if (strongSharedCount >= 1) {
    if (typeof tabA.lastAccessed === 'number' && typeof tabB.lastAccessed === 'number') {
      const deltaMs = Math.abs(tabA.lastAccessed - tabB.lastAccessed);
      if (deltaMs <= 180_000) {
        score += 0.22 * (1 - deltaMs / 180_000);
      }
    }

    const posA = tabA.index ?? tabA.id;
    const posB = tabB.index ?? tabB.id;
    const posDist = Math.abs(posA - posB);
    if (posDist <= 2) {
      score += 0.15 * (1 - (posDist - 1) * 0.4);
    }
  }

  return Number(score.toFixed(3));
}

function chooseBestSurfaceForm(forms: readonly string[]): string {
  if (forms.length === 0) return '';

  const counts = new Map<string, number>();
  for (const f of forms) {
    counts.set(f, (counts.get(f) ?? 0) + 1);
  }

  const scored = [...counts.entries()].sort((a, b) => {
    const [wordA, cntA] = a;
    const [wordB, cntB] = b;

    // Prefer crisp acronyms (NVIDIA, AI, LLM) and CamelCase (TypeScript, LangGraph)
    const isAcronymA = /^[A-ZА-ЯЁ0-9]{2,8}$/.test(wordA) ? 1 : 0;
    const isAcronymB = /^[A-ZА-ЯЁ0-9]{2,8}$/.test(wordB) ? 1 : 0;
    if (isAcronymB !== isAcronymA) return isAcronymB - isAcronymA;

    const isCamelA = /[a-z][A-Z]/.test(wordA) ? 1 : 0;
    const isCamelB = /[a-z][A-Z]/.test(wordB) ? 1 : 0;
    if (isCamelB !== isCamelA) return isCamelB - isCamelA;

    const isCapA = /^[A-ZА-ЯЁ]/.test(wordA) ? 1 : 0;
    const isCapB = /^[A-ZА-ЯЁ]/.test(wordB) ? 1 : 0;
    if (isCapB !== isCapA) return isCapB - isCapA;

    if (cntB !== cntA) return cntB - cntA;

    // Prefer shortest natural inflection (e.g. nominative over instrumental plural)
    return wordA.length - wordB.length;
  });

  const best = scored[0]?.[0] ?? forms[0] ?? '';
  if (/^[A-ZА-ЯЁ0-9]{2,8}$/.test(best) || /[a-z][A-Z]/.test(best)) {
    return best;
  }
  return best.charAt(0).toUpperCase() + best.slice(1);
}

export function truncateCleanTitle(rawTitle: string, maxLength = 22): string {
  const clean = rawTitle.trim().replace(/\s+/g, ' ');
  if (clean.length <= maxLength) {
    return clean.replace(/[\s·:|\\/\-–—]+$/u, '').trim() || clean;
  }
  const words = clean.split(' ');
  const kept: string[] = [];
  for (const w of words) {
    const candidate = kept.length === 0 ? w : `${kept.join(' ')} ${w}`;
    if (candidate.length <= maxLength) {
      kept.push(w);
    } else {
      break;
    }
  }
  const raw = kept.length > 0 ? kept.join(' ') : clean.slice(0, maxLength);
  return raw.replace(/[\s·:|\\/\-–—]+$/u, '').trim() || clean.slice(0, maxLength).trim();
}

export function synthesizeHumanGroupTitle(
  memberTabs: readonly TabMetadata[],
  fallbackDomainKey?: string,
  windowPriors?: ReadonlyMap<ConceptId, number>,
  excludedStems?: ReadonlySet<string>,
): { groupName: string; emoji: string } {
  if (memberTabs.length === 0) {
    return { groupName: 'Focus Cluster', emoji: '✨' };
  }

  const minRequiredCount = memberTabs.length >= 2 ? 2 : 1;

  // 1. Prefer natural multi-word high-salience entity bigrams (e.g. "Mobile Legends", "Elden Ring", "AI Agents")
  const bigramCounts = new Map<string, { count: number; forms: string[] }>();
  for (const tab of memberTabs) {
    for (const bg of extractEntityBigrams(tab.title)) {
      if (
        excludedStems &&
        excludedStems.size > 0 &&
        bg.key.split(' ').every((k) => excludedStems.has(k))
      ) {
        continue;
      }
      const entry = bigramCounts.get(bg.key);
      if (entry) {
        entry.count += 1;
        entry.forms.push(bg.display);
      } else {
        bigramCounts.set(bg.key, { count: 1, forms: [bg.display] });
      }
    }
  }

  const bestBigram = [...bigramCounts.entries()]
    .filter(([, stat]) => stat.count >= minRequiredCount)
    .sort(
      (a, b) =>
        b[1].count - a[1].count ||
        (b[1].forms[0]?.length ?? 0) - (a[1].forms[0]?.length ?? 0),
    )[0];

  if (bestBigram) {
    const displayForms = bestBigram[1].forms;
    const wordsPerTab = displayForms.map((f) => f.split(' '));
    const firstWord = chooseBestSurfaceForm(
      wordsPerTab.map((p) => p[0] ?? '').filter(Boolean),
    );
    const secondWord = chooseBestSurfaceForm(
      wordsPerTab.map((p) => p[1] ?? '').filter(Boolean),
    );
    const title = truncateCleanTitle(`${firstWord} ${secondWord}`.trim());
    if (title.length >= 3) {
      const emoji = inferHarmoniousEmojiForTopic([firstWord, secondWord]);
      return { groupName: title, emoji };
    }
  }

  // 2. Fall back to top high-salience stemmed tokens mapped to natural surface forms
  const tokenStats = new Map<
    string,
    { tabCount: number; posSum: number; forms: string[]; isEntity: boolean; tabIndices: Set<number> }
  >();

  memberTabs.forEach((tab, tabIdx) => {
    const analyzed = extractAnalyzedTokens(tab.title);
    const seenInTab = new Set<string>();
    analyzed.forEach((item, idx) => {
      if (item.salience !== 2) {
        return;
      }
      if (excludedStems?.has(item.stem)) {
        return;
      }
      const isUpper = /^[A-ZА-ЯЁ]/.test(item.raw);
      const existing = tokenStats.get(item.stem);
      if (existing) {
        if (!seenInTab.has(item.stem)) {
          existing.tabCount += 1;
          existing.posSum += idx;
          existing.tabIndices.add(tabIdx);
          seenInTab.add(item.stem);
        }
        existing.forms.push(item.raw);
        existing.isEntity = existing.isEntity || isUpper;
      } else {
        seenInTab.add(item.stem);
        tokenStats.set(item.stem, {
          tabCount: 1,
          posSum: idx,
          forms: [item.raw],
          isEntity: isUpper,
          tabIndices: new Set([tabIdx]),
        });
      }
    });
  });

  const minDominantCount =
    memberTabs.length >= 4 ? Math.ceil(memberTabs.length * 0.5) : minRequiredCount;

  const rankedTokens = [...tokenStats.entries()]
    .filter(([, stat]) => stat.tabCount >= minDominantCount)
    .sort((a, b) => {
      if (b[1].tabCount !== a[1].tabCount) return b[1].tabCount - a[1].tabCount;
      if (b[1].isEntity !== a[1].isEntity) return Number(b[1].isEntity) - Number(a[1].isEntity);
      return a[1].posSum / a[1].tabCount - b[1].posSum / b[1].tabCount;
    })
    .slice(0, 2)
    .sort((a, b) => a[1].posSum / a[1].tabCount - b[1].posSum / b[1].tabCount);

  if (rankedTokens.length > 0) {
    const first = rankedTokens[0];
    const second = rankedTokens[1];
    let selected = rankedTokens;
    if (first && second) {
      // Only combine two single words if they co-occur in at least one member tab
      let coOccurs = false;
      for (const tabIdx of first[1].tabIndices) {
        if (second[1].tabIndices.has(tabIdx)) {
          coOccurs = true;
          break;
        }
      }
      if (!coOccurs) {
        selected = first[1].tabCount >= second[1].tabCount ? [first] : [second];
      }
    }

    const displayWords = selected.map(([, stat]) => chooseBestSurfaceForm(stat.forms));
    let humanTitle = displayWords[0] ?? '';
    if (displayWords[1] && `${humanTitle} ${displayWords[1]}`.length <= 22) {
      humanTitle = `${humanTitle} ${displayWords[1]}`;
    }
    humanTitle = truncateCleanTitle(humanTitle);
    if (humanTitle && !isBannedStandaloneTitleWord(humanTitle)) {
      const emoji = inferHarmoniousEmojiForTopic(displayWords);
      return { groupName: humanTitle, emoji };
    }
  }

  // 3. Semantic Concept consensus fallback (if tabs share a clear topic concept)
  const conceptCounts = new Map<ConceptId, number>();
  for (const tab of memberTabs) {
    const dInfo = extractDomainInfo(tab.url);
    const c = classifyTabConcept(tab, dInfo, windowPriors ? { windowPriors } : undefined);
    if (c) {
      conceptCounts.set(c.conceptId, (conceptCounts.get(c.conceptId) ?? 0) + 1);
    }
  }
  const topConcept = [...conceptCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  if (topConcept && topConcept[1] >= minRequiredCount) {
    const preferRu = memberTabs.some((t) => hasCyrillicText(t.title));
    const meta = getConceptDisplayMeta(topConcept[0], preferRu);
    return { groupName: meta.label, emoji: meta.emoji };
  }

  // 4. Clean Domain fallback
  if (fallbackDomainKey) {
    const meta = formatDomainGroupMeta(fallbackDomainKey);
    return { groupName: meta.groupName, emoji: meta.emoji };
  }

  return { groupName: 'Focus Cluster', emoji: '✨' };
}

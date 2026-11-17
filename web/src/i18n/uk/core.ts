// Ukrainian strings: shared UI and formatting.
import type en from '../en/core';

export default {
  'lang.switch': 'Мова',
  'lang.en': 'EN',
  'lang.uk': 'UK',
  'lang.en.title': 'English',
  'lang.uk.title': 'Українська',
  'fmt.justNow': 'щойно',
  'fmt.ago': '{d} тому',
  'fmt.sec': '{n} с',
  'fmt.min': '{n} хв',
  'fmt.hour': '{n} год',
  'fmt.hourMin': '{h} год {m} хв',
  'fmt.dayHour': '{d} д {h} год',
  'fmt.days': '{n} дн',
  'fmt.thousand': '{n} тис.',
  'fmt.million': '{n} млн',
  'fmt.billion': '{n} млрд',
  'fmt.pct': '{n} %',
  'api.unreachable': 'Сервер недоступний',
  'api.unreachableStatus': 'Сервер недоступний ({status})',
  'api.serverError': 'Помилка сервера: {status}',
  'api.loadFailed': 'Не вдалося завантажити дані',
} satisfies Record<keyof typeof en, string>;

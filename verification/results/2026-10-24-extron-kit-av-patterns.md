# Extron Kit: AV-сценарии, иконки и размеры — 24.10.2026

Ревизия `2026-10-24-av-patterns`, plugin/CLI 0.7.3, EXUI/5. Дополнение к Apple-inspired Light по [исследованию](../../design/extron-kit/RESEARCH-2026-10-24.md). Изменены генератор Figma, эталон pen.dev и визуальная веб-документация.

## Результат

- Сохраняются 30 семейств / 57 основных компонентов. Добавлен раздел **06 AV-сценарии**: `project_AVPatterns` с пятью страницами Welcome, Presentation, AudioZones, ConnectionHelp, SystemStatus и `modalpopup_Shutdown`. Для каждого из двух профилей своя компоновка: 1280×800 и 320×480.
- Добавлен раздел **07 Иконки и размеры**: 18 SVG Lucide (`lucide-static` 1.61.0, SHA-512 npm-архива закреплён в `design/extron-kit/icons/icons.json`), символ 24 px, цели кнопок от 56 px, шкала отступов 8/16/24/32/48/64. Иконки не имеют controlId. ISC/MIT-уведомления — `licenses/lucide.txt` в архиве плагина.
- Источник состава: `design/extron-kit/patterns.json`; генератор — `src/figma-plugin/src/kit-patterns.ts`; сценарий pen.dev — `design/extron-kit/extend-av-patterns-2026-10-24.pen.js`.
- Веб-документация: галерея 12 компоновок с переключением профиля, страница каждого сценария с контрактом и обязанностями программы управления, галерея иконок со скачиванием SVG.

## Проверки

| Проверка | Результат |
|---|---|
| `npm run verify --prefix src/figma-plugin` | TypeScript, build, 619/619 тестов |
| Реальная CLI-конвертация 1025M | screen 251/251; project 191/191; patterns 674/674 |
| Реальная CLI-конвертация 300M portrait | screen 149/149; project 191/191; patterns 594/594 |
| Все 28 DateTime Pattern через writer | 309/309 |
| `project_AVPatterns` в GDL | 5 страниц, 1 modal popup, Multilevel Starting/Ready/Offline |
| Целостность Lucide npm-архива | SHA-512 совпадает |
| `npm test --prefix web/extron-kit-docs` | паритет каталога, 28 форматов, 13 ресурсов, WOFF2, точный ZIP; 6 сценариев, 12 PNG натурального размера, 18 SVG; MIME SVG/WOFF2 локального сервера |
| Браузер 1440×900, 1024 и 375–390 px | галерея и переключение профилей мышью и стрелками, страница сценария, увеличение, поиск, мобильное меню; 18/18 SVG загружены; горизонтальной прокрутки нет |

Найдено и исправлено при проверке в браузере: локальный `serve.mjs` отдавал SVG как `application/octet-stream`, и иконки не отображались. Добавлены типы `image/svg+xml` и `font/woff2`, а `check.mjs` теперь запускает сервер на свободном порту и проверяет эти заголовки.

Архив: `output/av-patterns-2026-10-24/figma-extron-plugin-0.7.3-av-patterns-2026-10-24.zip`.

SHA-256: `25365e56673e8a6362425b1b2571590f7bd2db1e02129bd546bf63f27c6291e4`.

Машинные результаты: `output/av-patterns-2026-10-24/verify-final.log`, `native-final/kit-integration.json`. Снимок и настоящие PNG pen.dev: `design/extron-kit/av-patterns-2026-10-24.snapshot.json`, `design/extron-kit/previews/av-patterns-2026-10-24/`.

## Границы доказательств

В интеграционных тестах Figma API, импорт SVG (`createNodeFromSvg`) и PNG-растеризация моделируются; CLI, доноры, x86 writer и независимое чтение NRBF настоящие. Рендеры pen.dev настоящие. Живой импорт SVG в Figma Desktop, GUI Designer Verify/Build, GCP и физическая панель для этой ревизии не проверялись.

Приватный сайт Sites этой ревизией не переопубликован: проверено локальное зеркало `output/sites/extron-kit-docs/dist`. Поведение сценариев (запуск, маршрутизация, тайм-ауты, синхронизация громкости) подключает программа управления; имя кнопки поведения не создаёт.

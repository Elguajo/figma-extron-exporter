# Extron Kit Apple-inspired Light — 24.10.2026

Ревизия `2026-10-24-apple`, plugin/CLI 0.7.3, EXUI/5. Изменены генератор Figma, эталон pen.dev, организация холста и визуальная веб-документация.

## Результат

- Семантическая палитра, Inter Regular/Bold, углы кнопки 16 px, поверхность 24 px, дорожка 8 px, бегунок 28 px. Прозрачные углы PNG состояний; нативные Slider, Shape, Line, Value и DateTime сохраняются.
- Сохраняются 30 семейств / 57 основных компонентов Figma, включая 28 вариантов DateTime. Volume ±, Back, Home, Settings — Normal/Pressed; feedback — Normal/Active/Pressed.
- Холст: обложка, основы/состояния, компоненты/AV-пресеты, дата/время, отдельные рабочие шаблоны и готовые экраны. В pen.dev три корневых блока вместо разрозненных фреймов. Пользовательский пустой Frame `bi8Au` сохранён.
- Веб-документация: 30 страниц компонентов, поиск, фильтр, состояния, Slider, 28 Format/Pattern, экраны обоих профилей, инструкции и проверенный архив плагина. Каталог и форматы формируются из исходников проекта.

## Проверки

| Проверка | Результат |
|---|---|
| `npm run verify --prefix src/figma-plugin` | TypeScript, build, 616/616 тестов |
| Текстовые пары палитры | ≥ 4.5:1; бегунок/дорожка ≥ 3:1 |
| Реальная CLI-конвертация 1025M | screen 251/251; project 191/191 |
| Реальная CLI-конвертация 300M portrait | screen 149/149; project 191/191 |
| Все 28 DateTime Pattern через writer | 309/309 |
| Выполнение кода из ZIP, пять momentary-кнопок, оба профиля | 98/98 для каждого профиля |
| Сайт: синтаксис JS, паритет каталога, форматы, ресурсы, WOFF2, точность ZIP | Пройдено |
| Браузер 1440×900 и 390×844 | Поиск Ctrl+K, фильтр Mute/пусто, состояния мышью/стрелками, Slider 42→43, Format, переключение профилей, мобильное меню |

Архив: `output/apple-kit-2026-10-24/figma-extron-plugin-0.7.3-apple-light-2026-10-24.zip`.

SHA-256: `5207f9a12c8db51ec1e9ef255b348a302f6b5bbd3b6b081c69af49202ede8772`.

Машинные результаты: `output/apple-kit-2026-10-24/verify.log`, `final-native/kit-integration.json`, `archive-check.json`. Снимок и настоящие PNG pen.dev сохранены в `docs/design/extron-kit/apple-light-2026-10-24.snapshot.json` и `docs/design/extron-kit/previews/apple-light-2026-10-24/`.

## Границы доказательств

Сайт опубликован приватно: https://extron-kit-docs-trilliant.still-coin-7045.chatgpt.site. Sites deployment `appgdep_6adc31a1bee88191982b6ffbfa535cbf` — `succeeded`; исходный статический commit `24dcac880d28ac58290577a94b6516ac491f4ff4`. Браузер без сессии показывает вход через ChatGPT; авторизованный просмотр production не подтверждён. Поведение и визуалы проверены на локальном зеркале того же dist.

В интеграционных тестах Figma API и PNG-растеризация моделируются; CLI, доноры, x86 writer и независимое чтение NRBF настоящие. Рендеры pen.dev настоящие. Текущая ревизия не проходила новый ручной цикл Figma Desktop → GUI Designer Verify/Build → GCP → физическая панель. Веб-примеры демонстрируют оформление и не подключены к оборудованию.

Исследование основано на открытой документации Apple HIG, Obra shadcn/ui, Untitled UI и Figma, без доступа к платным исходникам. Источники и решения: [DESIGN.md](../../design/extron-kit/DESIGN.md).

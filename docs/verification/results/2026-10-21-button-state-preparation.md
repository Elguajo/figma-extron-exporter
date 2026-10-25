# Состояния кнопок по эталонам — 0.4.1 preview

21.10.2026. Реализованы согласованные требования пользователя. Работа выполнена непосредственно в основной папке на `main`; прежние изменения и архивы сохранены. CLI остаётся **0.4.0**, пакет **EXUI/5**, plugin ID и схемы назначений не менялись.

## Поведение

- Исходная кнопка — Group или Frame с префиксом, без обязательных вложенных состояний. Имена фона, графики и текста сохраняются.
- Явная команда создаёт вложенные Group: button_/btn_ → **Off/On**, feedbackbutton_/fbtn_ → **Normal/Active**. Исходные слои и их ID сохраняются; существующее одиночное состояние дополняется, готовые кнопки пропускаются. Pressed добавляется вручную.
- Эталоны можно явно назначить из выбранных прямоугольников/состояний. Автоматический поиск — непосредственные Passive/Active, Normal/Active либо Off/On в Button Styles на текущей странице. Ссылки переживают перезапуск и переименование; удалённая явная ссылка не подменяется.
- Копируются заливки/обводки, скругление — по настройке. «Обновить стили состояний» сохраняет manual Pressed, видимость, metadata и ID.
- Фон определяется по области; неоднозначность требует явного выбора слоя, который запоминается и копируется вместе с ним. Повторное нажатие снимает отметку.
- Составное оформление экспортируется в PNG полного размера. Поддержанный непосредственный верхний Text на всю площадь остаётся нативным; остальные подписи остаются в PNG. Временные копии очищаются при успехе и сбое.

Полная инструкция: [BUTTON_STATES.md](../../../src/figma-plugin/BUTTON_STATES.md).

## Реализация и обзор

`button-preparation.ts` отвечает за эталоны, планирование перед изменениями, группирование, стили и откат. `button-artwork.ts` — за контейнеры Group/Frame, фон и выбор сохраняемого нативного текста. Существующие recognize/capture/export и UI используют эти границы; новый формат пакета и новая зависимость не вводились.

Сопоставлены два варианта: скрытая перестройка при скачивании и явная команда подготовки. Выбрана явная команда: макет меняется только по действию пользователя; экспорт читает результат без перестройки исходного дерева. Метки оформления хранятся отдельно от существующих identity metadata.

При самостоятельном code-review исправлены очистка PNG-клона при сбое создания viewport, обработка смешанного нативного/растрового текста с ручным Pressed, пропуск готовых экземпляров Kit, проверка геометрии явно выбранного фона и снятие его отметки. Отдельный агент для review не привлекался.

API сверено с установленными `@figma/plugin-typings` 1.142.0 и первичными источниками: [figma.group](https://developers.figma.com/docs/plugins/api/figma/#group), [GroupNode](https://developers.figma.com/docs/plugins/api/GroupNode/). Группирование использует штатный API для сохранения абсолютных положений исходных слоёв.

## Проверки окончательного архива

| Проверка | Статус / доказательство |
|---|---|
| TypeScript + UI typecheck | passed: `npm run verify` |
| Unit / API boundary / VM tests | **216 passed, 0 failed**, включая 14 новых тестов подготовки |
| Сборка | passed: `npm run build`, UI 0.4.1 |
| Chromium с UI из финального ZIP | passed: [browser.json](../../../output/releases/0.4.1/final-browser-check/browser.json), pageErrors=[] |
| Новые UI-команды | passed: выбор эталонов, создание/обновление, checkbox с клавиатуры, busy-lock; ширины 420/320 без горизонтального overflow |
| Visual / accessibility review | просмотрены снимки 420/320; используются native disclosure/button/checkbox, фокус и status/alert; полноценная проверка screen reader не выполнялась |
| Финальный ZIP → Group preparation → EXUI → CLI → native GDL | **2/2 профиля**, по **53/53** независимых проверок: [integration.json](../../../output/releases/0.4.1/final-native-check/integration.json) |
| Прежние сценарии из финального ZIP | **8/8**: blank-caption, expanded, on-off, feedback × 2 профиля: [archive-smoke.json](../../../output/releases/0.4.1/final-archive-smoke/archive-smoke.json) |
| Ресурсы и идентичность native GDL | проверены состояния/изображения, objectId/controlId, Pressed и press feedback; реальный writer/reader Extron |
| Соответствие архива исходникам | manifest, dist и все упакованные документы совпадают побайтово; version=0.4.1, compatibleCliVersion=0.4.0 |
| `git diff --check` | passed; сохранено прежнее предупреждение LF/CRLF в button-types.test.ts |
| Figma Desktop | **unavailable / not run**: Figma API, grouping и PNG моделируются fixtures |
| GUI Designer Verify / Save and Build, оборудование | **not run** |

Команды для повторения:

```powershell
npm run verify --prefix src/figma-plugin
# Из src/figma-plugin; для каждого повторения нужен новый выходной каталог:
node test/button-preparation-integration.ts ../../output/new-native-check ../../output/releases/0.4.1/figma-extron-plugin-0.4.1.zip
$env:EXUI_PLUGIN_UI = (Resolve-Path ../../output/releases/0.4.1/unpacked/dist/ui.html).Path
node test/browser.ts ../../output/new-browser-check
```

Проверки не подтверждают пиксельное совпадение PNG Figma с GDL: PNG fixtures синтетические. У прозрачных углов используется цвет страницы, изображения под кнопкой не композируются; внешняя часть Stroke за пределами кнопки обрезается. Для полного контура использовать INSIDE. Подписи произвольной геометрии остаются редактируемыми в Figma, но не как отдельный текст в GDL.

## Артефакт и решение

**SHIP WITH KNOWN RISKS как локальный preview**. Автоматическая цепочка и совместимость проверены; перед использованием на панели нужен ручной цикл Figma Desktop → GUI Designer Verify / Save and Build.

- [Архив 0.4.1](../../../output/releases/0.4.1/figma-extron-plugin-0.4.1.zip).
- [Распакованный manifest](../../../output/releases/0.4.1/unpacked/manifest.json).
- [Машиночитаемая сводка](../../../output/releases/0.4.1/release-check.json).
- SHA-256: `CE2B1274A2F26E45E74AEDC485A9A29A9710D5BAD201CB1434476EF3110402BD`.

Пользовательская установка Figma автоматически на новый путь не переключалась. Коммит и push не выполнялись.

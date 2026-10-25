# Имена слоёв и Off/On — 19.10.2026

## Результат и границы

Реализован плагин 0.1.4: распознавание коротких/полных префиксов с предварительным отчётом, отдельное сохранение, сохранность существующих назначений, монотонные ID для новых элементов. Поддержаны Off/On и необязательный Pressed. Двухсостояниевые кнопки остаются двухсостояниевыми в GDL, press feedback выключен (-1). Для них введён отдельный exui/3 на базе одностраничной v1, прежние v1/v2 не расширены.

[Стандарт v1.1](../../../src/figma-plugin/AUTHORING_STANDARD.md), [контракт](../../exui-v3.md), [реализация и хранение](../../figma-naming-implementation.md), [совместимость](../../exui-v3-migration.md), D015.

## Подтверждённые проверки

| id | kind | status | source |
|---|---|---|---|
| plugin | typecheck / build / tests | passed | `npm run verify --prefix src/figma-plugin`, 58 тестов, 0 ошибок |
| core | build / regression | passed | `.tools/dotnet/dotnet.exe build ExtronExporter.slnx --no-restore`; 0 warnings/errors; `run --project tests/format --no-build`, 128 passed |
| browser | UI / keyboard / recovery | passed | [Chromium JSON](2026-10-19-naming-off-on-browser.json): предварительный отчёт, отдельное применение, блокировка ошибок, смена профиля, tab, прежние downloads и null-source bridge; 0 page errors |
| native | CLI / x86 writer / NRBF | passed | [Интеграция](2026-10-19-naming-off-on-integration.json): обе панели, прежние демо 65/65 и новые Off/On 63/63 |
| visuals | rendered review | passed | Локальный `output/figma-plugin/browser-1792418081565/recognition-ui.png`: сохранён язык панели, таблица имеет горизонтальную прокрутку вместо разрыва имён и ключей |
| compatibility | old / new data | passed | Legacy metadata byte-for-byte, повторное распознавание, VM restart, два/три/смешанные состояния, старые контракты всё ещё отклоняют двухсостояниевые пакеты |
| failure-paths | mutation safety | passed | Stale token/selection/profile/document, duplicate keys, invalid names/style, corrupt/exhausted registry, copied metadata, полный rollback и частичный отказ восстановления |
| figma | real Figma / real PNG | unavailable | Использованы явные fake API fixtures; подтверждение из настоящей Figma для 0.1.4 ещё требуется |
| gui-device | GUI Designer / Build / hardware | unavailable | В этом прогоне ручной GUI и оборудование не запускались |

## Native путь

`DOTNET_EXE` указывал на локальный `.tools/dotnet/dotnet.exe`, `EXUI_DONOR_REGISTRY` — на текущий `samples/donors.json`. Команда: `node src/figma-plugin/test/native-integration.ts output/figma-plugin/naming-off-on-20261019-verified`.

Сначала проверены прежние демо для двух панелей, изменение положения/порядка и сохранение ID. Затем новое дерево без metadata с именами btn_/button_/text_/lvl_ и состояниями Off/On прошло распознавание, сохранение, упаковку exui/3, валидацию, конвертацию настоящим writer и независимое чтение GDL. Проверены ключи, objectId/controlId, имена состояний и press=-1. Все 63 независимые проверки каждого нового результата passed. Исходники и доноры не изменены.

Отдельное чтение исходного Full-Test-Project показало press=-1 у Main Volume Up/Down/Mute и других двухсостояниевых кнопок. Это основание для выбора отключения press feedback, а не выдуманное третье состояние.

Новый реестр ID резервируется перед metadata узлов. Атомарная транзакция Figma между всеми записями не заявляется; при аварийном завершении возможны пропуски и частичная запись, при явном отказе предпринимается восстановление и сообщается, если оно неполное.

## Review и выпуск

Самостоятельно проверены новые потоки `recognize.ts`, команды UI/backend, metadata reader для dry-run, выбор схемы и C# lowering. При review добавлены ограничение структуры состояния до построения отчёта, запись резерва перед узлами, продолжение восстановления после отказа одного узла и явная ошибка частичного восстановления. После этого прошли итоговые проверки 58/128 и Chromium. Новых зависимостей, сетевых разрешений или изменений Extron adapter нет.

Решение: **SHIP WITH KNOWN RISKS** для локального development-плагина; новый ручной Figma/GUI/Build/device цикл остаётся неподтверждённым. Распознавание не исправляет геометрию/оформление, не добавляет AV-логику, не поддерживает произвольные вложенные группы и кастомные дорожки громкости.

Архив `releases/figma-plugin/0.1.4/figma-extron-plugin-0.1.4.zip`: 62 394 байт, SHA-256 `C96F988AF367B52CBF22DA56419B5159CFA9B9D34FDCBF43C8E74E85D668C37C`. Включены собранные файлы, стандарт и инструкции. Распакован локально в соседнюю игнорируемую папку `unpacked`. Старые архивы сохранены.

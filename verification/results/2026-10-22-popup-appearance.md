# Оформление Frame popup/popupref — 22.10.2026

Локальный preview: плагин **0.6.2**, CLI **0.6.1**, EXUI/5. Работа в основной папке на main. На момент сборки изменения ещё не были закоммичены и опубликованы. Архивы прошлых выпусков не заменялись. Новые архивы помечены `sourceDirty`.

## Контракт поведения

- У Frame popup, modalpopup и popupref фон по умолчанию полностью прозрачный, Stroke не переносится. Любые радиусы углов и общая Opacity Frame игнорируются всегда, в том числе при явном переносе оформления. Исходные слои/стили не меняются.
- В форме назначения два независимых native checkbox: «Экспортировать фон Frame», «Экспортировать обводку Frame». Выбор применяется кнопкой сохранения назначения, остаётся после перезапуска. Отсутствие optional metadata `exportBackground`/`exportStroke` равно false; версия metadata и идентичность сохраняются. Проверка типов и допустимых назначений выполняется при чтении.
- При явном переносе фон — SOLID, включая alpha краски; Stroke — SOLID Inside, равномерный, без пунктира. Радиусы и общая Opacity не переносятся. Ограничения вложенных контролов, скрытых объектов, эффектов, масок и Figma interactions сохраняются.
- Нативный фон popup записывается непосредственно. Оформление popupref и Stroke popup представлены стандартной пассивной PBShape до ссылки/содержимого. Это не добавляет AV-логику или управляющий ID; дополнительная фигура входит в действующие пределы элементов. Сгенерированные ID не пересекаются с исходными/ID подписей, порядок исходных слоёв на ID не влияет.
- Изменение дефолта распространяется на ранее назначенные popup: если прежний фон нужен в GDL, его экспорт надо включить явно.
- Изменение схемы ограничено `popups[].background`, `shape.fillColor`, `shape.native.strokeColor`: разрешены #RRGGBB/#AARRGGBB. Остальные цвета по-прежнему только #RRGGBB. Старый CLI 0.6.0 альфа-цвета отклоняет; новый принимает прежние EXUI/5.

## Доказательства

| id | kind | status | source |
|---|---|---|---|
| impact | contract/persistence | passed | Прослежены readMetadata → форма/assignNode → recognize/capture → EXUI schema → writer → NRBF verifier. Optional boolean не требует миграции данных; изменение дефолта явно описано. Расширение alpha ограничено тремя полями. |
| plugin | typecheck/unit/build | passed | `npm run verify --prefix src/figma-plugin`: **352/352**, оба TypeScript проекта, сборка. Новый `popup-appearance.test.ts`: **11** тестов, включая исполняемый bundle команды формы, перезапуск, отключение флажков, неизменность Figma, геометрию, ID, ошибки и независимость флажков. |
| core | build/contracts | passed | `.tools/dotnet/dotnet.exe build ExtronExporter.slnx --no-restore`: 0 warnings/errors. `run --project tests/format --no-restore`: **172/172**. Новые положительные/отрицательные schema tests в PagesTests.cs. |
| native | source → CLI → GDL/NRBF | passed | `test/popup-appearance-integration.ts`, оба профиля × ignore/keep: **4/4**. [Результаты](../../output/figma-plugin/popup-appearance-1792665681751/results.json). **221/221** при ignore, **237/237** при keep для каждой панели. Проверены нулевой фон, нативные цвета/alpha, пассивная фигура, её порядок, radius=0, thickness=2 и ссылки. |
| browser | UI | passed | `node test/browser.ts`: реальные Chromium и собранная форма, родитель Figma имитирован; включение/выключение флажков, повторная загрузка настроек и сброс при выборе другого popup, штатные сценарии формы/экспорта, без page errors. [Протокол](../../output/figma-plugin/browser-1792665371491/browser.json). |
| accessibility | focused keyboard/semantics | passed | Native checkbox с label/aria-describedby; Space включает фон, Tab переводит на обводку, Space включает обводку. Проверен видимый focus. Полный аудит WCAG и screen reader не выполнялись. |
| visual | UI at 420/320 | passed | Нет горизонтального overflow; просмотрены [настройки 320](../../output/releases/0.6.2/popup-ui-check/popup-settings-320.png) и [420](../../output/releases/0.6.2/popup-ui-check/popup-settings-420.png). Новые настройки используют существующую форму/стили. |
| review | focused code review | passed | Просмотрены diff и новый popup-appearance.ts: область исключений только popup/ref, валидация paint opt-in, общая Opacity/радиусы не влияют на EXUI, companion ID не конфликтуют с исходными и caption ID, исходные слои не мутируются. Подтверждённых дефектов не осталось. |
| archive | shipped bundle/CLI | passed | `Package-Release.ps1 -DotnetExe .tools/dotnet/dotnet.exe -IncludeLocalSamples`. Затем тот же интеграционный тест с EXUI_PLUGIN_ARCHIVE и EXUI_CLI_DLL из stage: **4/4**, 221/237 проверок на профиль. [Результаты](../../output/releases/0.6.2/popup-archive-smoke/results.json). |
| desktop | real Figma | unavailable | Проверки используют явный fake Figma API; создание/сохранение макета в Figma Desktop не наблюдалось. |
| gui/device | GUI Designer Verify/Build / physical panel | unavailable | Новый GDL сформирован настоящим writer и прочитан независимым NRBF verifier; GUI Designer Verify/Build и панель не проверялись. |

## Артефакты

- `output/releases/0.6.2/figma-extron-plugin-0.6.2.zip` — SHA-256 `34C7F646E85349A8F91227409E6D0296CAE484F3436912F906759F3F579E325B`.
- `output/releases/0.6.2/figma-extron-cli-0.6.1-windows.zip` — SHA-256 `B192C0D52F5F092DE8943E9C2369606B670D939F40DE04BE528C3E2E2827C73E`.
- `output/releases/0.6.2/figma-extron-complete-0.6.2-local.zip` — SHA-256 `16AA307FB2785A4E07517C440F9D7159557A36513A18C9E771ECE9C6E14712C6`. Содержит частные доноры; только локальное использование.

Решение для локального preview: **SHIP WITH KNOWN RISKS**. Окончательный вид, работа с касаниями и Build должны быть проверены на копии нового GDL в GUI Designer и на панели. На момент фиксации этих проверок веб-публикация, push и изменение Git history не выполнялись.

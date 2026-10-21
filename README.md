# Figma → Extron Exporter

**Extron Kit 0.3.0 preview:** библиотека из 30 компонентов, созданная в pen.dev, теперь генерируется в Figma локальным плагином без MCP и платной подписки. [Инструкция](src/figma-plugin/EXTRON_KIT.md) · [исходный кит и превью](design/extron-kit/README.md). Свободное оформление кнопок/изображений, экземпляры компонентов и уникальные ID проверены автоматически; новый реальный Desktop/Build-цикл ещё не пройден. Стабильный комплект ниже остаётся 0.2.1.

[![Плагин 0.2.2](https://img.shields.io/badge/plugin-0.2.2-2ea44f)](releases/figma-plugin/0.2.2/README.md)
[![Figma Design](https://img.shields.io/badge/Figma-Design-F24E1E?logo=figma&logoColor=white)](src/figma-plugin/README.md)
[![CLI для Windows](https://img.shields.io/badge/CLI-Windows-0078D4)](releases/cli/0.2.1/README.md)
[![.NET 10](https://img.shields.io/badge/.NET-10-512BD4?logo=dotnet&logoColor=white)](Directory.Build.props)

Плагин Figma и локальный CLI для переноса подготовленных интерфейсов в редактируемые проекты Extron GUI Designer. Дизайнер задаёт структуру экранов, состояния и ID; плагин сохраняет пакет `.exui` с описанием и PNG, а CLI создаёт новый `.gdl` с нативными элементами Extron.

Поддержаны **TLP Pro 1025M — 1280×800** и **TLP Pro 300M — портрет 320×480**. Макет нужно подготовить по стандарту проекта; произвольный дизайн Figma автоматически не преобразуется. Build выполняется в GUI Designer, команды и обратную связь задаёт программа управления Extron.

**Плагин 0.2.2 + CLI 0.2.1:** [скачать плагин](releases/figma-plugin/0.2.2/figma-extron-plugin-0.2.2.zip) · [скачать CLI для Windows](releases/cli/0.2.1/figma-extron-cli-0.2.1-windows.zip) · [инструкция CLI](releases/cli/0.2.1/README.md).

Новые `button_` / `btn_` требуют **Off + On**; `feedbackbutton_` / `fbtn_` — **Normal + Active + Pressed**. Старые назначения и ID сохраняются. [Протокол разделения кнопок](verification/results/2026-10-21-button-types.md). Прежний GUI-прогон ниже относится к Home 0.2.1; новые типы в 0.2.2 проверены на UI и native-конвертацию обеих панелей.

![Home 1025M после конвертации и повторного открытия в GUI Designer: выбор зоны и источника, Slider, значение громкости и Mute](verification/results/2026-10-21-release-0.2.1/gui-021-reopened.png)

Home 1025M из установленного плагина 0.2.1 прошёл Verify **0 ошибок / 0 предупреждений**, Save and Build и повторное открытие. [Протокол выпуска](verification/results/2026-10-21-release-0.2.1.md). Работа на физической панели ещё не проверена.

## Начать с готового комплекта

Для запуска готового CLI нужен **Windows и .NET 10 Runtime x64**. Для конвертации дополнительно нужны **GUI Designer 1.28.0.7**, 32-битный Windows PowerShell 5.1 и закреплённые доноры — локальные проекты-образцы, из которых адаптер создаёт объекты. Исходники, Node.js и .NET SDK для готового CLI не нужны.

1. Распаковать архивы плагина и CLI в постоянные папки. Обычный архив CLI содержит пример `.exui` и реестр, но **не содержит донорские GDL**. Для конвертации подготовить их по разделу [«Доноры и установка Extron»](#доноры-и-установка-extron).
2. В Figma Desktop выбрать **Plugins → Development → Import plugin from manifest…** и указать `manifest.json` из распакованного плагина. Сохранить его ID: к нему привязаны назначения элементов. После запуска заголовок должен показывать **0.2.2**.
3. Выбрать профиль панели, нажать **«Создать демо для этого профиля»**, оставить созданный Frame выбранным, затем **«Проверить экран» → «Скачать .exui»**. Для демо в Figma должны быть доступны Arial Regular и Bold. [Подробная инструкция плагина](src/figma-plugin/README.md).

Первую проверку CLI можно выполнить без Figma, Extron и доноров на примере из архива. В PowerShell **из папки распакованного CLI**:

```powershell
.\ExtronExporter.ps1 validate-package .\examples\home-1025m\home.exui
.\ExtronExporter.ps1 id-map .\examples\home-1025m\home.exui
```

После подготовки Extron и доноров:

```powershell
New-Item -ItemType Directory -Force .\converted | Out-Null
.\ExtronExporter.ps1 convert-package .\examples\home-1025m\home.exui .\converted\home.gdl
```

Для своего экспорта заменить путь `home.exui` на путь скачанного файла. Результат — новый `home.gdl` и `home.gdl.report.json` с независимыми проверками. Открыть копию GDL в GUI Designer, проверить вид, редактирование и ID, выполнить **Verify → Save and Build → закрыть и открыть снова**.

Каждой конвертации нужно новое имя результата: существующие GDL и отчёт не перезаписываются. Повторный экспорт не переносит ручные правки из прежнего GDL. Отдельного Desktop UI для конвертера пока нет.

## Подготовить собственный макет

1. Создать Frame нужного размера. Для одного экрана использовать `Home`, `scr_Home` или `screen_Home`; для нескольких страниц и popup — структуру `project_` по стандарту.
2. Назвать элементы поддержанными префиксами, например `button_Music`, `feedbackbutton_Mute`, `slider_Volume`, `value_Volume`, `logo_Company`. Для новых button_/btn_ подготовить ровно Off + On; для feedbackbutton_/fbtn_ — ровно Normal + Active + Pressed. Прежние сохранённые назначения продолжают работать без миграции.
3. Выбрать внешний Frame и профиль, нажать **«Распознать по именам»**, изучить отчёт и **«Сохранить распознанные назначения»**. Существующие назначения приоритетны; ключи и ID сохраняются при изменении оформления. Для копий нужно явно назначить новые ID.
4. Выполнить **«Проверить экран» → «Скачать .exui»**, затем валидацию и конвертацию CLI.

[Справочник префиксов с примерами](src/figma-plugin/PREFIXES.md) · [Полный стандарт подготовки макета v2.0](src/figma-plugin/AUTHORING_STANDARD.md).

| Из Figma | В проекте Extron |
|---|---|
| Кнопки с 2–8 состояниями | PBButton с отдельными normal, feedback и необязательным pressed |
| Статичный текст и динамическое значение | PBLabel; у Value — dynamicText и собственный controlId |
| Slider с Track/Fill/Thumb | PBSlider с направлением, диапазоном, дорожкой и бегунком |
| Gauge, VolumeLED, Multistate Level | Режимы PBLevel, у Multistate — до 8 состояний |
| Фигуры, линии, дата/время | PBShape, PBLine, PBDateTime |
| Логотипы и иконки | PNG; самостоятельный логотип — PBImage, внутренние части растра отдельно не редактируются |
| Страницы, обычные и модальные popup, группы и ссылки | Контейнеры и привязки Extron; карта ID для программиста |

В 0.2.1 кнопка может иметь ровно пустую собственную подпись в `.exui/5`, а видимый текст — отдельные нативные Label/Value поверх неё. Для этого нужны **плагин и CLI 0.2.1**. Цвет таких подписей не следует за состоянием кнопки автоматически; касания под ними и удержания ещё требуют проверки на панели.

Макет использует Arial Regular/Bold, целые координаты и поддержанное подмножество оформления. Произвольные effects, gradients, opacity и prototype interactions не переносятся. Сложная графика допустима внутри растеризуемых изображений. Видео и Dynamic Image для этих профилей не поддержаны. Полные правила и диагностика — в стандарте.

Переходы, selectionGroup, доступность/видимость и другие указания попадают в `id-map` для программы управления. CLI не создаёт AV-логику: связь Slider/Value, команды «+»/«−», начальное значение и Mute feedback задаются программой Extron.

## Доноры и установка Extron

В [samples/donors.json](samples/donors.json) закреплены профили, элементы и SHA-256 доноров. Для обычного CLI скопировать проверенные `tlp-pro-1025m.gdl` и `tlp-pro-300m-portrait.gdl` из основной рабочей папки в `samples/donors/` распакованного комплекта. Произвольный GDL не заменяет донора.

Если доноров нет, нужен исходный `Full-Test-Project.gdl`, совпадающий с [манифестом образцов](samples/manifest.json). Поместить его в `samples/original/` комплекта и из папки CLI выполнить:

```powershell
.\ExtronExporter.ps1 prepare-donor tlp-pro-1025m
.\ExtronExporter.ps1 prepare-donor tlp-pro-300m-portrait
```

Крупные сторонние образцы и доноры исключены из Git; одного клонирования репозитория для конвертации недостаточно. Полный локальный комплект с обоими донорами хранится отдельно в игнорируемом `output/`. [Состав и инструкция](releases/cli/0.2.1/README.md).

По умолчанию адаптер использует `C:\Program Files (x86)\Extron\GUI Designer`. Другой путь задаётся `--extron-dir` или `EXTRON_GUI_DESIGNER_DIR`, другой реестр — `--registry`. Лаунчер `ExtronExporter.ps1` выбирает реестр рядом с собой; пути входа и результата остаются относительно текущей папки. Для отдельной установки .NET доступна переменная `EXUI_DOTNET_EXE`.

DLL Extron не входят в поставку и загружаются только из установленного GUI Designer в отдельном x86-процессе `C:\Windows\SysWOW64\WindowsPowerShell\v1.0\powershell.exe`. Основной процесс .NET читает NRBF через Microsoft `System.Formats.Nrbf` 10.0.11 без создания объектов Extron. [Решения по адаптеру и доверенным донорам](docs/decisions.md).

## Разработка из исходников

Для .NET-части нужен SDK **10.0.402** с политикой `latestPatch` из [global.json](global.json); для плагина — **Node.js ≥22.18** и npm. Зависимости закреплены lock-файлами. Команды ниже выполняются в PowerShell **из корня репозитория**.

```powershell
$dotnet = 'dotnet'
# Если SDK подготовлен локально, вместо этого: $dotnet = '.\.tools\dotnet\dotnet.exe'
& $dotnet restore ExtronExporter.slnx --locked-mode
& $dotnet build ExtronExporter.slnx --no-restore
& $dotnet run --project src/cli --no-build -- validate-package examples/exui-v5/expanded-1025m.exui
& $dotnet run --project src/cli --no-build -- id-map examples/exui-v5/expanded-1025m.exui
```

Для проверки пакета и карты ID Extron и доноры не нужны. Для подготовки доноров и конвертации из исходников использовать `& $dotnet run --project src/cli --no-build --` перед соответствующей командой CLI; реестр по умолчанию — `samples/donors.json` относительно текущей папки.

Сборка, проверки и упаковка плагина:

```powershell
npm ci --prefix src/figma-plugin --ignore-scripts
npm run verify --prefix src/figma-plugin
npm run package --prefix src/figma-plugin
```

`verify` выполняет typecheck, тесты и сборку. Готовый архив создаётся в `output/figma-plugin/`; существующий архив не заменяется. Для импорта из исходников выбрать `src/figma-plugin/manifest.json` после сборки. [Browser QA, интеграция с CLI и разработка плагина](src/figma-plugin/README.md#сборка-и-проверки-из-корня-репозитория).

.NET-проверки — исполняемый набор, запускаемый через `dotnet run`:

```powershell
& $dotnet run --project tests/format --no-build
# При наличии закреплённых доноров и установленного GUI Designer:
& $dotnet run --project tests/format --no-build -- --registry samples/donors.json --integration
```

Первый прогон не требует Extron и локальных образцов. Интеграционный прогон генерирует проекты обеих панелей через адаптер; открытие, Verify и Build в GUI Designer выполняются отдельно. Проверки готовых архивов и команды их повторения — в [протоколе выпуска](verification/results/2026-10-21-release-0.2.1.md).

Для упаковки плагина и Release CLI после восстановления зависимостей:

```powershell
.\scripts\Package-Release.ps1 -DotnetExe $dotnet
```

Скрипт пишет в `output/releases/0.2.2/` и отказывается заменять существующие архивы; совместимая версия CLI определяется в package.json плагина. Для повторной упаковки задать новый `-OutputDirectory`. Состав обычного и полного локального комплектов описан в [инструкции выпуска](releases/cli/0.2.1/README.md#воспроизводимая-упаковка-из-репозитория).

## Дополнительные команды CLI

Команды передаются лаунчеру готового комплекта или запускаются из исходников через `& $dotnet run --project src/cli --no-build --`.

| Команда и аргументы | Назначение |
|---|---|
| `validate-package <input.exui>` | Проверка ZIP, схем, ID, ссылок и ресурсов без Extron |
| `id-map <input.exui>` | Markdown-карта страниц, popup, ID, состояний и указаний программе |
| `convert-package <input.exui> <new-output.gdl>` | Новый редактируемый GDL и независимый отчёт; требует Extron и донора |
| `inspect <input.gdl\|glt>` | JSON-инвентаризация контейнера и NRBF, включая файл после Save and Build |
| `list-controls <input.gdl>` | Профиль, страницы, popup, элементы, ID, состояния, ресурсы и данные Build |
| `compare-graph <a.gdl> <b.gdl>` | Сравнение графов без учёта ID записей; отдельно — без служебного `_version` |
| `repack <input> <new-output>` | Пересборка контейнера с побайтовым сохранением payload и дополнительных записей |
| `set-button-text <input> <new-output> <button-id> <expected-text> <new-text>` | Ограниченная замена текста состояний существующей кнопки с сохранением ID |
| `prepare-donor <donor-id>` | Подготовка закреплённого донора из эталона |
| `generate-screen <screen.json> <donor-id> <new-output.gdl>` | Экспериментальный путь из JSON одной страницы; [пример и воспроизведение](examples/first-screen/README.md) |

`prepare-donor`, `generate-screen` и `convert-package` принимают `--registry` и `--extron-dir`. Каталог назначения должен существовать, выходной файл — быть новым. Коды выхода: **0** — успех, **1** — отказ при обработке, **2** — неверные аргументы. При отказе адаптера сообщение содержит код, например `donor-missing`, `donor-hash`, `extron-version` или `output-exists`.

Редактор подписи поддерживает наблюдаемый профиль 1.28.0.7 с нулевым checksum; formatted text и общие с другими объектами строки/состояния отклоняются. Ограничения контейнера и результаты проверок — в [описании формата](docs/extron-format.md) и [протоколе редактирования](verification/results/2026-10-19-gui-text-edit.md).

## Что подтверждено

- **Комплект 0.2.1, Home 1025M:** настоящий экспорт установленного плагина → CLI из распакованного комплекта, 47 элементов / 15 PNG, 432/432 независимых проверок; GUI Verify 0/0 → Save and Build → повторное открытие, 426/426 после Build. [Протокол и артефакты](verification/results/2026-10-21-release-0.2.1.md).
- **Профиль 300M:** реальный экспорт демо из Figma преобразован в GDL, 65/65; отдельный GUI-цикл именно этого экспорта остаётся незавершённым. [Протокол Figma](verification/results/2026-10-19-figma-real-export.md). Более ранние экраны обеих панелей прошли [собственный GUI-цикл](verification/results/2026-10-19-first-screen.md).
- **Расширенные типы, страницы и popup:** есть автоматические сценарии обеих панелей; GUI-цикл Home 1025M не подтверждает все остальные сочетания. [Проверки расширенных элементов](verification/results/2026-10-20-expanded-controls.md).

Оборудование, касания под отдельными подписями, удержания и feedback ещё не проверены. Облачная сохранность private metadata после перезапуска Figma Desktop также остаётся отдельной проверкой. Результат независимого чтения GDL подтверждает данные; каждому новому проекту нужен свой GUI-цикл.

## Устройство и документация

| Папка | Ответственность |
|---|---|
| `src/figma-plugin` | TypeScript-плагин: назначения, распознавание, preview состояний, PNG и экспорт пакета |
| `src/cli` | Консольные команды |
| `src/screen` | Контракты `.exui/1–5`, проверка ZIP/JSON, карта ID, независимая проверка результата |
| `src/extron` | Контейнер, NRBF, модель проекта и ограниченный редактор подписи без DLL Extron |
| `src/adapter` | Реестр доноров и отдельный x86-хост для записи через установленный Extron |

- [Контракт `.exui/5`](docs/exui-v5.md) и [примеры расширенных элементов и проектов](examples/exui-v5/README.md).
- Прежние контракты: [v1 — один экран](docs/exui-v1.md), [v2 — страницы и popup](docs/exui-v2.md), [v3 — без Pressed](docs/exui-v3.md), [v4 — изображения и Normal/Pressed](docs/exui-v4.md). CLI читает версии 1–5; плагин выбирает 1, 3, 4 или 5 по содержимому.
- [Результаты проверок и ручной чек-лист](verification/checklist.md), [исследованный формат Extron](docs/extron-format.md), [технические решения](docs/decisions.md).
- [Текущий статус работ](ROADMAP.md), [план разработки](DEVELOPMENT_PLAN.md), [исследование аналогов](docs/analogue-research-2026-10-19.md).

Оформление и части экспорта плагина адаптированы из **Baolv/figma-export** по разрешению пользователя. Происхождение и сведения о лицензиях зависимостей — в [THIRD_PARTY_NOTICES.md](src/figma-plugin/THIRD_PARTY_NOTICES.md); использование приёмов extron-gdl-toolkit описано в [технических решениях](docs/decisions.md#d010--использование-extron-gdl-toolkit). Тексты разрешений upstream в репозиторий не переданы; эти записи не заменяют их условия.

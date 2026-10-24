# Figma → Extron Exporter

Переносит интерфейс сенсорной панели из **Figma** в редактируемый проект **Extron GUI Designer** (`.gdl`) с нативными кнопками, слайдерами, подписями и постоянными ID.

```text
Макет в Figma  ──плагин──▶  пакет .exui (JSON + PNG)  ──CLI──▶  новый .gdl  ──▶  GUI Designer: Verify → Build
```

| | |
|---|---|
| **Текущая версия** | плагин **0.7.3** + CLI **0.7.3** (preview) · [что нового](CHANGELOG.md) |
| **Панели** | TLP Pro 1025M — 1280×800 · TLP Pro 300M — портрет 320×480 |
| **Платформа** | Figma Desktop · Windows + Extron GUI Designer 1.28.0.7 |
| **Не делает** | не превращает произвольный дизайн — макет готовится по правилам имён; не создаёт AV-логику — команды и feedback задаёт программа управления Extron |

**Дизайнеру и интегратору** → [Как пользоваться](#как-пользоваться) · **Разработчику** → [Как устроен проект](#как-устроен-проект)

---

## Как пользоваться

### 1. Что понадобится

| Для чего | Что нужно |
|---|---|
| Подготовить и выгрузить макет | Figma Desktop, архив плагина |
| Проверить пакет и получить карту ID | Windows, [.NET 10 Runtime x64](https://dotnet.microsoft.com/download/dotnet/10.0), архив CLI |
| Получить `.gdl` | дополнительно: GUI Designer **1.28.0.7** и донорские GDL (см. [шаг 2](#2-установка)) |

**[Скачать последнюю версию](https://github.com/Elguajo/figma-extron-exporter/releases/latest)** — в разделе Assets: `figma-extron-plugin-<версия>.zip` и `figma-extron-cli-<версия>-windows.zip`. Можно и [собрать самому](#сборка-и-проверки).

### 2. Установка

**Плагин.** Распакуйте архив в постоянную папку (не в «Загрузки»). В Figma Desktop: **Plugins → Development → Import plugin from manifest…** → `manifest.json`. В заголовке плагина должно быть **0.7.3**. В разделе «Нумерация кнопок» можно пронумеровать имена и подписи только у непосредственно выделенных кнопок, с отдельным счётом внутри каждого родителя; перед применением показан список изменений. В «Оформление кнопок» выберите Off / On или Normal / Pressed; применение нового стиля к готовым кнопкам также меняет их пару. Новое место `popupref_Name` находит соседний `popup_Name` или `popupgroup_Name` по одинаковой части имени; сохранённые связи имеют приоритет. Закруглённые кнопки больше не получают белые углы на фоне-изображении. Плагин и CLI **0.7.3** выпускаются парой: CLI исправляет пустой preview страниц в GCP и включает сравнение экспортов.

> [!WARNING]
> Не меняйте `id` в `manifest.json`: назначения элементов хранятся в Figma под ID плагина. После смены ID их не прочитать.

**CLI.** Распакуйте архив в постоянную папку. Все команды запускаются в PowerShell из этой папки через `.\ExtronExporter.ps1`.

**Доноры** — эталонные проекты Extron, из которых CLI создаёт объекты. В архив CLI они не входят. Положите проверенные `tlp-pro-1025m.gdl` и `tlp-pro-300m-portrait.gdl` в `samples\donors\` папки CLI. Если доноров нет, но есть исходный `Full-Test-Project.gdl`, положите его в `samples\original\` и выполните:

```powershell
.\ExtronExporter.ps1 prepare-donor tlp-pro-1025m
```

```powershell
.\ExtronExporter.ps1 prepare-donor tlp-pro-300m-portrait
```

Произвольный GDL донором не станет: CLI сверяет SHA-256 с [samples/donors.json](samples/donors.json).

### 3. Проверка на готовом примере

Без Figma и Extron убедитесь, что CLI работает:

```powershell
.\ExtronExporter.ps1 validate-package .\examples\home-1025m\home.exui
```

Ожидается JSON с `contract: "exui/5"`, профилем TLP Pro 1025M, 47 элементами и 15 ресурсами. Затем, при установленных Extron и донорах:

```powershell
.\ExtronExporter.ps1 convert-package .\examples\home-1025m\home.exui .\home.gdl
```

Появятся `home.gdl` и `home.gdl.report.json`. Откройте GDL в GUI Designer → **Verify → Save and Build** → закройте и откройте снова.

### 4. Свой макет

1. **Экран** — Frame точного размера панели с именем `Home`, `scr_Home` или `screen_Home`. Несколько страниц и popup — секция Figma или Frame `project_…`.
2. **Элементы** — слои непосредственно в экране, названные с префиксом типа:

   | Префикс | Что получится в Extron |
   |---|---|
   | `btn_` / `button_` | кнопка, 2 состояния |
   | `fbtn_` / `feedbackbutton_` | кнопка с обратной связью |
   | `sld_` / `slider_` | слайдер из частей `Track`, `Fill`, `Thumb` |
   | `lvl_` / `level_` | простой регулятор уровня |
   | `txt_` / `text_` | статичная подпись |
   | `val_` / `value_` | обновляемая подпись со своим ID |
   | `img_` / `image_`, `logo_` | картинка (PNG) |
   | `ln_` / `line_`, `shp_` / `shape_` | линия, фигура |

   После префикса — латиница, цифры, точки и дефисы, без пробелов: `button_Mute`, `slider_HallVolume`. Регистр не важен, видимый текст может быть русским. Все типы, popup и страницы — в [справочнике префиксов](src/figma-plugin/PREFIXES.md) и [PDF-шпаргалке](docs/prefix_map/figma-extron-prefix-cheatsheet.pdf).

3. **Состояния кнопок** — дочерние Group/Frame с именами ролей:

   | Кнопка | Состояния | Префикс |
   |---|---|---|
   | включение / выбор (Power, источник) | `Off` / `On` | `button_` |
   | нажатие и удержание (Volume ±) | `Normal` / `Pressed` | `button_` |
   | выбор с отдельным видом нажатия | `Normal` / `Active` / `Pressed` | `feedbackbutton_` |

   Состояния Off / On можно не рисовать вручную: создайте рядом с экраном Frame **Button Styles** с двумя Rectangle `Off` и `On` и нажмите **«Оформление кнопок → Применить оформление»**. Подробно — в [инструкции по кнопкам](src/figma-plugin/BUTTON_STATES.md).

4. Выберите экран (или секцию), профиль панели → **«Проверить макет»** → **«Скачать .exui»**. ID назначаются автоматически и сохраняются между экспортами; ключи следуют именам слоёв. Имена слоёв — только латиницей. При ошибке отчёт покажет слой, причину и кнопку **«Показать слой»**.

Полные правила подготовки (размеры, шрифты, что уходит в PNG) — [стандарт макета](src/figma-plugin/AUTHORING_STANDARD.md). Готовая библиотека компонентов — **«Библиотека компонентов» → «Создать Extron Kit»**, см. [Extron Kit](src/figma-plugin/EXTRON_KIT.md). В локальной ревизии **2026-10-24** Volume +/− и Back/Home/Settings используют Normal / Pressed; существующие библиотеки автоматически не обновляются.

**Изменения после настройки GCP.** Сохраните рабочий EXUI и сравните его с новым: `compare-packages interface-v1.exui interface-v2.exui`. CLI 0.6.6 показывает новые/удалённые элементы, изменения ID, типов, состояний и связей. Затем обновляйте копию существующего проекта GCP через Layout Reconciliation с сохранением конфигурации. Для тестовой пары 1025M подтверждены сохранение действия/feedback кнопки и повторное открытие GCP; новая кнопка не унаследовала действие удалённой. [Инструкция и границы проверки](docs/updating-configured-projects.md).

### 5. Конвертация и передача программисту

```powershell
.\ExtronExporter.ps1 validate-package C:\путь\к\макет.exui
```

```powershell
.\ExtronExporter.ps1 id-map C:\путь\к\макет.exui | Out-File -Encoding utf8 id-map.md
```

```powershell
.\ExtronExporter.ps1 convert-package C:\путь\к\макет.exui .\макет-v1.gdl
```

`id-map.md` — карта страниц, popup, ID и состояний для программиста Extron: команды, переходы, feedback и связь слайдера со значением он задаёт в программе управления.

Что важно знать:

- **Каждая конвертация — в новый файл.** Существующий GDL не перезаписывается.
- **Правки, сделанные вручную в GDL, при новом экспорте теряются.** Меняйте дизайн в Figma и повторяйте экспорт.
- Каждый новый GDL проверяйте в GUI Designer: **Verify → Save and Build → закрыть и открыть снова**.

### Если что-то пошло не так

| Сообщение | Что делать |
|---|---|
| `donor-missing` / `donor-hash` | нет донора или он не тот — см. [Установка](#2-установка) |
| `extron-version` | нужен GUI Designer 1.28.0.7; другой путь установки — `--extron-dir <папка>` |
| `output-exists` | укажите новое имя выходного файла |
| пакет EXUI/1–4 отклонён | экспортируйте макет из Figma заново текущим плагином; ключи и ID сохранятся |
| ошибка имени слоя | отчёт плагина показывает недопустимый символ и пример исправления |

Коды выхода CLI: `0` — успех, `1` — ошибка обработки, `2` — неверные аргументы.

---

## Как устроен проект

### Архитектура

```text
src/figma-plugin  (TypeScript, Figma API)
   распознаёт слои по именам → назначает ключи/ID → рендерит PNG → пишет .exui (ZIP: manifest.json + screen.json + PNG)
        │
        ▼
src/cli  (.NET 10, точка входа Program.cs)
   ├─ src/screen   контракт EXUI/5, JSON Schema, валидация, id-map, независимый verifier
   ├─ src/adapter  реестр доноров, генерация GDL → дочерний x86-процесс PowerShell (adapter/host)
   │                который загружает DLL установленного GUI Designer
   └─ src/extron   чтение/запись контейнера GDL и NRBF без DLL Extron — для проверки результата
```

Ключевые решения:

- **DLL Extron не входят в поставку** и загружаются только в отдельном 32-битном процессе `adapter/host` из установленного GUI Designer. Основной процесс читает NRBF через `System.Formats.Nrbf`, не создавая объектов Extron.
- **Новые объекты клонируются из доноров** — закреплённых по SHA-256 эталонных GDL, а не создаются с нуля.
- **Результат проверяется независимо**: после генерации `src/extron` перечитывает GDL и сверяет его с пакетом (`.gdl.report.json`).

Обоснования — [docs/decisions.md](docs/decisions.md), формат GDL — [docs/extron-format.md](docs/extron-format.md), контракт пакета — [docs/exui-v5.md](docs/exui-v5.md).

### Структура репозитория

```text
src/figma-plugin/   плагин: src/ — код, test/ — тесты, ui.html — интерфейс, *.md — инструкции дизайнеру
src/cli/            консольные команды
src/screen/         модель и валидация пакета .exui
src/adapter/        генерация GDL через Extron; host/ — x86 PowerShell-хост
src/extron/         формат GDL: контейнер, NRBF, модель проекта
tests/format/       .NET-тесты (исполняемый проект)
schemas/            JSON Schema пакета .exui
examples/           эталонные .exui и id-map для тестов и демонстрации
samples/            donors.json (реестр доноров); original/ и donors/ — локально, вне Git
design/extron-kit/  исходники библиотеки компонентов
docs/               контракты, формат Extron, решения
verification/       чек-лист и протоколы ручных проверок
releases/           заметки к выпускам плагина и CLI
scripts/            лаунчер CLI и упаковка выпуска
output/             локальные сборки и результаты, вне Git
```

Модули плагина: `recognize.ts` — распознавание имён, `assignment-rules.ts` — ключи и ID, `button-preparation.ts` / `button-artwork.ts` — состояния кнопок, `export.ts` и `package.ts` — сборка `.exui`, `kit.ts` — Extron Kit, `ui.ts` — логика интерфейса, `code.ts` — точка входа.

### Сборка и проверки

Нужны .NET SDK **10.0.402** ([global.json](global.json)) и Node.js **≥ 22.18**. Команды — из корня репозитория.

```powershell
dotnet build ExtronExporter.slnx
```

```powershell
dotnet run --project tests/format
```

```powershell
npm ci --prefix src/figma-plugin --ignore-scripts
```

```powershell
npm run verify --prefix src/figma-plugin
```

`verify` = typecheck + тесты + сборка в `src/figma-plugin/dist/`. Для отладки импортируйте в Figma `src/figma-plugin/manifest.json` и перезапускайте плагин после каждой сборки.

Запуск CLI из исходников без Extron:

```powershell
dotnet run --project src/cli -- validate-package examples/exui-v5/expanded-1025m.exui
```

Интеграционные тесты (нужны GUI Designer и доноры в `samples/donors/`):

```powershell
dotnet run --project tests/format -- --registry samples/donors.json --integration
```

Автотесты не заменяют проверку в GUI Designer и на панели — порядок ручной проверки в [verification/checklist.md](verification/checklist.md).

### Выпуск

1. Поднять версию в `src/figma-plugin/package.json` (`version`, `compatibleCliVersion`) и, если менялся CLI, в `src/cli/Extron.Cli.csproj`.
2. Добавить запись в [CHANGELOG.md](CHANGELOG.md) и `releases/figma-plugin/<версия>/README.md`.
3. Собрать архивы — скрипт пишет в `output/releases/<версия>/` и не перезаписывает существующие:

```powershell
.\scripts\Package-Release.ps1
```

4. Стабильный выпуск собирать из чистого коммита и после smoke-тестов класть рядом с заметками к выпуску: `releases/figma-plugin/<версия>/figma-extron-plugin-<версия>.zip` и `releases/cli/<версия>/figma-extron-cli-<версия>-windows.zip`, в каждой папке — свой `SHA256SUMS.txt`. Архивы в git не хранятся (`.gitignore`), файлы контрольных сумм — хранятся. Локальный архив `figma-extron-complete-*` с донорами туда не класть.
5. Закоммитить, запушить и опубликовать релиз на GitHub с текстом из `releases/github/v<версия>.md` и двумя архивами из `releases/figma-plugin/<версия>/` и `releases/cli/<версия>/`. Локальный архив `figma-extron-complete-*` с донорами не публиковать.

### Команды CLI

| Команда | Назначение |
|---|---|
| `validate-package <in.exui>` | проверка ZIP, схем, ID, ссылок и ресурсов |
| `id-map <in.exui>` | Markdown-карта ID для программиста |
| `compare-packages <old.exui> <new.exui> [--json]` | сравнение экспортов перед обновлением настроенного проекта GCP |
| `convert-package <in.exui> <new.gdl>` | генерация GDL и отчёта; нужны Extron и донор |
| `prepare-donor <donor-id>` | подготовка донора из эталона |
| `inspect <in.gdl\|glt>` | JSON-инвентаризация контейнера и NRBF |
| `list-controls <in.gdl>` | страницы, элементы, ID, состояния, ресурсы |
| `compare-graph <a.gdl> <b.gdl>` | сравнение графов объектов |
| `repack <in> <new>` | пересборка контейнера без изменения payload |
| `set-button-text <in> <new> <id> <old> <new-text>` | замена текста состояний кнопки |
| `generate-screen <screen.json> <donor-id> <new.gdl>` | экспериментальная генерация из JSON |

Общие опции: `--registry <donors.json>`, `--extron-dir <папка GUI Designer>`; переменные `EXTRON_GUI_DESIGNER_DIR`, `EXUI_DOTNET_EXE`.

---

## Статус

Preview. Подтверждено: экспорт из Figma → CLI → GUI Designer Verify 0/0 → Save and Build → повторное открытие для Home 1025M ([протокол](verification/results/2026-10-21-release-0.2.1.md)); автоматические сценарии для обеих панелей. **Не проверено:** работа на физической панели, касания и удержания, feedback. Каждый новый проект требует своей проверки в GUI Designer. Планы — [ROADMAP.md](ROADMAP.md).

Оформление и части экспорта плагина адаптированы из Baolv/figma-export по разрешению; лицензии зависимостей — [THIRD_PARTY_NOTICES.md](src/figma-plugin/THIRD_PARTY_NOTICES.md).

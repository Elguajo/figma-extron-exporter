<a id="russian"></a>

# Разработка Figma → Extron Exporter

**Русский** · [English](#english)

## Архитектура

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
- **Версии Extron задаются профилями** в `src/adapter/compatibility/extron.json`; `doctor` проверяет установленную среду и общий контракт адаптера. Порядок подключения обновлений GUI Designer и проверки GCP — [совместимость](extron-compatibility.md).

Обоснования — [docs/decisions.md](decisions.md), формат GDL — [docs/extron-format.md](extron-format.md), контракт пакета — [docs/exui-v5.md](exui-v5.md).

## Структура репозитория

```text
src/figma-plugin/        плагин: src/ — код, test/ — тесты, ui.html — интерфейс, *.md — инструкции дизайнеру
src/cli/                 консольные команды
src/screen/              модель и валидация пакета .exui; schemas/ — JSON Schema
src/adapter/             генерация GDL через Extron; host/ — x86 PowerShell-хост, compatibility/ — профили версий
src/extron/              формат GDL: контейнер, NRBF, модель проекта
src/updater/             Windows-утилита выборочного обновления GDL
tests/format/            .NET-тесты (исполняемый проект)
tests/fixtures/          эталонные .exui и id-map для тестов и демонстрации
samples/                 donors.json и manifest.json; donors/, original/, fixtures/ — закрытые GDL, локально, вне Git
docs/                    контракты, формат Extron, решения
docs/verification/       чек-лист и протоколы проверок
docs/design/, docs/web/  исходники Extron Kit и сайт его документации
releases/                заметки к выпускам плагина и CLI
scripts/                 лаунчер CLI и упаковка выпуска
output/                  временные сборки и результаты, вне Git; можно очищать целиком
```

Модули плагина: `recognize.ts` — распознавание имён, `assignment-rules.ts` — ключи и ID, `button-preparation.ts` / `button-artwork.ts` — состояния кнопок, `export.ts` и `package.ts` — сборка `.exui`, `kit.ts` — Extron Kit, `ui.ts` — логика интерфейса, `code.ts` — точка входа.

## Сборка и проверки

Нужны .NET SDK **10.0.402** ([global.json](../global.json)) и Node.js **≥ 22.18**. Команды — из корня репозитория.

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
dotnet run --project src/cli -- validate-package tests/fixtures/exui-v5/expanded-1025m.exui
```

Доноры хранятся в проекте в одном месте — `samples/donors/` и `samples/original/` рядом с реестром [samples/donors.json](../samples/donors.json); закрытые GDL для отдельных тестов и упаковки — в `samples/fixtures/`. Эти GDL не входят в Git (репозиторий публичный): новый разработчик получает их у владельца проекта и кладёт туда же. Проверки распакованного архива CLI запускают с `EXUI_DONOR_REGISTRY=<проект>\samples\donors.json`, поэтому копировать доноров в папку каждой версии не нужно.

Интеграционные тесты (нужны GUI Designer и доноры в `samples/donors/`):

```powershell
dotnet run --project tests/format -- --registry samples/donors.json --integration
```

`--integration` включает и эталонную проверку: шесть пакетов из [tests/format/golden-gdl.json](../tests/format/golden-gdl.json) должны дать тот же ProjectGCP байт в байт. Отдельно и быстрее — `--golden`. Используйте её после любой правки генератора или хоста: генерация детерминирована, и даже безобидная на вид оптимизация может изменить байты. Например, кэш поиска полей в хосте менял порядок полей BinaryFormatter. Эталон обновляют только при намеренном изменении результата.

```powershell
dotnet run --project tests/format -- --registry samples/donors.json --golden
```

CI ([.github/workflows/ci.yml](../.github/workflows/ci.yml)) на каждом push в `main` проверяет чистый checkout без Extron: `npm run verify`, сборку .NET, unit-тесты и `validate-package`. Тест `performance-budget.test.ts` ограничивает число полных обходов дерева дизайна на событие плагина.

Автотесты не заменяют проверку в GUI Designer и на панели — порядок ручной проверки в [docs/verification/checklist.md](verification/checklist.md).

## Выпуск

1. Поднять версию в `src/figma-plugin/package.json` (`version`, `compatibleCliVersion`) и, если менялся CLI, в `src/cli/Extron.Cli.csproj`.
2. Добавить запись в [CHANGELOG.md](../CHANGELOG.md) и `releases/figma-plugin/<версия>/README.md`.
3. Собрать архивы — скрипт пишет в `output/releases/<версия>/` и не перезаписывает существующие:

```powershell
.\scripts\Package-Release.ps1
```

4. Стабильный выпуск собирать из чистого коммита и после smoke-тестов класть рядом с заметками к выпуску: `releases/figma-plugin/<версия>/figma-extron-plugin-<версия>.zip` и `releases/cli/<версия>/figma-extron-cli-<версия>-windows.zip`, в каждой папке — свой `SHA256SUMS.txt`. Архивы в git не хранятся (`.gitignore`), файлы контрольных сумм — хранятся. Локальный архив `figma-extron-complete-*` с донорами туда не класть.
5. Закоммитить, запушить и опубликовать релиз на GitHub с текстом из `releases/github/v<версия>.md` и двумя архивами из `releases/figma-plugin/<версия>/` и `releases/cli/<версия>/`. Локальный архив `figma-extron-complete-*` с донорами не публиковать.

## Команды CLI

| Команда | Назначение |
|---|---|
| `doctor` | версии GUI Designer/GCP, профиль, проверка типов/полей/enum и отпечаток адаптера без загрузки проекта |
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
| `plan-layout-update <working.gdl> <incoming.gdl>` | план кнопок, оформление которых можно перенести в рабочий GDL |
| `update-layout <working.gdl> <incoming.gdl> <selection.json> <new.gdl>` | перенос оформления выбранных кнопок в новый GDL |
| `generate-screen <screen.json> <donor-id> <new.gdl>` | экспериментальная генерация из JSON |

Опции команд адаптера: `--registry <donors.json>`, `--extron-dir <папка GUI Designer>`, `--compatibility <профили.json>`. `doctor` принимает `--gcp-dir <папка GCP>`; переменные `EXTRON_GUI_DESIGNER_DIR`, `EXTRON_GCP_DIR`, `EXUI_DOTNET_EXE`, `EXUI_HOST_TIMEOUT` (таймаут хоста в минутах, 1–1440, по умолчанию 10) и `EXUI_HOST_TRACE=1` (время этапов хоста в `HostOutput` отчёта).

[Вернуться к README](../README.ru.md)

---

<a id="english"></a>

# Developing Figma → Extron Exporter

[Русский](#russian) · **English**

## Architecture

```text
src/figma-plugin  (TypeScript, Figma API)
   recognizes layers by name → assigns keys/IDs → renders PNGs → writes .exui (ZIP: manifest.json + screen.json + PNG)
        │
        ▼
src/cli  (.NET 10, entry point Program.cs)
   ├─ src/screen   EXUI/5 contract, JSON Schema, validation, id-map, independent verifier
   ├─ src/adapter  donor registry, GDL generation → x86 PowerShell child process (adapter/host)
   │                that loads the DLLs of the installed GUI Designer
   └─ src/extron   reads/writes the GDL container and NRBF without Extron DLLs — to verify the result
```

Key decisions:

- **Extron DLLs are not shipped.** They are loaded only in the separate 32-bit `adapter/host` process from the installed GUI Designer. The main process reads NRBF with `System.Formats.Nrbf` and never creates Extron objects.
- **New objects are cloned from donors** — reference GDLs pinned by SHA-256 — instead of being built from scratch.
- **The result is verified independently**: after generation, `src/extron` reads the GDL back and compares it with the package (`.gdl.report.json`).
- **Extron versions are defined by profiles** in `src/adapter/compatibility/extron.json`; `doctor` checks the installed environment and the common adapter contract. How to add GUI Designer updates and check GCP: [compatibility](extron-compatibility.md#english).

Rationale: [docs/decisions.md](decisions.md) (in Russian); GDL format: [docs/extron-format.md](extron-format.md) (in Russian); package contract: [docs/exui-v5.md](exui-v5.md#english).

## Repository layout

```text
src/figma-plugin/        plugin: src/ — code, test/ — tests, ui.html — interface, *.md — guides for designers
src/cli/                 console commands
src/screen/              .exui package model and validation; schemas/ — JSON Schema
src/adapter/             GDL generation through Extron; host/ — x86 PowerShell host, compatibility/ — version profiles
src/extron/              GDL format: container, NRBF, project model
src/updater/             Windows tool for the selective GDL update
tests/format/            .NET tests (executable project)
tests/fixtures/          reference .exui files and id-maps for tests and demos
samples/                 donors.json and manifest.json; donors/, original/, fixtures/ — private GDLs, local only, not in Git
docs/                    contracts, Extron format, decisions
docs/verification/       checklist and verification reports
docs/design/, docs/web/  Extron Kit sources and its documentation site
releases/                release notes for the plugin and CLI
scripts/                 CLI launcher and release packaging
output/                  temporary builds and results, not in Git; safe to delete entirely
```

Plugin modules: `recognize.ts` — name recognition, `assignment-rules.ts` — keys and IDs, `button-preparation.ts` / `button-artwork.ts` — button states, `export.ts` and `package.ts` — building the `.exui`, `kit.ts` — Extron Kit, `ui.ts` — interface logic, `code.ts` — entry point.

## Build and checks

You need .NET SDK **10.0.402** ([global.json](../global.json)) and Node.js **≥ 22.18**. Run the commands from the repository root.

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

`verify` = typecheck + tests + build into `src/figma-plugin/dist/`. For debugging, import `src/figma-plugin/manifest.json` into Figma and restart the plugin after every build.

Run the CLI from source without Extron:

```powershell
dotnet run --project src/cli -- validate-package tests/fixtures/exui-v5/expanded-1025m.exui
```

Donors live in one place in the project — `samples/donors/` and `samples/original/` next to the registry [samples/donors.json](../samples/donors.json); private GDLs for some tests and packaging are in `samples/fixtures/`. These GDLs are not in Git (the repository is public): a new developer gets them from the project owner and puts them in the same place. Checks of an unpacked CLI archive run with `EXUI_DONOR_REGISTRY=<project>\samples\donors.json`, so you do not need to copy donors into the folder of every version.

Integration tests (need GUI Designer and donors in `samples/donors/`):

```powershell
dotnet run --project tests/format -- --registry samples/donors.json --integration
```

`--integration` also runs the golden check: the six packages from [tests/format/golden-gdl.json](../tests/format/golden-gdl.json) must produce the same ProjectGCP byte for byte. `--golden` runs it alone and faster. Use it after any change to the generator or the host: generation is deterministic, and even a harmless-looking optimization can change the bytes. For example, a field lookup cache in the host changed the order of BinaryFormatter fields. Update the golden values only when the result changes on purpose.

```powershell
dotnet run --project tests/format -- --registry samples/donors.json --golden
```

CI ([.github/workflows/ci.yml](../.github/workflows/ci.yml)) checks a clean checkout without Extron on every push to `main`: `npm run verify`, the .NET build, unit tests and `validate-package`. The `performance-budget.test.ts` test limits the number of full design tree walks per plugin event.

Automated tests do not replace checks in GUI Designer and on the panel — see the manual order in [docs/verification/checklist.md](verification/checklist.md#english).

## Releasing

1. Bump the version in `src/figma-plugin/package.json` (`version`, `compatibleCliVersion`) and, if the CLI changed, in `src/cli/Extron.Cli.csproj`.
2. Add an entry to [CHANGELOG.md](../CHANGELOG.md) and `releases/figma-plugin/<version>/README.md`.
3. Build the archives — the script writes to `output/releases/<version>/` and never overwrites existing ones:

```powershell
.\scripts\Package-Release.ps1
```

4. Build a stable release from a clean commit and, after smoke tests, put it next to the release notes: `releases/figma-plugin/<version>/figma-extron-plugin-<version>.zip` and `releases/cli/<version>/figma-extron-cli-<version>-windows.zip`, each folder with its own `SHA256SUMS.txt`. The archives are not stored in Git (`.gitignore`); the checksum files are. Never put the local `figma-extron-complete-*` archive with donors there.
5. Commit, push and publish the GitHub release with the text from `releases/github/v<version>.md` and the two archives from `releases/figma-plugin/<version>/` and `releases/cli/<version>/`. Never publish the local `figma-extron-complete-*` archive with donors.

## CLI commands

| Command | Purpose |
|---|---|
| `doctor` | GUI Designer/GCP versions, profile, check of types/fields/enums and the adapter fingerprint without loading a project |
| `validate-package <in.exui>` | checks the ZIP, schemas, IDs, links and resources |
| `id-map <in.exui>` | Markdown ID map for the programmer |
| `compare-packages <old.exui> <new.exui> [--json]` | compares exports before updating a configured GCP project |
| `convert-package <in.exui> <new.gdl>` | generates the GDL and its report; needs Extron and a donor |
| `prepare-donor <donor-id>` | prepares a donor from the reference project |
| `inspect <in.gdl\|glt>` | JSON inventory of the container and NRBF |
| `list-controls <in.gdl>` | pages, elements, IDs, states, resources |
| `compare-graph <a.gdl> <b.gdl>` | compares object graphs |
| `repack <in> <new>` | rebuilds the container without changing the payload |
| `set-button-text <in> <new> <id> <old> <new-text>` | replaces the text of a button's states |
| `plan-layout-update <working.gdl> <incoming.gdl>` | plan of buttons whose artwork can be transferred into the working GDL |
| `update-layout <working.gdl> <incoming.gdl> <selection.json> <new.gdl>` | transfers the artwork of the selected buttons into a new GDL |
| `generate-screen <screen.json> <donor-id> <new.gdl>` | experimental generation from JSON |

Adapter command options: `--registry <donors.json>`, `--extron-dir <GUI Designer folder>`, `--compatibility <profiles.json>`. `doctor` accepts `--gcp-dir <GCP folder>`; environment variables: `EXTRON_GUI_DESIGNER_DIR`, `EXTRON_GCP_DIR`, `EXUI_DOTNET_EXE`, `EXUI_HOST_TIMEOUT` (host timeout in minutes, 1–1440, default 10) and `EXUI_HOST_TRACE=1` (host stage timings in the report's `HostOutput`).

[Back to the README](../README.md)

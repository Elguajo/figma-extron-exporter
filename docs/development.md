# Разработка Figma → Extron Exporter

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
- **Версии Extron задаются профилями** в `compatibility/extron.json`; `doctor` проверяет установленную среду и общий контракт адаптера. Порядок подключения обновлений GUI Designer и проверки GCP — [совместимость](extron-compatibility.md).

Обоснования — [docs/decisions.md](decisions.md), формат GDL — [docs/extron-format.md](extron-format.md), контракт пакета — [docs/exui-v5.md](exui-v5.md).

## Структура репозитория

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
dotnet run --project src/cli -- validate-package examples/exui-v5/expanded-1025m.exui
```

Интеграционные тесты (нужны GUI Designer и доноры в библиотеке доноров — `Документы\Figma Extron Exporter\donors\`, либо `EXUI_DONOR_DIR` / `--donor-dir <папка>`):

```powershell
dotnet run --project tests/format -- --registry samples/donors.json --integration
```

`--integration` включает и эталонную проверку: шесть пакетов из [tests/format/golden-gdl.json](../tests/format/golden-gdl.json) должны дать тот же ProjectGCP байт в байт. Отдельно и быстрее — `--golden`. Используйте её после любой правки генератора или хоста: генерация детерминирована, и даже безобидная на вид оптимизация может изменить байты. Например, кэш поиска полей в хосте менял порядок полей BinaryFormatter. Эталон обновляют только при намеренном изменении результата.

```powershell
dotnet run --project tests/format -- --registry samples/donors.json --golden
```

CI ([.github/workflows/ci.yml](../.github/workflows/ci.yml)) на каждом push в `main` проверяет чистый checkout без Extron: `npm run verify`, сборку .NET, unit-тесты и `validate-package`. Тест `performance-budget.test.ts` ограничивает число полных обходов дерева дизайна на событие плагина.

Автотесты не заменяют проверку в GUI Designer и на панели — порядок ручной проверки в [verification/checklist.md](../verification/checklist.md).

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
| `generate-screen <screen.json> <donor-id> <new.gdl>` | экспериментальная генерация из JSON |

Опции команд адаптера: `--registry <donors.json>`, `--extron-dir <папка GUI Designer>`, `--compatibility <профили.json>`. `doctor` принимает `--gcp-dir <папка GCP>`; переменные `EXTRON_GUI_DESIGNER_DIR`, `EXTRON_GCP_DIR`, `EXUI_DOTNET_EXE`, `EXUI_HOST_TIMEOUT` (таймаут хоста в минутах, 1–1440, по умолчанию 10) и `EXUI_HOST_TRACE=1` (время этапов хоста в `HostOutput` отчёта).

[Вернуться к README](../README.md)

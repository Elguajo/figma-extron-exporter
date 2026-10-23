# CLI 0.6.6 — сравнение экспортов перед обновлением GCP

22.10.2026. Работа в основной папке на `main`. Плагин 0.6.8 и EXUI/5 не изменены.

**Дополнение 23.10.2026:** повторный GUI-прогон закрыл проверку кнопок 1025M: обе версии прошли GUI Designer Build 0/0, действие и feedback Music сохранились после импорта v2 и повторного открытия GCP, новая Extra не получила действие удалённого Mute. [Отдельный протокол](2026-10-23-gcp-layout-update.md). Статус `unavailable` ниже описывает первоначальную попытку 22.10; связь уровня, 300M и оборудование этим дополнением не подтверждаются.

## Реализовано

`compare-packages <old.exui> <new.exui> [--json]` читает оба пакета через существующий строгий reader, затем сравнивает проект, страницы, popup/группы и все элементы. Разделяет изменения оформления, проверку конфигурации и изменение адресации/состояний. Ключи сопоставляются перед числовыми идентификаторами, чтобы перестановка ID не скрывала конфликт. Совпадение только controlId отмечается как возможная замена или переиспользование. PNG сравниваются по SHA-256, состояния — после нормализации stateId.

Markdown содержит сводку и изменённые элементы; JSON `exui-comparison/1` — также все неизменённые. В отчёте есть SHA-256 исходных снимков и явное `gcpVerified: false`. Код `0` означает успешное сравнение, включая обнаруженные риски; `requiresReview` и уровни изменений читаются отдельно. Исходные EXUI, назначения Figma и проекты GCP не меняются.

История представлена сохранёнными версиями EXUI; полная историческая база назначений не реализована. Существующий резерв автоматически выданных ID в Figma не заменён новым механизмом. Упаковщик берёт номер CLI из csproj и проверяет минимальную совместимую версию, поэтому новый CLI можно использовать с неизменённым плагином.

## Проверки

| ID | Проверка | Статус | Источник |
|---|---|---|---|
| build | Release build, без ошибок/предупреждений | passed | `.tools/dotnet/dotnet.exe build ExtronExporter.slnx --no-restore --configuration Release` |
| contracts | .NET unit + native integration, **227/227** | passed | `output/comparison-native-regression.log`; `run --project tests/format --no-restore -- --registry samples/donors.json --integration` |
| identity | Сохранение ID, копии, удаление и резерв; **44/44** теста плагина | passed | `output/comparison-plugin-identity.log`; `node --test src/figma-plugin/test/recognize.test.ts src/figma-plugin/test/auto-assignment.test.ts` |
| archive | Упаковка CLI 0.6.6; распаковка и запуск его DLL | passed | `output/comparison-package.log`; `output/releases/cli-0.6.6/` |
| workflow | Bundled plugin → v1 → правки/добавление/удаление → новый runtime → v2 → CLI из ZIP → GDL/NRBF | passed | `output/update-workflow/cli-0.6.6-archive/results.json` |
| launcher | PowerShell-лаунчер из ZIP, другая рабочая папка, относительные пути с пробелами | passed | `output/comparison-launcher.json`, схема и `requiresReview` проверены |
| refusal | Неполные/неверные аргументы, неподходящий флаг, отсутствующий/повреждённый пакет; нет ложного отчёта | passed | `src/figma-plugin/test/update-workflow-integration.ts`, сценарий выполнен на DLL из ZIP |
| review | Просмотр нового сравнения, парсера CLI, упаковки, тестов и документации | passed | Локальный diff и новые файлы; исправлены разрешение image по нормализованному ResourceName и избыточно длинные визуальные записи отчёта; новых подтверждённых дефектов не выявлено |
| gcp | Назначение действий/feedback v1 → импорт v2 с сохранением конфигурации | unavailable | GCP запущен, но UI-управление дочерним Add Controller не прошло надёжно: `element … not available in cached app state`, затем `point … over Add Controller, not target window`. Действия/feedback не настроены, импорт не проверен |

Автоматический workflow прошёл для **обоих профилей**. В каждом Music сохранил objectId и controlId **8101**, уровень — **8102**; удалённый Mute **8103** не переиспользован, Extra получил **8104**. Каждый из четырёх новых GDL прошёл **70/70** независимых проверок. В Markdown — одна изменённая кнопка, одна удалённая и одна добавленная; повторный JSON совпадает. Версии EXUI и GDL записаны отдельными файлами, прежние архивы сохранены.

API и рендер Figma в workflow моделируются; исполняется настоящий собранный код плагина и CLI из ZIP с установленными DLL Extron и независимым NRBF reader. Это не запуск внутри Figma Desktop и не новый GUI Designer Build. Физическое оборудование не проверено.

## Артефакты и следующий ручной рубеж

- CLI: `output/releases/cli-0.6.6/figma-extron-cli-0.6.6-windows.zip`.
- SHA-256 CLI: `4F645013F204FBB107D47382FCA804858235A5F3C509B1152E12B916EE558384`.
- Рабочая сборка содержит `sourceCommit=9ed2a40f51d5d44e68653772c8e8316a7086e0f7`, `sourceDirty=true`: подготовлена из текущих локальных изменений; публикация на GitHub не выполнялась.
- Пары v1/v2 EXUI, GDL, отчёты сравнения и проверки: `output/update-workflow/cli-0.6.6-archive/`.
- [Инструкция обновления и ручной сценарий GCP](../../docs/updating-configured-projects.md).

Справка установленного GCP (`Help/Content/HTML_Files/Config_Palette/User_Interfaces.htm`) подтверждает процедуру Import layout / Layout Reconciliation и вариант сохранения существующей конфигурации. Это источник инструкции, а не результат нашего испытания сохранности назначений.

Решение release-check: **SHIP WITH KNOWN RISKS, local preview** для сравнения EXUI. Полный сценарий сохранности настроек GCP не объявляется выполненным. До его подтверждения обновление рабочей системы выполняется через копию проекта и ручную сверку.

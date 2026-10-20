# Figma → Extron Exporter

Локальный конвертер подготовленных интерфейсов Figma в проекты Extron GUI Designer.

Реализовано:
- чтение контейнера `.gdl`/`.glt`, включая многозаписный файл после Save and Build;
- структурное чтение NRBF;
- пересборка контейнера;
- изменение подписи существующей кнопки с сохранением ID;
- экспериментальная генерация **нового** экрана из JSON-описания через локальный адаптер к установленному GUI Designer;
- проверка версионируемого ZIP-пакета `.exui/1` без Extron и преобразование в новый редактируемый `.gdl`;
- `.exui/2`: несколько страниц, обычные и модальные popup, группы popup, ссылки на popup, указание навигации и карта ID для программиста.

Пересобранный проект и вариант с «Музыка» прошли открытие, редактирование, Verify, штатный Save and Build и повторное открытие в GUI Designer 1.28.0.7.

Сгенерированные экраны для TLP Pro 1025M и TLP Pro 300M проходят независимую проверку данных и прошли ручной цикл GUI Designer 1.28.0.7: открытие, редактирование, Verify, Save and Build, повторное открытие. На панели они не проверялись. Контракт `.exui/1` и CLI-конвертация реализованы. Добавлен MVP Figma-плагина 0.1.2: подготовленный Frame → `.exui/1`; реальный экспорт демо 300M из Figma проверен и преобразован в GDL (65/65), включая оба PNG скрытых состояний. Позднейший реальный экспорт блока 1025M и его GUI-цикл описаны ниже. Desktop UI пока нет. Новые результаты из пакетов автоматически проверены и побайтово совпадают с экспериментальным путём; отдельный GUI-цикл для этих файлов не выполнялся. Verify этапа 4 был выполнен, числа ошибок/предупреждений не переданы.

Обновление 20.10.2026, плагин **0.2.0**: новые нативные Slider, динамические Value, Gauge/VolumeLED/Multistate Level, Shape/Line/DateTime; экспорт нескольких страниц, popup, групп и ссылок из Figma, до 8 состояний. [Контракт exui/5](docs/exui-v5.md), [таблица новых сущностей](docs/figma-prefix-reference.md), [протокол](verification/results/2026-10-20-expanded-controls.md). Для новых возможностей обновить CLI и реестр доноров вместе с плагином. Старые пакеты поддерживаются. Новые сценарии проверены автоматически; границы последующей GUI-проверки блока громкости описаны ниже. Настоящий Figma 0.2.0 и GUI-цикл адаптированного блока 1025M проверены; подробности ниже. Панель не проверена.

Результат конвертера — редактируемый `.gdl`. Build выполняется штатно в GUI Designer; собственной функции Build в конвертере нет. Запуск штатной сборки в протоколе служит проверкой совместимости.

Практическая проверка 0.2.0: [блок громкости 1025M в GUI Designer](verification/results/2026-10-20-volume-gui.md) прошёл редактирование Slider/Value/Button, Verify 0/0, Save and Build и reopen. Исправлены невидимый нативный бегунок и его коэффициент пропорций. Вход синтетический; остальные новые GUI-сценарии и оборудование ещё не проверены. Реальный блок 1025M проверен отдельно, см. ниже. Использовать обновлённый CLI; архив плагина не менялся.

[Настоящий экспорт Trilliant / 1025M](verification/results/2026-10-20-real-figma-1025m.md): адаптированная копия HomeVolumeReady экспортирована штатным 0.2.0 в exui/5 и преобразована в GDL, 80/80. Настоящий GUI Designer: правки Slider/Value/Button, Verify **0/0**, Save and Build, reopen; независимое чтение после Build **74/74**. Исправлены невидимый PBImage и наследуемое выравнивание Value/Label; ширина Value в копии увеличена для нативного текста. Полный исходный экран и оборудование не проверены.

- [Плагин Figma: установка и первый экспорт](src/figma-plugin/README.md)
- [Таблица префиксов с объяснениями: кнопки, громкость, логотипы](src/figma-plugin/PREFIXES.md)
- [Стандарт подготовки собственного макета Figma, v2.0](src/figma-plugin/AUTHORING_STANDARD.md)
- [Контракт `.exui/3`: кнопки без отдельного Pressed](docs/exui-v3.md)
- [Контракт `.exui/4`: логотипы и кнопки Normal/Pressed](docs/exui-v4.md)
- [Протокол плагина 0.1.0](verification/results/2026-10-19-figma-plugin.md)
- [Исправление обмена сообщениями 0.1.1](verification/results/2026-10-19-figma-ui-messages.md)
- [PNG скрытых состояний: исправление 0.1.2](verification/results/2026-10-19-figma-png-export.md)
- [Первый реальный экспорт Figma 300M и проверка GDL](verification/results/2026-10-19-figma-real-export.md)
- [Контракт `.exui/1`](docs/exui-v1.md)
- [Пакеты и воспроизведение](examples/exui-v1/README.md)
- [Протокол этапа 5](verification/results/2026-10-19-exui-v1.md)
- [Контракт `.exui/2`: страницы и popup](docs/exui-v2.md)
- [Пакеты `.exui/2` и ручная проверка](examples/exui-v2/README.md)
- [Протокол страниц и popup](verification/results/2026-10-19-pages-popups.md)
- [Статус работ и выполненные задачи](ROADMAP.md)
- [План разработки](DEVELOPMENT_PLAN.md)
- [Подтверждённый формат](docs/extron-format.md)
- [Технические решения](docs/decisions.md)
- [Исследование аналогов](docs/analogue-research-2026-10-19.md)
- [Результаты первого этапа](verification/results/2026-10-19-initial-slice.md)
- [GUI-проверка и изменение подписи](verification/results/2026-10-19-gui-text-edit.md)
- [Первый собственный экран: генерация и проверки](verification/results/2026-10-19-first-screen.md)
- [Пример экрана и ручная проверка](examples/first-screen/README.md)

## Среда

.NET SDK 10.0.402, Windows. Версия зафиксирована в `global.json`. В текущей рабочей папке SDK установлен из официального Microsoft dotnet-install в `.tools/dotnet`, без изменения системного PATH. Эта папка не хранится в Git. На другом компьютере требуется установить SDK либо подготовить такой же локальный SDK.

Единственная внешняя библиотека .NET-ядра — Microsoft `System.Formats.Nrbf` 10.0.11. Она читает записи без создания объектов Extron. Lock-файлы сохраняют разрешённые версии зависимостей. Процесс .NET не использует BinaryFormatter и не загружает DLL Extron.

Команды `prepare-donor`, `generate-screen` и `convert-package` дополнительно требуют:
- установленный GUI Designer 1.28.0.7 в `C:\Program Files (x86)\Extron\GUI Designer`; другой путь задаётся `--extron-dir` или `EXTRON_GUI_DESIGNER_DIR`;
- 32-битный Windows PowerShell 5.1 (`C:\Windows\SysWOW64\WindowsPowerShell\v1.0\powershell.exe`).

Сборки Extron загружаются только в отдельном процессе этого PowerShell и только из установленного приложения; в поставку они не входят (`docs/decisions.md`, D006–D010).

| Папка | Назначение | Зависит от Extron |
|---|---|---|
| `src/extron` | Контейнер, NRBF-инвентаризация, редактор подписи, read-only модель проекта | нет |
| `src/screen` | Контракты `.exui/1–5`, проверка ZIP/JSON, экспериментальная модель, карта ID и независимый верификатор | нет |
| `src/adapter` | Реестр доноров, граница процесса, x86-хост `host/ExtronAdapterHost.ps1` | только в дочернем процессе |
| `src/cli` | Консольные команды | через adapter |
| `src/figma-plugin` | TypeScript-плагин: подготовленные экраны/проекты, метаданные, PNG и `.exui/1/3/4/5` | нет |

## Плагин Figma

[Скачать готовый плагин 0.2.0](releases/figma-plugin/0.2.0/figma-extron-plugin-0.2.0.zip) · [Установка и проверки](releases/figma-plugin/0.2.0/README.md). Поддержаны короткие/полные префиксы без учёта регистра, прежние кнопки/логотипы и новые нативные элементы, проект с несколькими страницами и popup. Для новых функций нужен текущий CLI с `.exui/5`.

В Figma Desktop импортировать `src/figma-plugin/manifest.json` после сборки:

```powershell
npm ci --prefix src/figma-plugin --ignore-scripts
npm run verify --prefix src/figma-plugin
npm run package --prefix src/figma-plugin
```

Нужен Node >=22.18, проверено на 24.21.0. Готовый архив создаётся в `output/figma-plugin/`; существующий файл не заменяется. Внутри панели выбрать профиль, создать демо, проверить и скачать `.exui`. Имена слоёв произвольны; роли, ключи и ID задаются явно через плагин. [Подробная инструкция](src/figma-plugin/README.md).

Оформление и части экспорта адаптированы из Baolv/figma-export по разрешению пользователя. Тесты Figma API выполнялись в явном тестовом окружении, UI — в Chromium; новые пакеты преобразованы настоящим CLI для обеих панелей, 65/65. Это не заменяет проверку импорта/рендера в настоящем Figma Desktop или работу на панели.

## Сборка

В PowerShell из корня проекта:

```powershell
$dotnet = '.\.tools\dotnet\dotnet.exe'
& $dotnet restore ExtronExporter.slnx --locked-mode
& $dotnet build ExtronExporter.slnx --no-restore
```

Если SDK установлен системно, вместо `$dotnet` можно использовать `dotnet`.

## Исследовать файл

```powershell
& $dotnet run --project src/cli --no-build -- inspect samples/original/Full-Test-Project.gdl
& $dotnet run --project src/cli --no-build -- list-controls output/first-screen/first-screen-1025m.gdl
& $dotnet run --project src/cli --no-build -- compare-graph <a.gdl> <b.gdl>
```

`inspect` выводит JSON:
- записи контейнера;
- размер и SHA-256 payload;
- тип корня и поля проекта;
- количество записей и классов;
- краткий список элементов.

`list-controls` выводит:
- профиль панели (класс платформы, part number, размер);
- страницы и popup;
- элементы с objectId и controlId, геометрию и текст;
- состояния и ресурсы;
- у popup — модальность, группу и обратные ссылки, у ссылок на popup — привязку, реестр групп проекта;
- статус Build, VersionInfo и номера изображений Build (TLPImageID).

`compare-graph` сравнивает два проекта по графу объектов NRBF без учёта ID записей и выводит до 50 различий с путями. Отдельно приводятся различия без `List<T>._version` — счётчика изменений .NET без значения для проекта.

Эти команды читают и файл после Save and Build. Открытие в GUI Designer они не проверяют.

## Пересобрать контейнер

```powershell
& $dotnet run --project src/cli --no-build -- repack samples/original/Full-Test-Project.gdl output/repacked-new.gdl
```

Каталог назначения должен существовать. Команда создаёт только новый файл и отказывается перезаписывать существующий. NRBF payload остаётся побайтово неизменным, остальные записи контейнера копируются побайтно. Сжатие и размер контейнера могут отличаться. Это проверка упаковки, а не запись нового графа объектов.

Выходные коды всех команд: 0 — успешно, 1 — отказ (ошибка файла, формата, записи, описания или адаптера), 2 — неверные аргументы.

## Пакет `.exui/1` → `.gdl`

```powershell
& $dotnet run --project src/cli --no-build -- validate-package examples/exui-v1/first-screen-1025m.exui
New-Item -ItemType Directory -Force output/exui-v1 | Out-Null
& $dotnet run --project src/cli --no-build -- convert-package examples/exui-v1/first-screen-1025m.exui output/exui-v1/new-1025m.gdl
& $dotnet run --project src/cli --no-build -- convert-package examples/exui-v1/first-screen-300m.exui output/exui-v1/new-300m.gdl
```

Доноры должны быть подготовлены (команды ниже). `validate-package` не требует Extron. `convert-package` выбирает локального закреплённого донора по профилю, проверяет ZIP, встроенные схемы, ссылки, ID и ресурсы; затем использует существующий генератор и независимый NRBF verifier. Одновременно создаётся `<output>.report.json`; существующий GDL или report не перезаписывается. Каждый повтор — новый файл; сохранение ручных правок GDL не обещается. Поддержано строго ограниченное подмножество: одна страница, button, label, PBLevel/Slider слева направо 0..100, три роли состояний, Arial, PNG. [Полные правила и диагностика](docs/exui-v1.md).

## Пакет `.exui/2`: страницы и popup

```powershell
& $dotnet run --project src/cli --no-build -- validate-package examples/exui-v2/pages-popups-1025m.exui
& $dotnet run --project src/cli --no-build -- id-map examples/exui-v2/pages-popups-1025m.exui
& $dotnet run --project src/cli --no-build -- convert-package examples/exui-v2/pages-popups-1025m.exui output/exui-v2/new-1025m.gdl
```

Версия выбирается маркером манифеста. К элементам v1 добавлены:
- несколько страниц со способом показа: стартовая, по кнопке или программой;
- обычные popup — свой размер, прямая ссылка или группа;
- модальные popup — полный холст; ссылки на них Build создаёт сам;
- группы popup и элемент `popup-ref`;
- поле `navigate` у кнопок.

Переходы в GDL не хранятся — их выполняет программа управления. `id-map` выдаёт карту ID: страницы и popup, как они показываются, все ID с состояниями и целями переходов. Связь popup пишется и проверяется во всех четырёх местах проекта. [Контракт](docs/exui-v2.md). GUI-проверка результатов `exui/2` ещё не выполнена.

## Экспериментальная генерация собственного экрана

```powershell
& $dotnet run --project src/cli --no-build -- prepare-donor tlp-pro-1025m
& $dotnet run --project src/cli --no-build -- generate-screen examples/first-screen/screen-1025m.json tlp-pro-1025m output/first-screen/first-screen-1025m.gdl
```

**`prepare-donor <id>`** создаёт донора по записи `samples/donors.json`:
1. Исходник — неизменяемый эталон из `samples/manifest.json`.
2. Копия сокращается до страницы Main и Offline popup.
3. Для 1025M платформа меняется через фабрику Extron `PBPlatformPro.CreatePlatform`.
4. Результат пишется в `samples/donors/`; эта папка не хранится в Git.
5. SHA-256 результата сверяется с реестром.

**`generate-screen <описание.json> <id донора> <новый.gdl>`**:
1. Проверяет описание по фактическому холсту и панели донора.
2. В отдельном x86-процессе клонирует объекты донора и записывает поля.
3. Независимо проверяет результат NRBF reader: профиль, ID, текст, геометрию, состояния, ресурсы, границы.
4. Упаковывает результат.
5. Пишет `<новый.gdl>.report.json`.

Обе команды принимают id донора, а не путь: произвольный GDL не передаётся десериализатору Extron. Существующие файлы не перезаписываются. При ошибке ничего не пишется, а сообщение содержит код:

| Код | Причина |
|---|---|
| `extron-missing`, `extron-version`, `host-missing` | Нет компонента Extron, нужной версии или x86 PowerShell |
| `donor-unknown`, `donor-hash`, `donor-unpinned`, `donor-element` | Неподходящий донор или в нём нет нужного элемента |
| `profile-mismatch` | Несовместимый профиль панели |
| `resource-missing`, `resource-conflict` | Нет ресурса или шрифта; конфликт имени ресурса |
| `spec` | Ошибка описания экрана |
| `output-exists` | Выходной файл уже существует |

Поддержано: button, label, level (gauge или slider) и PNG-ресурсы на одной странице. Описание `exui-screen-experiment/0` — не окончательный контракт `.exui`. Пример и инструкция ручной проверки — в `examples/first-screen/README.md`; результат проверки — в протоколе.

## Экспериментальное изменение подписи

```powershell
& $dotnet run --project src/cli --no-build -- set-button-text samples/original/Full-Test-Project.gdl output/music-new.gdl 8000 'Press to begin' 'Музыка'
```

Команда создаёт только новый файл. Она меняет обычный текст всех состояний одной кнопки, найденной по уникальному ID, и проверяет ожидаемую старую подпись.

Поддержан наблюдаемый профиль 1.28.0.7 с нулевым `UInt64 checksum`. Не поддерживаются formatted text, строки и состояния, общие с другими объектами, и неизвестные массивы.

Остальные байты NRBF, ссылки, ID и поля классов сохраняются. CRC и размеры контейнера пересчитываются. Это ограниченный редактор существующих строк, не writer новых объектов.

## Проверки

Используется небольшой исполняемый набор проверок без отдельного тестового фреймворка. Он запускается через `dotnet run`, а не `dotnet test`.

```powershell
& $dotnet run --project tests/format --no-build
& $dotnet run --project tests/format --no-build -- samples/original/Full-Test-Project.gdl 'C:\Users\Public\Documents\Extron\GUI Designer Templates\TouchLink Templates' --built output/Full-Test-Project-music.gdl --registry samples/donors.json --integration
```

Без аргументов выполняются 121 проверка без Extron и без локальных образцов:
- контейнер, включая многозаписный;
- редактор подписи;
- описание экрана и его ошибки;
- граница адаптера;
- `.exui/1`: схемы, ресурсы, состояния, ID, отказы ZIP/JSON, пути и целостность;
- `.exui/2`: страницы, popup, группы, ссылки, навигация, карта ID и 25 видов отказа.

Дополнительные аргументы:
- первый позиционный — 10 проверок реального Full-Test-Project;
- второй — проверка каждого GLT в каталоге;
- `--built <файл>` — файл после ручного Save and Build;
- `--registry samples/donors.json` — доноры и отказы реестра;
- `--gui-built-screens <папка>` — файлы `first-screen-*.gdl` после ручного Save and Build: запись `.tgz4`, TLPImageID, совпадение с описанием (нужен `--registry`);
- `--gui-built-pages <папка>` — файлы `pages-popups-*.gdl` после ручного Save and Build: дополнительно ссылки Build на модальные popup и сохранность привязок (нужен `--registry`);
- `--integration` — реальная генерация обеих панелей через GUI Designer, детерминированность, сохранность ID, отказы хоста и неизменность исходников.

Полный прогон со страницами и popup: 203 passed, 0 failed (`verification/results/2026-10-19-pages-popups-tests.txt`). Полный прогон этапа 5: 167 passed, 0 failed (`verification/results/2026-10-19-exui-v1-tests.txt`), включая `--gui-built-screens output/first-screen`. Дополнительные интеграционные проверки сравнивают пакетный результат с экспериментальным GDL побайтово для обеих панелей, проверяют детерминированность, ID после изменений и отсутствие конечных файлов при отказе. Исторический прогон этапа 4: 124 passed, 0 failed. Набор возвращает ненулевой код при ошибке.

Исходный GDL скопирован из родительской папки; SHA-256 указан в `samples/manifest.json`. Доноры закреплены SHA-256 в `samples/donors.json`. Крупные сторонние образцы, доноры и сгенерированные проекты исключены из Git. При переносе репозитория образцы нужно предоставить отдельно и сверить с манифестом; доноры воспроизводятся командой `prepare-donor`.

## Граница поддержки

Поддерживается только обнаруженный профиль KP-контейнера:
- от 1 до 16 записей, первая — `ProjectGCP`; остальные, например `<проект>.tgz4` после Save and Build, сохраняются как есть;
- stored или DEFLATE;
- без шифрования, data descriptors, ZIP64 и нескольких дисков;
- записи идут подряд с начала файла, без промежутков.

Ограничения размера: контейнер 64 MiB, все распакованные записи 128 MiB. Для каждой записи проверяются центральный каталог, соответствие локального заголовка, имя, длины и CRC32. Глобальная замена байтов KP/PK не используется.

Доноры генерации должны быть несобранными однозаписными проектами. Исходные проекты пользователя и установленные шаблоны не изменяются.

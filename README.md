# Figma → Extron Exporter

Локальный конвертер подготовленных интерфейсов Figma в проекты Extron GUI Designer.

Реализовано:
- чтение контейнера `.gdl`/`.glt`, включая многозаписный файл после Save and Build;
- структурное чтение NRBF;
- пересборка контейнера;
- изменение подписи существующей кнопки с сохранением ID;
- экспериментальная генерация **нового** экрана из JSON-описания через локальный адаптер к установленному GUI Designer.

Пересобранный проект и вариант с «Музыка» прошли открытие, редактирование, Verify, штатный Save and Build и повторное открытие в GUI Designer 1.28.0.7.

Сгенерированные экраны для TLP Pro 1025M и TLP Pro 300M проходят независимую проверку данных, но **в GUI Designer ещё не проверены**. Экспорта `.exui`, Figma-плагина и desktop UI пока нет.

Результат конвертера — редактируемый `.gdl`. Build выполняет пользователь в GUI Designer; собственной функции Build в конвертере нет, автоматизации Build тоже. Запуск штатной сборки в протоколе служит проверкой совместимости.

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

Единственная внешняя библиотека — Microsoft `System.Formats.Nrbf` 10.0.11. Она читает записи без создания объектов Extron. Lock-файлы сохраняют разрешённые версии зависимостей. Процесс .NET не использует BinaryFormatter и не загружает DLL Extron.

Команды `prepare-donor` и `generate-screen` дополнительно требуют:
- установленный GUI Designer 1.28.0.7 в `C:\Program Files (x86)\Extron\GUI Designer`; другой путь задаётся `--extron-dir` или `EXTRON_GUI_DESIGNER_DIR`;
- 32-битный Windows PowerShell 5.1 (`C:\Windows\SysWOW64\WindowsPowerShell\v1.0\powershell.exe`).

Сборки Extron загружаются только в отдельном процессе этого PowerShell и только из установленного приложения; в поставку они не входят (`docs/decisions.md`, D006–D010).

| Папка | Назначение | Зависит от Extron |
|---|---|---|
| `src/extron` | Контейнер, NRBF-инвентаризация, редактор подписи, read-only модель проекта | нет |
| `src/screen` | Экспериментальное описание экрана, проверка и независимый верификатор результата | нет |
| `src/adapter` | Реестр доноров, граница процесса, x86-хост `host/ExtronAdapterHost.ps1` | только в дочернем процессе |
| `src/cli` | Консольные команды | через adapter |

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
- состояния и ресурсы.

Обе команды читают и файл после Save and Build. Открытие в GUI Designer они не проверяют.

## Пересобрать контейнер

```powershell
& $dotnet run --project src/cli --no-build -- repack samples/original/Full-Test-Project.gdl output/repacked-new.gdl
```

Каталог назначения должен существовать. Команда создаёт только новый файл и отказывается перезаписывать существующий. NRBF payload остаётся побайтово неизменным, остальные записи контейнера копируются побайтно. Сжатие и размер контейнера могут отличаться. Это проверка упаковки, а не запись нового графа объектов.

Выходные коды всех команд: 0 — успешно, 1 — отказ (ошибка файла, формата, записи, описания или адаптера), 2 — неверные аргументы.

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

Поддержано: button, label, level (gauge или slider) и PNG-ресурсы на одной странице. Описание `exui-screen-experiment/0` — не окончательный контракт `.exui`. GUI-проверка результатов ещё не выполнена; пример и инструкция ручной проверки — в `examples/first-screen/README.md`.

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

Без аргументов выполняются 50 проверок без Extron и без локальных образцов:
- контейнер, включая многозаписный;
- редактор подписи;
- описание экрана и его ошибки;
- граница адаптера.

Дополнительные аргументы:
- первый позиционный — 10 проверок реального Full-Test-Project;
- второй — проверка каждого GLT в каталоге;
- `--built <файл>` — файл после ручного Save and Build;
- `--registry samples/donors.json` — доноры и отказы реестра;
- `--integration` — реальная генерация обеих панелей через GUI Designer, детерминированность, сохранность ID, отказы хоста и неизменность исходников.

Полный прогон: 122 passed, 0 failed (`verification/results/2026-10-19-first-screen-tests.txt`). Набор возвращает ненулевой код при ошибке.

Исходный GDL скопирован из родительской папки; SHA-256 указан в `samples/manifest.json`. Доноры закреплены SHA-256 в `samples/donors.json`. Крупные сторонние образцы, доноры и сгенерированные проекты исключены из Git. При переносе репозитория образцы нужно предоставить отдельно и сверить с манифестом; доноры воспроизводятся командой `prepare-donor`.

## Граница поддержки

Поддерживается только обнаруженный профиль KP-контейнера:
- от 1 до 16 записей, первая — `ProjectGCP`; остальные, например `<проект>.tgz4` после Save and Build, сохраняются как есть;
- stored или DEFLATE;
- без шифрования, data descriptors, ZIP64 и нескольких дисков;
- записи идут подряд с начала файла, без промежутков.

Ограничения размера: контейнер 64 MiB, все распакованные записи 128 MiB. Для каждой записи проверяются центральный каталог, соответствие локального заголовка, имя, длины и CRC32. Глобальная замена байтов KP/PK не используется.

Доноры генерации должны быть несобранными однозаписными проектами. Исходные проекты пользователя и установленные шаблоны не изменяются.

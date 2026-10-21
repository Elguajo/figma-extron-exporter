# Figma → Extron CLI 0.2.1 — Windows

Готовая Release-сборка CLI для плагина 0.2.1 и пакетов exui/1–5. Исходники, Node и .NET SDK для запуска не нужны. Требуется **.NET 10 Runtime x64**; конвертация дополнительно требует установленный **GUI Designer 1.28.0.7** и закреплённые доноры. DLL Extron в комплект не входят.

## Быстрый запуск

Распаковать архив в постоянную папку. В PowerShell перейти в неё:

```powershell
.\ExtronExporter.ps1 validate-package .\examples\home-1025m\home.exui
.\ExtronExporter.ps1 id-map .\examples\home-1025m\home.exui
New-Item -ItemType Directory -Force .\converted | Out-Null
.\ExtronExporter.ps1 convert-package .\examples\home-1025m\home.exui .\converted\home.gdl
```

Каждый результат требует нового имени: существующие GDL и report не заменяются. Открыть копию GDL в GUI Designer, проверить вид и ID, выполнить Verify → Save and Build → закрыть и открыть снова. Build выполняется в GUI Designer. Повторная конвертация не сохраняет ручные правки прежнего GDL.

Лаунчер сам выбирает `samples/donors.json` рядом с собой, даже при запуске из другой папки. Пути входного пакета и результата остаются относительно текущей папки. Свой реестр передаётся через `--registry`, установленный в другом месте GUI Designer — через `--extron-dir`. Для отдельного .NET можно задать `$env:EXUI_DOTNET_EXE = 'полный путь к dotnet.exe'`. Без лаунчера: `dotnet .\cli\Extron.Cli.dll ...`; для конвертации тогда указать `--registry` явно или работать из папки комплекта.

## Доноры и локальный полный комплект

Обычный архив CLI содержит реестр и пример, но не сторонние GDL. Скопировать **проверенные** `samples/donors/tlp-pro-1025m.gdl` и `tlp-pro-300m-portrait.gdl` из основной рабочей папки в одноимённую папку распакованного комплекта. SHA-256 проверяется CLI перед использованием. Либо отдельно предоставить исходный `Full-Test-Project.gdl` в `samples/original/` и выполнить `prepare-donor tlp-pro-1025m` и `prepare-donor tlp-pro-300m-portrait`; произвольный проект исходник не заменяет.

Архив `figma-extron-complete-0.2.1-local.zip` уже содержит оба закреплённых донора, плагин в `figma-plugin/` и ранее проверенный `examples/home-1025m/home-gui-built.gdl`. Это локальный рабочий комплект с пользовательскими/сторонними ресурсами; он хранится в игнорируемой папке `output/`.

В Figma Desktop импортировать `figma-plugin/manifest.json`; заголовок плагина должен показывать **0.2.1**. Plugin ID сохранён. В документе «2026-10 - Trilliant» выбрать подготовленный **HomeLayoutReady**, проверить экран и скачать новый `.exui`. Пример `home.exui` позволяет проверить CLI без доступа к Figma; он не является редактируемым Figma-файлом. Стандарт подготовки находится в папке плагина.

## Home и границы проверки

Пример 1025M: 1280×800, 47 элементов, 15 PNG. Кнопки с пустыми подписями имеют отдельные нативные Label/Value; ID кнопок и громкости 8101–8115, статусов зон — 8116/8117. Value = 42%, Thumb = 28×28, диапазон = 0..100. Карта ID лежит рядом с примером.

Исходный Home прошёл настоящий Figma/GUI-цикл 21.10.2026: конвертация 432/432, Verify 0/0, Build и reopen, независимое чтение 426/426. Эти результаты относятся к тому прогону; новый результат конвертации ещё требует собственного GUI-цикла. Касания под отдельными подписями, удержания и работа на панели не проверены. Команды, переходы, начальные значения, синхронизацию Slider/Value и Mute feedback задаёт программа Extron. Цвет отдельных подписей не меняется со состояниями кнопки автоматически.

Последующая проверка установленного 0.2.1 также завершена: настоящий Figma → CLI 432/432 → новый GUI Verify 0/0 → Save and Build / Keep → Close/reopen → независимое чтение 426/426. Актуальный локальный результат — `output/releases/0.2.1/reexport/home-021-gui.gdl`; [протокол](../../../verification/results/2026-10-21-release-0.2.1.md). Исходные архивы не заменялись, новый GUI-результат лежит отдельно.

## Воспроизводимая упаковка из репозитория

После `npm ci --prefix src/figma-plugin --ignore-scripts` и locked restore решения:

```powershell
.\scripts\Package-Release.ps1 -DotnetExe .\.tools\dotnet\dotnet.exe
# Полный локальный комплект, включая уже имеющиеся проверенные доноры:
.\scripts\Package-Release.ps1 -DotnetExe .\.tools\dotnet\dotnet.exe -IncludeLocalSamples -OutputDirectory .\output\releases\0.2.1-local
```

Упаковка отказывается заменять существующие архивы. Архив CLI включает лицензию и notices System.Formats.Nrbf 10.0.11; архив плагина — свои notices и лицензии зависимостей. Пакетирование не выполняет автоматическую проверку оборудования или Build в GUI Designer.

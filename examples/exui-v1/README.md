# Минимальные пакеты `.exui/1`

Два пакета подготовлены вручную из `examples/first-screen`: те же страница, семантические ключи, objectId/controlId, тексты, ресурсы и геометрия. Изменены только внешняя структура, маркер схемы и явные stateId. Исходные экспериментальные примеры сохранены.

| Пакет | Редактируемый исходник | Профиль |
|---|---|---|
| `first-screen-1025m.exui` | `1025m/manifest.json`, `1025m/screen.json`, `1025m/assets/` | 1280×800, TLP Pro 1025M |
| `first-screen-300m.exui` | `300m/manifest.json`, `300m/screen.json`, `300m/assets/` | 320×480, TLP Pro 300M портрет |

[Контракт и ограничения](../../docs/exui-v1.md). Растровые иконки собственные, скопированы из first-screen; чужих ресурсов и DLL в пакетах нет.

## Воспроизведение из корня репозитория

```powershell
$dotnet = './.tools/dotnet/dotnet.exe'
& $dotnet restore ExtronExporter.slnx --locked-mode
& $dotnet build ExtronExporter.slnx --no-restore
& ./examples/exui-v1/New-ExamplePackages.ps1 -OutputDirectory output/exui-v1/packages-new
& $dotnet run --project src/cli --no-build -- validate-package examples/exui-v1/first-screen-1025m.exui
& $dotnet run --project src/cli --no-build -- validate-package examples/exui-v1/first-screen-300m.exui
```

Проверить равенство SHA-256 упакованных файлов в `output/exui-v1/packages-new` и сохранённых примеров. Метаданные ZIP фиксированы; побайтовая упаковка воспроизводится на том же .NET runtime, на другом ZIP writer достаточно одинаковых распакованных данных. Скрипт работает в Windows PowerShell 5.1 и PowerShell 7, не перезаписывает файлы. В ZIP нет отдельной записи директории.

Для генерации нужны GUI Designer 1.28.0.7 и локальные закреплённые доноры (см. корневой README). Если их нет, выполнить `prepare-donor` по одному разу, не перезаписывая существующие:

```powershell
& $dotnet run --project src/cli --no-build -- prepare-donor tlp-pro-1025m
& $dotnet run --project src/cli --no-build -- prepare-donor tlp-pro-300m-portrait
New-Item -ItemType Directory -Force output/exui-v1 | Out-Null
& $dotnet run --project src/cli --no-build -- convert-package examples/exui-v1/first-screen-1025m.exui output/exui-v1/new-1025m.gdl
& $dotnet run --project src/cli --no-build -- convert-package examples/exui-v1/first-screen-300m.exui output/exui-v1/new-300m.gdl
& $dotnet run --project tests/format --no-build
& $dotnet run --project tests/format --no-build -- --registry samples/donors.json --integration
```

Выходные файлы должны быть новыми. Рядом с GDL будет JSON report. Тесты подтверждают идентичность GDL с генерацией экспериментального описания, повторяемость и независимые проверки, отказы и неизменность доноров/исходников. Интеграционные тесты запускают только локальный адаптер записи, GUI и Build не вызываются.

## Уровни проверки

Для нового результата выполнить ручную проверку на копии по [инструкции first-screen](../first-screen/README.md#ручная-проверка-в-gui-designer): открыть, проверить профиль, ключевые элементы, состояния и кириллицу, отредактировать, выполнить Verify и записать фактические counts, затем Save and Build, закрыть и открыть снова. Build выполняет только пользователь. Не заменять существующие ручные результаты `output/first-screen`.

Новые файлы из пакетов прошли автоматическую проверку; отдельного ручного GUI-цикла для них пока нет. Эквивалентные экраны этапа 4 уже проверены пользователем в GUI Designer; Verify был выполнен, числовые результаты не переданы. Работа на устройстве не проверена. Повторная генерация не сохраняет ручные правки GDL.

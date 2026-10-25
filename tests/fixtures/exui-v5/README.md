# Примеры exui/5

Собственные подготовленные макеты, полученные из Figma API fixture плагином 0.2.0. Настоящий Figma API и PNG-render в этих сценариях моделируются; CLI, x86 writer и независимое NRBF-чтение настоящие. Примеры без PNG и сторонних ресурсов. Донорские GDL в Git не входят.

| Пакет | Состав | Нативная проверка |
|---|---|---|
| [expanded-1025m.exui](expanded-1025m.exui) | 9 элементов: Slider, Value, Shape, Line, DateTime, Gauge, VolumeLED, Multistate Level, Button с 4 состояниями | 101/101 |
| [expanded-300m.exui](expanded-300m.exui) | Тот же набор для 300M | 101/101 |
| [project-1025m.exui](project-1025m.exui) | 2 страницы, 4 авторских popup, группа и 2 popup reference | 200/200 |
| [project-300m.exui](project-300m.exui) | Тот же проект для 300M | 200/200 |

В GDL остаётся также служебный Offline popup донора. Исходные manifest/screen лежат в одноимённых каталогах. Рядом с пакетами - карты ID. Переход кнопки на Settings, выбор источника и начальные доступность/видимость - указания программе управления, не исполняемые GDL действия.

```powershell
& ./.tools/dotnet/dotnet.exe src/cli/bin/Debug/net10.0/Extron.Cli.dll validate-package tests/fixtures/exui-v5/project-1025m.exui
& ./.tools/dotnet/dotnet.exe src/cli/bin/Debug/net10.0/Extron.Cli.dll id-map tests/fixtures/exui-v5/project-1025m.exui
& ./.tools/dotnet/dotnet.exe src/cli/bin/Debug/net10.0/Extron.Cli.dll convert-package tests/fixtures/exui-v5/project-1025m.exui output/new-v5-project.gdl
```

Нужны собранный текущий CLI, GUI Designer 1.28.0.7 и закреплённые доноры samples/donors.json. Выходной путь должен быть новым. При другом SDK использовать установленный dotnet вместо локального пути.

Дополнительный автоматический сценарий проверяет вертикальный Slider 10..255, эллипс с обводкой и вертикальную Line. [Протокол](../../../docs/verification/results/2026-10-20-expanded-controls.md). Настоящий Figma, открытие/Build новых файлов в GUI Designer и оборудование не проверены.

<a id="russian"></a>

# Настройка конвертера EXUI → GDL

**Русский** · [English](#english)

Эта подготовка нужна один раз на компьютере, где вы создаёте GDL. Подготовка своего дизайна и экспорт из Figma описаны в [быстром старте](../README.ru.md#быстрый-старт).

## Установка

1. Скачайте совместимый с плагином архив `figma-extron-cli-<версия>-windows.zip` из выбранного [выпуска](https://github.com/Elguajo/figma-extron-exporter/releases).
2. Распакуйте его в отдельную постоянную папку. В её корне должен быть `ExtronExporter.ps1`, рядом — папки `cli`, `samples` и `examples`.
3. Установите [.NET 10 Runtime x64](https://dotnet.microsoft.com/download/dotnet/10.0). Для запуска готового CLI SDK не нужен.
4. Для создания GDL установите **Extron GUI Designer 1.28.0.7** и подготовьте необходимые файлы ниже. DLL Extron загружаются из установленного GUI Designer; в архив CLI они не включены.

## Необходимые файлы Extron

Конвертер создаёт объекты из эталонного проекта **GDL-донора**. Он задаёт внутреннюю структуру объектов Extron; оформление и расположение элементов берутся из вашего EXUI. Конвертация собственного дизайна всё равно требует этого технического файла.

Доноры **не входят в публичный архив**. Если у вас уже есть проверенный донор, поместите файл нужной панели в папку CLI:

| Панель | Путь относительно папки CLI |
|---|---|
| TLP Pro 1025M | `samples/donors/tlp-pro-1025m.gdl` |
| TLP Pro 300M, портрет | `samples/donors/tlp-pro-300m-portrait.gdl` |

Если готового донора нет, но есть исходный **`Full-Test-Project.gdl`**, соответствующий [реестру](../samples/donors.json), поместите его в `samples/original/`. Откройте эту папку CLI в Проводнике, в адресной строке введите `powershell` и нажмите Enter. Выполните **одну** команду для своей панели:

```powershell
.\ExtronExporter.ps1 prepare-donor tlp-pro-1025m
```

Для TLP Pro 300M:

```powershell
.\ExtronExporter.ps1 prepare-donor tlp-pro-300m-portrait
```

CLI сверяет SHA-256 исходного и подготовленного GDL с `samples/donors.json`. Произвольный файл, созданный в GUI Designer, не заменяет закреплённый донор. Если ни одного из этих файлов у вас нет, подготовка конвертации пока не завершена: проверка EXUI, карта ID и сравнение пакетов доступны, а создание GDL потребует подходящего донора. Общедоступная ссылка на его получение в проекте не предоставлена.

Для другого расположения GUI Designer используйте `--extron-dir <папка>`, для собственного реестра — `--registry <donors.json>`. [Все команды и опции](development.md#команды-cli).

## Необязательная проверка на комплектном примере

В новой локальной сборке доступна [конвертация без команд PowerShell](exui-desktop-converter.md): `Convert-EXUI.cmd` открывает окно выбора EXUI, а кнопка регистрации позволяет затем открывать `.exui` двойным щелчком. Требования к GUI Designer и донорам остаются теми же.

Этот шаг проверяет установленный CLI и не требует макета Figma, GUI Designer или донора. В PowerShell из папки CLI выполните:

```powershell
.\ExtronExporter.ps1 validate-package .\examples\home-1025m\home.exui
```

Ожидается JSON: `contract: "exui/5"`, профиль **TLP Pro 1025M**, **47 элементов**, **15 ресурсов**.

При настроенных GUI Designer и доноре можно также создать GDL примера:

```powershell
.\ExtronExporter.ps1 convert-package .\examples\home-1025m\home.exui .\home.gdl
```

Появятся `home.gdl` и `home.gdl.report.json`. Проверьте результат в GUI Designer: **Verify → Save and Build → закрыть и открыть снова**.

[Вернуться к конвертации своего дизайна](../README.ru.md#4-преобразуйте-свой-exui-в-gdl)

---

<a id="english"></a>

# EXUI → GDL converter setup

[Русский](#russian) · **English**

You do this once on the computer where you create GDL files. Preparing your design and exporting from Figma are covered in the [quick start](../README.md#quick-start).

## Installation

1. Download the `figma-extron-cli-<version>-windows.zip` archive that matches your plugin from the chosen [release](https://github.com/Elguajo/figma-extron-exporter/releases).
2. Unpack it into its own permanent folder. Its root must contain `ExtronExporter.ps1`, next to the `cli`, `samples` and `examples` folders.
3. Install the [.NET 10 Runtime x64](https://dotnet.microsoft.com/download/dotnet/10.0). The ready-made CLI does not need the SDK.
4. To create GDL files, install **Extron GUI Designer 1.28.0.7** and prepare the required files below. The Extron DLLs are loaded from the installed GUI Designer; they are not included in the CLI archive.

## Required Extron files

The converter creates objects from a reference project, the **donor GDL**. It provides the internal structure of Extron objects; the artwork and positions of elements come from your EXUI. Converting your own design still needs this technical file.

Donors are **not part of the public archive**. If you already have a verified donor, put the file for your panel into the CLI folder:

| Panel | Path relative to the CLI folder |
|---|---|
| TLP Pro 1025M | `samples/donors/tlp-pro-1025m.gdl` |
| TLP Pro 300M, portrait | `samples/donors/tlp-pro-300m-portrait.gdl` |

If you have no ready donor but have the source **`Full-Test-Project.gdl`** that matches the [registry](../samples/donors.json), put it into `samples/original/`. Open this CLI folder in File Explorer, type `powershell` in the address bar and press Enter. Run **one** command for your panel:

```powershell
.\ExtronExporter.ps1 prepare-donor tlp-pro-1025m
```

For TLP Pro 300M:

```powershell
.\ExtronExporter.ps1 prepare-donor tlp-pro-300m-portrait
```

The CLI checks the SHA-256 of the source and of the prepared GDL against `samples/donors.json`. An arbitrary file created in GUI Designer does not replace a pinned donor. If you have neither of these files, the converter setup is not finished yet: EXUI validation, the ID map and package comparison work, but creating a GDL needs a suitable donor. The project does not provide a public link to obtain one.

For another GUI Designer location use `--extron-dir <folder>`, for your own registry `--registry <donors.json>`. [All commands and options](development.md#cli-commands).

## Optional check with the bundled example

The new local build includes a desktop conversion mode: open `Convert-EXUI.cmd`, select an EXUI, or register the application using its association button to open EXUI files by double-click. It creates a new GDL beside the input and opens GUI Designer. Existing outputs are preserved. The same GUI Designer and donor setup is required; this mode also requires .NET Desktop Runtime 10 x64. Earlier published archives are unchanged.

This step checks the installed CLI and does not need a Figma layout, GUI Designer or a donor. In PowerShell in the CLI folder, run:

```powershell
.\ExtronExporter.ps1 validate-package .\examples\home-1025m\home.exui
```

Expected JSON: `contract: "exui/5"`, profile **TLP Pro 1025M**, **47 elements**, **15 resources**.

With GUI Designer and a donor set up, you can also create the example GDL:

```powershell
.\ExtronExporter.ps1 convert-package .\examples\home-1025m\home.exui .\home.gdl
```

`home.gdl` and `home.gdl.report.json` appear. Check the result in GUI Designer: **Verify → Save and Build → close and open again**.

[Back to converting your design](../README.md#4-convert-your-exui-to-gdl)

<h1 align="center">Figma → Extron Exporter</h1>

<p align="center">
  <strong>От макета сенсорной панели — к редактируемому проекту Extron.</strong><br>
  Нативные кнопки, слайдеры и подписи. Постоянные ID между экспортами.
</p>

<p align="center">
  <a href="CHANGELOG.md"><img src="https://img.shields.io/badge/preview-0.7.3-0066CC?style=flat-square" alt="Исходники: 0.7.3 preview"></a>
  <a href="docs/exui-v5.md"><img src="https://img.shields.io/badge/contract-EXUI%2F5-555555?style=flat-square" alt="Контракт пакета: EXUI/5"></a>
  <a href="#совместимость"><img src="https://img.shields.io/badge/CLI-Windows-555555?style=flat-square" alt="CLI для Windows"></a>
</p>

<p align="center">
  <a href="https://github.com/Elguajo/figma-extron-exporter/releases"><strong>Скачать preview</strong></a> ·
  <a href="#быстрый-старт">Быстрый старт</a> ·
  <a href="#документация">Документация</a> ·
  <a href="docs/development.md">Разработка</a>
</p>

![Макет Extron Kit для TLP Pro 1025M: выбор источника и зоны, Mute, слайдер и значение громкости](docs/assets/readme/extron-kit-1025m.png)

<p align="center"><sub>Макет из Extron Kit · TLP Pro 1025M · локальная ревизия Apple-inspired Light от 24.10.2026</sub></p>

---

## Как это работает

Подготовьте экран в Figma, выгрузите пакет `.exui` и преобразуйте его локальным CLI в `.gdl`. Результат открывается в **Extron GUI Designer**: контролы, состояния и поддержанный текст можно редактировать дальше.

```text
Figma  →  плагин  →  .exui  →  CLI  →  .gdl  →  GUI Designer
                                               Verify → Save and Build
```

| В Figma | В проекте Extron |
|---|---|
| Экран, страницы и popup | Страницы, popup и связи между ними |
| Кнопки и их состояния | Нативные контролы с отдельным оформлением состояний |
| Слайдеры, значения и подписи | Редактируемые элементы; текст — в пределах [контракта шрифтов](src/figma-plugin/NATIVE_TEXT.md) |
| Иконки и сложная графика | Ресурсы PNG |
| Сохранённые назначения | Постоянные ID и карта элементов для программиста |

Макет готовится по правилам имён и структуры. Команды оборудования, переходы и feedback подключает программа управления Extron.

<details>
<summary><strong>Посмотреть результат реального экспорта в GUI Designer</strong></summary>

![Экран Home с выбором источников и громкостью открыт в GUI Designer после сохранения, сборки и повторного открытия](verification/results/2026-10-21-home-layout-1025m/gui-home-reopened.jpg)

Проверка **21.10.2026**, TLP Pro 1025M: 47 элементов, 15 PNG, **Verify: 0 ошибок / 0 предупреждений**, Save and Build и повторное открытие. Это отдельный рабочий макет; [протокол и границы проверки](verification/results/2026-10-21-home-layout-1025m.md).

</details>

## Совместимость

| Компонент | Поддержанная среда |
|---|---|
| Панели | **TLP Pro 1025M** — 1280 × 800; **TLP Pro 300M** — портрет 320 × 480 |
| Подготовка макета | **Figma Desktop**, локальный плагин |
| Проверка EXUI и карта ID | **Windows**, [.NET 10 Runtime x64](https://dotnet.microsoft.com/download/dotnet/10.0) |
| Создание GDL | Дополнительно **GUI Designer 1.28.0.7** и [проверенный донор](#доноры-для-конвертации) |
| Текущие исходники | Плагин **0.7.3** + CLI **0.7.3**, контракт **EXUI/5**, preview |

**Скачать:** откройте [GitHub Releases](https://github.com/Elguajo/figma-extron-exporter/releases) и возьмите архив плагина и совместимый CLI из одного выпуска. На 24.10.2026 опубликован комплект **0.7.2**; архивы **0.7.3** собраны локально. Актуальные исходники можно [собрать самостоятельно](#сборка-и-проверки).

## Быстрый старт

### 1. Установите CLI

Распакуйте `figma-extron-cli-<версия>-windows.zip` в постоянную папку. Откройте в ней PowerShell. Все команды ниже выполняются из этой папки.

### 2. Проверьте готовый пример

Figma, GUI Designer и донор для этого шага не нужны:

```powershell
.\ExtronExporter.ps1 validate-package .\examples\home-1025m\home.exui
```

Ожидается JSON: **`contract: "exui/5"`**, профиль **TLP Pro 1025M**, **47 элементов**, **15 ресурсов**.

### 3. Получите проект Extron

Установите GUI Designer и [подготовьте донор](#доноры-для-конвертации), затем выполните:

```powershell
.\ExtronExporter.ps1 convert-package .\examples\home-1025m\home.exui .\home.gdl
```

Появятся **`home.gdl`** и **`home.gdl.report.json`**. Откройте GDL в GUI Designer → **Verify → Save and Build** → закройте и откройте снова.

<a id="доноры-для-конвертации"></a>

<details>
<summary><strong>Доноры для конвертации</strong></summary>

Донор — эталонный GDL, из которого CLI клонирует объекты Extron. Доноры и DLL Extron в публичный архив не входят.

Поместите проверенный файл для нужной панели в папку CLI:

| Панель | Файл |
|---|---|
| TLP Pro 1025M | `samples/donors/tlp-pro-1025m.gdl` |
| TLP Pro 300M | `samples/donors/tlp-pro-300m-portrait.gdl` |

Если готового донора нет, но есть исходный **`Full-Test-Project.gdl`** из [реестра](samples/donors.json), положите его в `samples/original/` и выполните команду для своей панели:

```powershell
.\ExtronExporter.ps1 prepare-donor tlp-pro-1025m
.\ExtronExporter.ps1 prepare-donor tlp-pro-300m-portrait
```

CLI сверяет SHA-256 с `samples/donors.json`: произвольный GDL не подойдёт. Без подходящего донора доступны проверка EXUI, карта ID и сравнение пакетов; создание GDL требует донора.

</details>

## Экспорт своего макета

### Установите плагин

Распакуйте `figma-extron-plugin-<версия>.zip` в постоянную папку. В Figma Desktop откройте **Plugins → Development → Import plugin from manifest…** и выберите `manifest.json`. Версия в заголовке должна соответствовать выбранному выпуску.

> [!IMPORTANT]
> Сохраняйте `id` в `manifest.json` при обновлении: назначения элементов в Figma привязаны к ID плагина.

### Подготовьте экран

Начать можно с **«Библиотека компонентов» → «Создать Extron Kit»** или собственного Frame размером с панель. Минимальная структура:

```text
screen_Home                     Frame: 1280 × 800 или 320 × 480
├── button_Mute                 Group / Frame кнопки
│   ├── Off                     состояние «выключено»
│   └── On                      состояние «включено»
├── slider_Volume               Track + Fill + Thumb
├── value_Volume                обновляемая подпись
└── text_Title                  статичная подпись
```

Имена слоёв — латиница, цифры, точки и дефисы, без пробелов; видимый текст может быть русским. Для кнопок удержания используйте **Normal / Pressed**, для кнопок с отдельным видом выбора и нажатия — **`feedbackbutton_`** и **Normal / Active / Pressed**.

Выберите экран или секцию проекта, укажите профиль панели → **«Проверить макет» → «Скачать .exui»**. ID назначаются автоматически и сохраняются между экспортами. При ошибке отчёт укажет причину, а **«Показать слой»** найдёт элемент на холсте.

[Все префиксы](src/figma-plugin/PREFIXES.md) · [Правила макета](src/figma-plugin/AUTHORING_STANDARD.md) · [Состояния и оформление кнопок](src/figma-plugin/BUTTON_STATES.md)

### Передайте результат программисту

Из папки CLI проверьте свой пакет, сформируйте карту ID и новый GDL:

```powershell
.\ExtronExporter.ps1 validate-package C:\Design\interface.exui
.\ExtronExporter.ps1 id-map C:\Design\interface.exui | Out-File -Encoding utf8 id-map.md
.\ExtronExporter.ps1 convert-package C:\Design\interface.exui .\interface-v1.gdl
```

| Файл | Назначение |
|---|---|
| `interface-v1.gdl` | Редактируемый проект GUI Designer |
| `interface-v1.gdl.report.json` | Отчёт независимой проверки результата |
| `id-map.md` | Страницы, popup, ID и состояния для подключения логики управления |

Каждый новый GDL пройдите через **Verify → Save and Build → повторное открытие**.

## Extron Kit

Готовые компоненты, состояния кнопок, шаблоны страниц и popup, примеры для обеих панелей. Оформление можно менять в Figma, сохраняя служебные имена и структуру.

<img src="docs/assets/readme/extron-kit-300m.png" width="240" alt="Портретный макет Extron Kit для TLP Pro 300M: источник Music, Mute и управление громкостью">

**Apple-inspired Light · 24.10.2026** — локальная ревизия библиотеки в текущих исходниках; опубликованный архив 0.7.2 и локальные архивы 0.7.3 предшествуют этому обновлению. Новый комплект создаётся рядом с существующим; готовые библиотеки автоматически не обновляются.

[Работа с Extron Kit](src/figma-plugin/EXTRON_KIT.md) · [Исходники и превью](design/extron-kit/README.md)

## Повторный экспорт

Сохраните рабочий EXUI перед изменениями. Чтобы увидеть новые и удалённые элементы, изменения ID, типов, состояний и связей:

```powershell
.\ExtronExporter.ps1 compare-packages .\interface-v1.exui .\interface-v2.exui
```

**Каждая конвертация создаёт новый GDL.** Существующий файл не перезаписывается, а ручные правки прежнего GDL в новый не переносятся. Дизайн меняйте в Figma.

Для проекта с настроенной логикой GCP используйте отдельный процесс: сравнение пакетов → копия проекта → **Layout Reconciliation**. Для тестовой пары 1025M подтверждены сохранение действия/feedback и повторное открытие; [инструкция и границы проверки](docs/updating-configured-projects.md).

## Если что-то пошло не так

| Сообщение | Что делать |
|---|---|
| `donor-missing` / `donor-hash` | Проверить наличие и контрольную сумму [донора](#доноры-для-конвертации) |
| `extron-version` | Нужен GUI Designer 1.28.0.7; другой путь установки задаётся через `--extron-dir <папка>` |
| `output-exists` | Указать новое имя выходного GDL |
| Пакет EXUI/1–4 отклонён | Повторно экспортировать макет текущим плагином; сохранённые назначения и ID используются снова |
| Ошибка имени или структуры слоя | Исправить указанный слой через отчёт плагина и повторить проверку |

Коды выхода CLI: **0** — успех, **1** — ошибка обработки, **2** — неверные аргументы. [Все команды и опции](docs/development.md#команды-cli).

## Документация

| Задача | Руководство |
|---|---|
| Подготовить макет | [Стандарт авторинга](src/figma-plugin/AUTHORING_STANDARD.md) |
| Назвать элементы | [Справочник префиксов](src/figma-plugin/PREFIXES.md) · [PDF-шпаргалка](docs/prefix_map/figma-extron-prefix-cheatsheet.pdf) |
| Оформить кнопки и состояния | [Button States](src/figma-plugin/BUTTON_STATES.md) |
| Сохранить редактируемый текст | [Шрифты и нативный текст](src/figma-plugin/NATIVE_TEXT.md) |
| Использовать библиотеку | [Extron Kit](src/figma-plugin/EXTRON_KIT.md) |
| Обновить настроенный GCP | [Обновление проектов](docs/updating-configured-projects.md) |
| Разобраться в формате и архитектуре | [EXUI/5](docs/exui-v5.md) · [Формат GDL](docs/extron-format.md) · [Решения](docs/decisions.md) |
| Проверить результат | [Чек-лист](verification/checklist.md) · [Проверки 0.7.3](verification/results/2026-10-23-release-0.7.3.md) |
| Посмотреть изменения и планы | [CHANGELOG](CHANGELOG.md) · [ROADMAP](ROADMAP.md) |

## Сборка и проверки

Для разработки нужны **.NET SDK 10.0.402** и **Node.js ≥ 22.18**. Из корня репозитория:

```powershell
dotnet build ExtronExporter.slnx
npm ci --prefix src/figma-plugin --ignore-scripts
npm run verify --prefix src/figma-plugin
```

`verify` проверяет типы, запускает тесты плагина и собирает `src/figma-plugin/dist/`. Импортируйте `src/figma-plugin/manifest.json` в Figma Desktop.

[Архитектура, тесты .NET, команды CLI и выпуск](docs/development.md)

## Статус проекта

**Preview.** Подтверждён реальный цикл Figma → EXUI → GDL → GUI Designer Verify → Save and Build → повторное открытие для [Home 1025M](verification/results/2026-10-21-home-layout-1025m.md). Для обеих панелей есть автоматические сценарии; [выпуск 0.7.3](verification/results/2026-10-23-release-0.7.3.md) проверен из итоговых архивов с реальной конвертацией и независимым чтением GDL. Новый ручной Desktop-прогон для этого выпуска не выполнялся.

Работа на физической панели, касания, удержания и аппаратный feedback пока не проверены. Каждый новый проект требует своей проверки в GUI Designer и на оборудовании.

Оформление и части экспорта плагина адаптированы из **Baolv/figma-export** по разрешению; сведения о происхождении кода и лицензиях зависимостей — в [THIRD_PARTY_NOTICES.md](src/figma-plugin/THIRD_PARTY_NOTICES.md).

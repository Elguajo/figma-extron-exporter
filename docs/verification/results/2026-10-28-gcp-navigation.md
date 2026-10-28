# Назначения переходов — GCP, структура интерфейса — GUI Designer

Локальное обновление 28.10.2026, development build 0.8.7. Работа выполнена в основной папке репозитория, в `main`; существовавшие изменения сохранены.

## Изменение

Удалены поле цели перехода у Button, режим показа «По кнопке», списки целей и добавление экранов через эти списки, проверки достижимости и обновление ключей переходов. Новые EXUI не содержат `navigate`. Переходы между страницами и открытие/закрытие popup настраиваются в GCP.

`popupref_`, `popupgroup_` и `popup_` сохранены: это размещение и состав интерфейса, а не действия кнопок. Ссылка внутри страницы задаёт место popup или группы, включая координаты и размер; определения содержимого могут использоваться через ссылки на нескольких страницах. Группа не обязательна для единственного popup: возможна прямая ссылка на обычный popup вне группы.

Стартовая страница сохранена. Установленная справка Extron GUI Designer, `Help/Content/HTML_Files/Project_Menu/Project_Properties.htm`, раздел Design → Default Page, определяет её как первую страницу, открываемую на панели. Путь в GUI: **Project → Properties → Design → Default Page → Page**. Конвертер записывает выбранный ID в `PBProject.defaultPageField` (`src/adapter/host/ExtronAdapterHost.ps1`), поэтому настройка не сводится к порядку страниц. Показ страниц по событиям и кнопкам остаётся в GCP.

## Совместимость

При чтении сохранённых назначений Figma `navigate` игнорируется, `shownBy: navigation` читается как `program`. Чтение не переписывает исходные записи; ключи, objectId, controlId и состояния не меняются. Явное сохранение и подготовка копий могут опустить устаревшие поля. Повторный экспорт стабилен; при ошибке записи восстанавливаются исходные записи. Отдельный экспорт прежней дополнительной страницы больше не требует контекста перехода.

CLI и схемы EXUI/5 не менялись: старые пакеты с переходами по-прежнему читаются. Поддержка старого формата оставлена на границе CLI; в новом коде плагина осталось только совместимое чтение прежних назначений.

## Проверки

| ID | Проверка | Статус | Источник |
| --- | --- | --- | --- |
| baseline | Проверка типов, прежние unit-тесты, сборка до изменения | passed, 730/730 | `output/navigation-baseline.log` |
| plugin | Проверка типов plugin/UI, unit-тесты и сборка после изменения | passed, 729/729 | `output/navigation-verify.log` |
| legacy | Три версии metadata; неизвестные/удалённые/собственные цели; обе панели; стабильность ID и состояний; повторный экспорт, standalone, popup и откат записи | passed, 13 тестов | `src/figma-plugin/test/navigation-retirement.test.ts` |
| browser | Реальная форма в Chromium, отсутствие полей перехода, сохранение формы без navigation, оба скачивания, popup-настройки, start page, клавиатура, светлая/тёмная тема и ширины 420/320 | passed, pageErrors пуст | `output/navigation-retirement-browser/browser.json`, `gcp-navigation.png` |
| dotnet | .NET-тесты, включая прежние EXUI и указания переходов | passed, 256/256 | `output/navigation-cli-tests.log` |
| build | Сборка решения Release | passed, 0 errors / 0 warnings | `output/navigation-dotnet-build.log` |
| package | Реальный архив, legacy metadata, обе панели × selected-frames/selection | passed, 4 сценария | `output/navigation-retirement-packages/navigation-archive.json` |
| cli | Четыре новых EXUI из архива с `figma.json`, проверены собранным CLI 0.8.7 | passed | `output/navigation-package-validation.log` |
| popup | Оба профиля × оформление popup включено/выключено: настоящий CLI, GDL writer и независимый NRBF reader; 2 страницы, 4 popup и группа | passed, 4 сценария | `output/navigation-retirement-popup-integration/results.json` |
| review | Пути чтения legacy, сохранения, экспорта, состава проекта, стартовой страницы и ссылок popup; сохранение существовавших изменений | passed, значимых дефектов не выявлено | итоговый diff, `git diff --check` |

Сценарии создания переходов заменены проверками экспорта без связей и совместимости с legacy; сокращение числа unit-тестов не связано с пропуском проверок. Первый запуск системного `dotnet` обнаружил отсутствие SDK; проверки выполнены через существующий `.tools/dotnet/dotnet.exe`. Старый Debug CLI отклонил новый `figma.json`; после сборки текущего Release CLI все четыре пакета прошли проверку.

## Результат и границы

SHIP WITH KNOWN RISKS для локального development build. Figma API в автоматических проверках моделируется; Chromium, CLI, Extron writer и независимый reader настоящие. Живой Figma, GUI Designer Verify / Save and Build новых GDL и физическая панель в этой задаче не проверялись. Пользовательский макет, проекты GUI Designer/GCP и архивы прежних выпусков не изменялись.

Архив: `output/figma-plugin/figma-extron-plugin-0.8.7-gcp-navigation-local.zip`, SHA-256 `3B5F7FB046BC9F6D575DFC164B02867CD7F45BF16F86240D9DFB4FF3A6D8F50C`. Для development-плагина из `src/figma-plugin/manifest.json` достаточно перезапуска после сборки.

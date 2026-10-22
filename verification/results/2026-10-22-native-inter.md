# Нативный редактируемый Inter — плагин и CLI 0.5.0

22.10.2026. Задача пользователя: сохранить Inter текстом, редактируемым в Extron GUI Designer. Работа выполнена на main в основной папке; прежние изменения и архивы сохранены. Состояние: **SHIP WITH KNOWN RISKS — preview**, с оговорками ниже.

## Решение и совместимость

Исследованы установленные GUI Designer 1.28.0.7, PBFont/PBFontResource/PBFontStyle и локальная справка. Реальный API подтвердил чтение неизменённой коллекции Inter 4.1: 16 Windows-семейств, включая Intermediate/Display, с нужными начертаниями. Коллекция содержит 18 начертаний Inter и 18 Inter Display. Источник — [официальный выпуск](https://github.com/rsms/inter/releases/tag/v4.1), SIL OFL. Файл и лицензия включены в src/adapter/fonts/Inter; SHA-256 проверяется C# и x86-хостом.

Плагин передаёт семейство, стиль и размер. CLI сопоставляет Medium/Semi Bold и другие веса Windows-семействам, добавляет коллекцию один раз, задаёт ссылку на ресурс и bold/italic. EXUI не может передать шрифтовый бинарный файл, DLL или путь; граница доверия доноров не расширена. Шрифт не устанавливается в Windows, сеть при конвертации не нужна.

EXUI/5 расширен аддитивно: семейства Inter/Inter Display, optional font.style и textAlign для Label/Value/DateTime. Старые EXUI/5 сохраняют прежние значения по умолчанию и читаются новым CLI. Metadata/1–3, plugin ID и назначения исходных объектов не мигрируют. Для новых полей нужно обновить оба компонента: старый CLI 0.4.0 их отклоняет. Риск совместимости MEDIUM; основной проверяемый инвариант — прежние пакеты и идентичность исходных объектов сохраняются.

Для полного верхнего Text состояния сохранён нативный Button text. Одинаковый непосредственный верхний Inter-Text в отдельной области всех состояний экспортируется одним Label поверх Button; его исходная геометрия сохраняется, из временных PNG-клонов текст исключается. Служебные objectId распределяются детерминированно, не зависят от порядка слоёв, обходят занятые исходные ID и корректно работают у границ 1 / 1000000. Сложные/различающиеся подписи продолжают использовать PNG. Правила: [NATIVE_TEXT.md](../../src/figma-plugin/NATIVE_TEXT.md).

Финальный обзор нашёл две проблемы, исправленные до выпуска: Figma возвращает все оси даже у стандартного variable-начертания; прежняя проверка отклоняла бы штатный Inter. Теперь стандартные оси принимаются, промежуточные значения не подменяются. Основание — [официальный FontName API](https://developers.figma.com/docs/plugins/api/FontName/) и fvar официального InterVariable.ttf (opsz default=14, max=32; wght default=400, 100..900). Также устранён ложный отказ распределения служебных ID у верхней границы диапазона, добавлена проверка перестановки слоёв.

## Автоматические проверки

| id / kind | status | Результат и источник |
|---|---|---|
| plugin / typecheck-unit-build | passed | **253 passed, 0 failed**, typecheck и сборка. Стандартные variable-оси, все 18 стилей обоих семейств, девять выравниваний, Value/DateTime, Button/overlay, сохранность source/metadata, крайние ID, перестановка и неперекрывающая иконка выше подписи. [Лог](../../output/releases/0.5.0/plugin-verify-final.log). |
| schema / compatibility | passed | **60 passed**, независимый jsonschema 4.26.0, прежние примеры и отказы. [Лог](../../output/releases/0.5.0/schema-check.log). |
| dotnet / compile | passed | CLI и тестовый проект собраны, **0 warnings / 0 errors**. [Тестовая сборка](../../output/releases/0.5.0/dotnet-test-build.log), [publish](../../output/releases/0.5.0/packaging-final.log). |
| dotnet / full-unit-execution | unavailable | Windows Application Control блокирует Extron.Format.Tests.dll, 0x800711C7. Запуск пробовали; это не passing/skip. Политика не изменялась, обход не применялся. [Лог](../../output/releases/0.5.0/dotnet-tests-unavailable.log). |
| native-fonts / final-archive-integration | passed | **Финальный ZIP main и упакованный CLI** → EXUI/5 → Extron writer → независимый NRBF-reader. Обе панели: **257/257** на каждой, 24 элемента, 4 PNG только оформления кнопок; Inter не превращён в graphic. Все 18 стандартных variable-начертаний, Inter Display, Button, отдельная подпись, Label, Value и DateTime; встроенный ресурс ровно один, байты совпадают с закреплённым SHA. Проверены отказы unknown family/style, несовместимого bold и недопустимого выравнивания. [Протокол](../../output/releases/0.5.0/final-native-fonts/integration.json). |
| regression / archived-native | passed | **24 сценария** кандидата: прежние схемы кнопок, пустые подписи, Kit/много ресурсов, секция, выбранные экраны, Pen/Line, автоматические назначения/копии/объединение; обе панели. [Протокол](../../output/releases/0.5.0/regression-native-check/archive-smoke.json). После точечных исправлений плагина повторены unit/golden и финальный native-font путь; CLI/host/UI/manifest побайтово совпали с кандидатом. [Сравнение](../../output/releases/0.5.0/runtime-equivalence.json). |
| browser / Chromium | passed | Реальный Chromium: скачивание обеих панелей, формы, восстановление после ошибок, без page errors. UI совпадает с финальным архивом; Figma-host моделируется. [Протокол](../../output/releases/0.5.0/browser/browser.json). |
| review / code-contracts | passed | Обзор producer/schema/normalization/writer/reader/verifier, лицензии, ресурсов, временных клонов, наследования текста, идентичности и областей. Подтверждённые дефекты variable-осей и ID исправлены с регрессиями. |

## Реальный GUI Designer — выполнено

Проверено через computer-use в установленном GUI Designer 1.28.0.7, не через подмену GUI fixture.

**1025M:** открыт контрольный GDL с Regular, Medium, Semi Bold, Bold, Italic и кириллицей. У Label видны Font=Inter, Use Flattened Text=False. Через Properties изменены Text на `Edited Inter — Тест 456` и Font Size с 24 на 26. Изменение видно на холсте. Verify: **0 errors, 0 warnings**. Выполнен Save and Build с Keep ресурсов, проект закрыт и открыт снова: изменённая подпись сохранилась. Независимый reader подтвердил PBLabel, Text, Font=Inter/26, FlattenText=false, Build.StatusValue=0 и встроенный Inter с исходным SHA. В контейнере появился native-verified.tgz4. [Модель после Build](../../output/releases/0.5.0/gui-built-1025m.json).

**300M portrait:** открыт интеграционный GDL с 24 элементами и всеми 18 стилями. На холсте видны нативная подпись Button, отдельный Label над оформлением, Value, DateTime, Inter Display и кириллица. Verify: **0 errors, 0 warnings**. Выполнены Save and Build (Keep ресурсов), закрытие и повторное открытие. Reader подтвердил 24 элемента, встроенные байты Inter, Build.StatusValue=0 и tlp-pro-300m-portrait.tgz4. [Модель после Build](../../output/releases/0.5.0/gui-built-300m.json).

GUI-проверенные проекты находятся в output/font-probe/native-verified.gdl и output/font-probe/native-integration-source/tlp-pro-300m-portrait.gdl. Они не являются исходными файлами пользователя. Проверка Figma API/PNG на стороне producer использует boundary fixtures; живой Figma-документ не экспортировался в этой проверке. На физических панелях тест не выполнен, включая касания через отдельный Label.

## Ограничения и поставка

Нативный Inter требует поддержанного оформления и целой геометрии. Другие семейства, смешанные шрифты, произвольные variable-оси и сложные подписи могут оставаться PNG; Value/DateTime не замораживаются в изображение. Общая подпись Button — отдельный статичный объект и не следует за программным скрытием/feedback автоматически. Метрики встроенного Inter 4.1 и движка GUI Designer могут отличаться от версии/настроек Figma; нужна визуальная проверка компоновки. Полный .NET-набор нужно выполнить в разрешённой среде перед выпуском вне preview.

- [Плагин 0.5.0](../../output/releases/0.5.0/figma-extron-plugin-0.5.0.zip), SHA-256 `98750970E53111932F710569E44671DD24DDABF615C0BD6AF3986EB2345403BB`.
- [CLI 0.5.0](../../output/releases/0.5.0/figma-extron-cli-0.5.0-windows.zip), SHA-256 `4EADCF32311D53869EAA2BB359B06BC77DB237227411399F67ADA9B488A6D831`.
- [Локальный комплект](../../output/releases/0.5.0/figma-extron-complete-0.5.0-local.zip), SHA-256 `9629DBE6A43239582A441CA54E217C67E7C77785ADFCC6B61930B821FCEA7F50`. Включает частные закреплённые доноры; не для публичного распространения.

Development dist уже обновлён. Перезапустить плагин, проверить **0.5.0**, конвертировать **CLI 0.5.0**. Повторный экспорт нужен из исходного Text; прежний PNG не содержит редактируемых символов.

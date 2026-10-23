# Контракт exui/5: расширенные нативные элементы и проект Figma

Текущий комплект: **плагин 0.7.0 + CLI 0.7.0**. Контракт не менялся; CLI 0.7.0 пишет пустой Text у пассивных элементов, плагин 0.7.0 передаёт прозрачный `states[].fill` для кнопок с PNG. Рабочий код поддерживает EXUI/5, включая прежние пакеты. Старые EXUI/1–4 отклоняются; для обновления экспортируйте исходный макет текущим плагином. Сохранённые ключи и ID в Figma не меняются. Прежние схемы и примеры в репозитории оставлены как исследовательские материалы.

## Прозрачность линий (плагин 0.6.7, CLI 0.6.4)

`line.fillColor` принимает `#RRGGBB` или `#AARRGGBB` в обеих формах EXUI/5: одиночный экран и проект со страницами/popup. Плагин перемножает непрозрачность SOLID Stroke и Opacity слоя до округления альфа-канала до 8 бит. У прямоугольных линий вместо Stroke используется Fill. Например, `#D2AE6D` при 10% → `#1AD2AE6D`; при Stroke 10% и Opacity 50% → `#0DD2AE6D`. Полностью прозрачная линия сохраняется вместе с ключом и ID. Результат — PBLine без PNG.

Пакеты с альфа-цветом линии требуют CLI 0.6.4+. Старые EXUI/5 с `#RRGGBB` принимаются без миграции. Остальные ограничения типов не меняются; эта поддержка не включает общую Opacity произвольных групп и других нативных элементов.

## Прозрачные popup и оформление ссылок (CLI 0.6.1)

`popups[].background`, `shape.fillColor`, `shape.native.strokeColor` и `states[].fill` принимают `#RRGGBB` или `#AARRGGBB`. `#00000000` — полностью прозрачный фон. Остальные цвета, включая фон обычной страницы, сохраняют прежний формат `#RRGGBB`. Старый CLI 0.6.0 такие альфа-цвета отклоняет; используйте CLI 0.6.1+ (для `states[].fill` — CLI 0.6.5+). Прежние EXUI/5 принимаются без миграции.

Плагин 0.6.2 по умолчанию игнорирует фон и обводку Frame popup/popupref; радиусы и общую Opacity игнорирует всегда. В metadata Figma используются optional boolean `exportBackground`/`exportStroke` (отсутствие или false — не переносить), только для popup и popup-ref. Идентичность и версия metadata сохраняются. При явном экспорте фона popup writer использует нативный фон; оформление popupref и обводка popup понижаются до обычной пассивной прямоугольной `shape` перед ссылкой/содержимым. Её ключ — `popup-appearance.<containerId>.<objectId>`, ID детерминированно выделяется вне authored/derived ID; controlId=null, radius=0. Дополнительные фигуры учитываются в действующих пределах элементов. Пакет не содержит новых типов или исполняемой логики.

CLI очищает у созданных контейнеров внутреннюю заливку и обводку донора (`borderFillColorField`, `borderColorField`, `borderField`) и сбрасывает `transparencyField` в 0. GUI Designer рисует внутреннюю заливку поверх `backgroundFillColorField` даже без ресурса обводки; поэтому одного прозрачного фона недостаточно. Независимый verifier проверяет оба слоя. Offline popup донора не изменяется.

## Нативный Inter и выравнивание (0.5.0)

`font.family`: Arial, Inter или Inter Display. Для Inter optional `font.style` принимает Thin, Extra Light, Light, Regular, Medium, Semi Bold, Bold, Extra Bold, Black и их курсивы (`Italic` для Regular, иначе суффикс ` Italic`). Без style используется Regular либо Bold по полю bold. `bold` остаётся обязательным и равен true только для Bold / Bold Italic; остальные веса кодируются начертанием. Некорректные сочетания отклоняются. `size` — прежние 4..200 pt.

Для label/value/datetime optional `textAlign` — top/middle/bottom-left/center/right, по умолчанию middle-left. Старый CLI 0.4.0 отклоняет новые семейства/поля; для них нужен 0.5.0. Прежние EXUI/5 не требуют миграции.

Inter 4.1 — закреплённый неизменённый ресурс CLI под SIL OFL. Пакет содержит только декларацию, не шрифтовые бинарные файлы или пути. x86 writer добавляет коллекцию один раз, назначает Windows-семейство веса, bold/italic и ресурс каждой подписи. Независимый NRBF-reader проверяет шрифт, размер, стили, ссылки, SHA-256 встроенных байтов и FlattenText=false. [Правила Figma и подписей Button](../src/figma-plugin/NATIVE_TEXT.md).

Историческое описание появления контракта:

20.10.2026. Producer: плагин 0.2.0. Форматы exui/1–4 не меняются. Версия выбирается только по `manifest.schema`; автоматического fallback нет. Старый CLI может отклонить exui/5 и новые поля реестра доноров.

ZIP/PNG/JSON, ограничения размера, CRC/SHA-256, пути, шрифты и профили остаются прежними. В CLI 0.3.0 preview убран отдельный предел 16 PNG для exui/5: количество ресурсов ограничивается фактическим размером JSON и пакета. Сохраняются 4 MiB на PNG, 4096 px на сторону, 16 MiB распакованный пакет, ZIP до 20 MiB, manifest.json до 64 KiB и screen.json до 256 KiB. CLI читает ограниченный manifest и сверяет число ZIP-записей с его ресурсами до загрузки PNG. Прежние EXUI 1–4 сохраняют свои ограничения; старый CLI не принимает расширенные пакеты. Схемы: [manifest](../schemas/exui-v5/manifest.schema.json), [screen](../schemas/exui-v5/screen.schema.json). Пакет не задаёт DLL, путь доноров, нативный тип или исполняемый код.

## Две формы screen.json

| Форма | Поля |
|---|---|
| Один экран | schema, project, page, assets, elements |
| Проект | schema, project, pages, popups, groups, assets |

`schema` = `exui-screen/5`; смешивать формы нельзя. Контейнерный вариант использует правила [exui/2](exui-v2.md): ровно одна стартовая страница, общие ID/имена страниц и popup, ссылки и группы, обратные ссылки, modal, достижимость navigation. Все новые типы доступны на страницах и в popup; popup-ref только на страницах.

При конвертации стартовая страница (`shownBy: "start"`) ставится первой в GDL независимо от её позиции в `pages`. Остальные страницы сохраняют порядок массива; порядок popup и элементов не меняется. Плагин экспортирует стартовую страницу первой, остальные страницы и popup — по именам с числовой сортировкой.

## Элементы

Общие поля: key, kind, objectId, controlId, name, rect. Все свойства строго перечислены схемой; неизвестные и не относящиеся к типу поля отклоняются.

| kind | Нативный тип | Дополнительные поля |
|---|---|---|
| button | PBButton | font, states, optional press/navigate/behavior |
| label | PBLabel | Статичный текст: text, textColor, font; controlId=null |
| value | PBLabel | text, textColor, font; обязательный controlId; dynamicText=true; optional behavior |
| level | PBLevel | display=slider/gauge/multistate/volume-led, orientation, min/max, fillColor; optional behavior; у multistate обязательны states и font |
| slider | PBSlider | orientation, min/max, fillColor, native; обязательный controlId; optional behavior |
| graphic | PBImage | image: ключ PNG; controlId=null, правила exui/4 |
| shape | PBShape | fillColor, native; controlId=null |
| line | PBLine | fillColor, native; controlId=null |
| datetime | PBDateTime | font, textColor, native; controlId=null |
| popup-ref | PBPopupPageReference | popup либо group; controlId=null |

Направления: left-to-right, right-to-left, bottom-to-top, top-to-bottom. Диапазон: целые `0 <= min < max <= 2147483647`. Value не связывается с Level/Slider автоматически; обновление и форматирование делает программа управления.

| native для типа | Состав |
|---|---|
| slider | trackColor, trackWidth, thumbColor, thumbWidth, thumbHeight, thumbType=ellipse/rectangle/none, radius |
| shape | shape=rectangle/ellipse, radius, strokeColor, thickness |
| line | thickness; направление по большей стороне rect; концы Flat, по центрам противоположных сторон |
| datetime | pattern, например dd.MM.yyyy HH:mm |

Все поля соответствующей native-структуры обязательны. Размеры бегунка, толщина и скругление должны помещаться в геометрию. Сплошные RGB-цвета. Нативные изображения Slider пока не поддержаны. В Figma Track/Fill/Thumb — геометрическое описание и preview; положение Thumb не задаёт начальное значение устройства.

## Состояния и указания программе

У Button и Multistate Level 2..8 состояний. Явные stateId плотные 0..N, независимы от порядка массива. Первый и только первый normal, следующие feedback либо один pressed; Multistate Level без pressed. Имена уникальны, виды различимы. press, если указан, именует pressed. Если pressed отсутствует, press также отсутствует и press feedback=-1. Прежняя двухсостояниевая Normal/Pressed остаётся допустимой.

Расширение exui/5 в плагине и CLI 0.2.1 допускает `text: ""` у состояний Button: видимый текст может быть независимыми Label/Value поверх кнопки. `text` остаётся обязательным; null, пробельные строки и повреждённый Unicode запрещены. У Label/Value и Multistate Level текст непустой. Прежние контракты exui/1–4 остаются строгими. Нативный Button сохраняет состояния и touch target, а наложенные подписи — независимые объекты; их цвет/поведение и касания не синхронизируются автоматически. Для этого расширения нужны плагин и CLI 0.2.1; архив 0.2.0 остаётся историческим.

`behavior`: optional selectionGroup (ключ, только Button), enabled/visible (boolean). Это **указания для программы управления** в id-map, а не native actions, отключение/скрытие объекта или автоматически созданная ControlScript-программа. Контрол должен иметь controlId. State Disabled задаёт только внешний вид. navigate сохраняет прежний смысл указания программисту.

## Writer и независимая проверка

PBShape (Offline Page), PBLine (Main), PBDateTime (Start) клонируются из прежних закреплённых доноров. Хеши донорских GDL не менялись; в реестр добавлены только ссылки на уже находящиеся в них объекты. PBSlider создаётся проверенным parameterless data-конструктором 1.28.0.7; сериализованная общая база копируется из клона PBLevel и ObjectType меняется на Slider. Все действия только в прежнем отдельном x86-хосте.

Для Shape/Slider создаётся собственный PBBorderResource из закреплённого `2D Rectangle`, задаются форма, radius, thickness и 2D style. Старые ресурсы не изменяются. Multistate Level получает клон PBStates из кнопки-донора, затем ровно заданные состояния.

NRBF-reader не загружает Extron и проверяет класс, native ObjectType, ID, rect, цвета, размеры дорожки/бегунка, диапазон/направление, border resource, параметры Line/DateTime, dynamicText, все состояния и контейнерные связи. Публикуется новый GDL только после успешной проверки. Проверка нативного объекта не подтверждает его отрисовку/Build на панели.

## Плагин и сохранённые документы

Старые metadata/1 читаются без перезаписи. Новые типы/свойства используют metadata/2 под тем же ключом exui; старый плагин их отклоняет. Реестр экрана/1 сохраняется, проект использует реестр/2 с nextContainerId/nextGroupId. Повреждённый реестр не сбрасывается. Исторические резервы включённых экранов учитываются, активные конфликты ID требуют явного решения автора.

Видео и Dynamic Image для профилей 1025M/300M не входят в контракт: плагин выдаёт явную ошибку вместо растрирования. Новые профили потребуют самостоятельного расширения.

Примеры: [exui-v5](../examples/exui-v5/README.md). [Стандарт Figma](../src/figma-plugin/AUTHORING_STANDARD.md), [протокол](../verification/results/2026-10-20-expanded-controls.md).

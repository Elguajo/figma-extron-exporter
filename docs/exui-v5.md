<a id="russian"></a>

# Контракт exui/5: расширенные нативные элементы и проект Figma

**Русский** · [English](#english)

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

ZIP/PNG/JSON, ограничения размера, CRC/SHA-256, пути, шрифты и профили остаются прежними. В CLI 0.3.0 preview убран отдельный предел 16 PNG для exui/5: количество ресурсов ограничивается фактическим размером JSON и пакета. Сохраняются 4 MiB на PNG, 4096 px на сторону, 16 MiB распакованный пакет, ZIP до 20 MiB, manifest.json до 64 KiB и screen.json до 256 KiB. CLI читает ограниченный manifest и сверяет число ZIP-записей с его ресурсами до загрузки PNG. Прежние EXUI 1–4 сохраняют свои ограничения; старый CLI не принимает расширенные пакеты. Схемы: [manifest](../src/screen/schemas/exui-v5/manifest.schema.json), [screen](../src/screen/schemas/exui-v5/screen.schema.json). Пакет не задаёт DLL, путь доноров, нативный тип или исполняемый код.

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

Примеры: [exui-v5](../tests/fixtures/exui-v5/README.md). [Стандарт Figma](../src/figma-plugin/AUTHORING_STANDARD.md), [протокол](verification/results/2026-10-20-expanded-controls.md).

---

<a id="english"></a>

# The exui/5 contract: extended native elements and Figma projects

[Русский](#russian) · **English**

Current kit: **plugin 0.7.0 + CLI 0.7.0**. The contract did not change; CLI 0.7.0 writes an empty Text for passive elements, and plugin 0.7.0 passes a transparent `states[].fill` for buttons with PNGs. The working code supports EXUI/5, including earlier packages. Old EXUI/1–4 packages are refused; to update, export the source layout with the current plugin. Saved keys and IDs in Figma do not change. Earlier schemas and examples are kept in the repository as research material.

## Line transparency (plugin 0.6.7, CLI 0.6.4)

`line.fillColor` accepts `#RRGGBB` or `#AARRGGBB` in both EXUI/5 forms: a single screen and a project with pages/popups. The plugin multiplies the opacity of the SOLID Stroke and the layer Opacity before rounding the alpha channel to 8 bits. Rectangular lines use the Fill instead of the Stroke. For example, `#D2AE6D` at 10% → `#1AD2AE6D`; with Stroke 10% and Opacity 50% → `#0DD2AE6D`. A fully transparent line is kept together with its key and ID. The result is a PBLine without a PNG.

Packages with an alpha line color need CLI 0.6.4+. Old EXUI/5 packages with `#RRGGBB` are accepted without migration. Other type limits are unchanged; this support does not cover the general Opacity of arbitrary groups and other native elements.

## Transparent popups and link styling (CLI 0.6.1)

`popups[].background`, `shape.fillColor`, `shape.native.strokeColor` and `states[].fill` accept `#RRGGBB` or `#AARRGGBB`. `#00000000` is a fully transparent background. Other colors, including the background of an ordinary page, keep the `#RRGGBB` format. The old CLI 0.6.0 refuses such alpha colors; use CLI 0.6.1+ (CLI 0.6.5+ for `states[].fill`). Earlier EXUI/5 packages are accepted without migration.

By default, plugin 0.6.2 ignores the background and stroke of popup/popupref Frames; it always ignores corner radii and the overall Opacity. The Figma metadata uses the optional booleans `exportBackground`/`exportStroke` (absent or false means do not transfer), only for popup and popup-ref. The identity and the metadata version are kept. When a popup background is exported explicitly, the writer uses the native background; popupref styling and the popup stroke are lowered to an ordinary passive rectangular `shape` placed before the link/content. Its key is `popup-appearance.<containerId>.<objectId>`, and its ID is allocated deterministically outside authored/derived IDs; controlId=null, radius=0. The extra shapes count toward the current element limits. The package contains no new types and no executable logic.

For created containers, the CLI clears the donor's internal fill and stroke (`borderFillColorField`, `borderColorField`, `borderField`) and resets `transparencyField` to 0. GUI Designer draws the internal fill on top of `backgroundFillColorField` even without a stroke resource, so a transparent background alone is not enough. The independent verifier checks both layers. The donor's Offline popup is not changed.

## Native Inter and alignment (0.5.0)

`font.family`: Arial, Inter or Inter Display. For Inter, the optional `font.style` accepts Thin, Extra Light, Light, Regular, Medium, Semi Bold, Bold, Extra Bold, Black and their italics (`Italic` for Regular, otherwise the ` Italic` suffix). Without a style, Regular or Bold is used according to the bold field. `bold` stays required and is true only for Bold / Bold Italic; other weights are encoded by the style. Invalid combinations are refused. `size` is still 4..200 pt.

For label/value/datetime, the optional `textAlign` is top/middle/bottom-left/center/right, middle-left by default. The old CLI 0.4.0 refuses the new families/fields; they need 0.5.0. Earlier EXUI/5 packages need no migration.

Inter 4.1 is a pinned, unmodified CLI resource under the SIL OFL. The package contains only the declaration, no font binaries or paths. The x86 writer adds the collection once and assigns the Windows family of the weight, bold/italic and the resource of each label. The independent NRBF reader checks the font, size, styles, links, the SHA-256 of the embedded bytes and FlattenText=false. [Figma rules and Button captions](../src/figma-plugin/NATIVE_TEXT.md#english).

Historical description of how the contract appeared:

20 Oct 2026. Producer: plugin 0.2.0. Formats exui/1–4 do not change. The version is chosen only by `manifest.schema`; there is no automatic fallback. An old CLI may refuse exui/5 and the new donor registry fields.

ZIP/PNG/JSON, size limits, CRC/SHA-256, paths, fonts and profiles stay the same. CLI 0.3.0 preview removed the separate limit of 16 PNGs for exui/5: the number of resources is limited by the actual size of the JSON and the package. The limits of 4 MiB per PNG, 4096 px per side, a 16 MiB unpacked package, a ZIP up to 20 MiB, manifest.json up to 64 KiB and screen.json up to 256 KiB remain. The CLI reads the bounded manifest and checks the number of ZIP entries against its resources before loading PNGs. Earlier EXUI 1–4 keep their limits; an old CLI does not accept extended packages. Schemas: [manifest](../src/screen/schemas/exui-v5/manifest.schema.json), [screen](../src/screen/schemas/exui-v5/screen.schema.json). The package does not set DLLs, the donor path, a native type or executable code.

## Two forms of screen.json

| Form | Fields |
|---|---|
| Single screen | schema, project, page, assets, elements |
| Project | schema, project, pages, popups, groups, assets |

`schema` = `exui-screen/5`; the forms cannot be mixed. The container form uses the rules of [exui/2](exui-v2.md) (in Russian): exactly one start page, shared IDs/names of pages and popups, links and groups, back-references, modal, reachability of navigation. All new types are available on pages and in popups; popup-ref only on pages.

During conversion, the start page (`shownBy: "start"`) is placed first in the GDL regardless of its position in `pages`. Other pages keep the array order; the order of popups and elements does not change. The plugin exports the start page first, and the other pages and popups by name with numeric sorting.

## Elements

Common fields: key, kind, objectId, controlId, name, rect. All properties are listed strictly by the schema; unknown fields and fields that do not belong to the type are refused.

| kind | Native type | Additional fields |
|---|---|---|
| button | PBButton | font, states, optional press/navigate/behavior |
| label | PBLabel | Static text: text, textColor, font; controlId=null |
| value | PBLabel | text, textColor, font; required controlId; dynamicText=true; optional behavior |
| level | PBLevel | display=slider/gauge/multistate/volume-led, orientation, min/max, fillColor; optional behavior; multistate requires states and font |
| slider | PBSlider | orientation, min/max, fillColor, native; required controlId; optional behavior |
| graphic | PBImage | image: PNG key; controlId=null, exui/4 rules |
| shape | PBShape | fillColor, native; controlId=null |
| line | PBLine | fillColor, native; controlId=null |
| datetime | PBDateTime | font, textColor, native; controlId=null |
| popup-ref | PBPopupPageReference | popup or group; controlId=null |

Directions: left-to-right, right-to-left, bottom-to-top, top-to-bottom. Range: integers `0 <= min < max <= 2147483647`. A Value is not linked to a Level/Slider automatically; the control program updates and formats it.

| native for the type | Contents |
|---|---|
| slider | trackColor, trackWidth, thumbColor, thumbWidth, thumbHeight, thumbType=ellipse/rectangle/none, radius |
| shape | shape=rectangle/ellipse, radius, strokeColor, thickness |
| line | thickness; direction by the longer side of rect; Flat ends, through the centers of opposite sides |
| datetime | pattern, for example dd.MM.yyyy HH:mm |

All fields of the matching native structure are required. Thumb size, thickness and radius must fit the geometry. Solid RGB colors. Native Slider images are not supported yet. In Figma, Track/Fill/Thumb are a geometric description and a preview; the Thumb position does not set the device's initial value.

## States and hints for the program

Button and Multistate Level have 2..8 states. Explicit stateIds are dense 0..N and independent of the array order. The first and only the first state is normal, the next ones are feedback or one pressed; Multistate Level has no pressed. Names are unique, looks are distinct. press, if given, names the pressed state. If there is no pressed state, press is absent too and press feedback=-1. The earlier two-state Normal/Pressed button remains valid.

The exui/5 extension in plugin and CLI 0.2.1 allows `text: ""` for Button states: the visible text may be independent Labels/Values on top of the button. `text` stays required; null, whitespace-only strings and broken Unicode are forbidden. Label/Value and Multistate Level text is non-empty. The earlier exui/1–4 contracts stay strict. A native Button keeps its states and touch target, while overlaid labels are independent objects; their color/behavior and touches are not synchronized automatically. This extension needs plugin and CLI 0.2.1; the 0.2.0 archive remains historical.

`behavior`: optional selectionGroup (a key, Button only), enabled/visible (boolean). These are **hints for the control program** in the id-map, not native actions, disabling/hiding of the object or an automatically created ControlScript program. The control must have a controlId. The Disabled state sets only the look. navigate keeps its earlier meaning as a hint for the programmer.

## Writer and independent verification

PBShape (Offline Page), PBLine (Main) and PBDateTime (Start) are cloned from the previously pinned donors. The hashes of the donor GDLs did not change; only references to objects already present in them were added to the registry. PBSlider is created by the verified parameterless data constructor of 1.28.0.7; the serialized common base is copied from a PBLevel clone and ObjectType is changed to Slider. All actions happen only in the existing separate x86 host.

For Shape/Slider, a dedicated PBBorderResource is created from the pinned `2D Rectangle`, and the shape, radius, thickness and 2D style are set. Existing resources are not changed. A Multistate Level gets a clone of PBStates from the donor button, then exactly the given states.

The NRBF reader does not load Extron and checks the class, native ObjectType, ID, rect, colors, track/thumb sizes, range/direction, border resource, Line/DateTime parameters, dynamicText, all states and container links. A new GDL is published only after a successful check. Verifying a native object does not confirm how it renders or builds on the panel.

## The plugin and saved documents

Old metadata/1 is read without being rewritten. New types/properties use metadata/2 under the same exui key; the old plugin refuses them. The screen registry/1 is kept; a project uses registry/2 with nextContainerId/nextGroupId. A damaged registry is not reset. Historical reservations of included screens are taken into account; active ID conflicts need an explicit decision by the author.

Video and Dynamic Image are not part of the contract for the 1025M/300M profiles: the plugin reports an explicit error instead of rasterizing. New profiles will need their own extension.

Examples: [exui-v5](../tests/fixtures/exui-v5/README.md) (in Russian). [Figma standard](../src/figma-plugin/AUTHORING_STANDARD.md) (in Russian), [report](verification/results/2026-10-20-expanded-controls.md) (in Russian).

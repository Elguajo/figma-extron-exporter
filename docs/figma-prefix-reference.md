<a id="russian"></a>

# Figma → Extron: таблица префиксов

**Русский** · [English](#english)

25.10.2026 · плагин **0.8.4 preview** · совместимый CLI **0.8.3** · EXUI/5.

[Шпаргалка в PDF](prefix_map/figma-extron-prefix-cheatsheet.pdf) · [Пять сценариев PDF](prefix_map/figma-extron-use-cases.pdf) · [Локальный сайт](web/index.html) · [Подробные правила подготовки](../src/figma-plugin/AUTHORING_STANDARD.md) · [Полный справочник](../src/figma-plugin/PREFIXES.md).

## Что такое префикс и для чего его использовать

Префикс - часть имени слоя перед первым `_`. В `btn_Music` префикс `btn_` означает кнопку, а `Music` - её назначение. По имени плагин предлагает тип, ключ и ID; после сохранения назначений экспортирует элемент в `.exui`, а CLI создаёт проект GUI Designer.

Короткий и полный префиксы равнозначны, регистр не важен. `btn_Music` и `BUTTON_MUSIC` обозначают один тип. После префикса нужна латинская буква; далее допустимы латиница, цифры, точки и дефисы между непустыми частями. Пробелы, дополнительные `_`, начальная/конечная точка и пустые части запрещены. `button_side.hall` сохраняет имя и получает новый ключ `home.side.hall`. Видимый текст может быть русским.

Префиксы помогают выбрать правильный элемент и подготовить его для экспорта. Связи с устройствами, AV-команды, переходы, группы выбора и feedback подключает программа Extron. Само имя `button_Music` музыку не включает.

## 1. Экраны и структура

| Сущность и имена | Что это и для чего использовать | Как подготовить |
|---|---|---|
| Проект: `prj_Trilliant` / `project_Trilliant` | Весь интерфейс в одном экспорте: Home, Settings, popup. | Внешний Frame произвольного размера; внутри страницы, popup и их группы. |
| Секция проекта: любое имя | Организационный контейнер нескольких экранов (плагин 0.3.2+). | Выделить секцию с Frame страницами/popup → распознать и сохранить назначения. Размер и оформление секции не экспортируются; `project_` для секции не требуется. |
| Страница: `Home`, `scr_Home` / `screen_Home` | Самостоятельный экран Home, Hall, Terrace или Settings. | Frame точного размера панели: 1025M - 1280×800; 300M portrait - 320×480. Ровно одна стартовая страница проекта. |
| Popup: `pop_Sources` / `popup_Sources` | Дополнительная область для выбора источника или настроек поверх основной страницы. | Frame своего размера внутри проекта или группы; на странице нужен popupref такого же размера. |
| Модальный popup: `mdl_Confirm` / `modalpopup_Confirm` | Подтверждение, например «Выключить систему?», требующее ответа пользователя. | Полноэкранный Frame внутри проекта, без группы. Ссылки создаёт штатный Build. Затемнение — заливкой самого Frame с прозрачностью Fill и флажком «Экспортировать фон Frame». |
| Группа popup: `pgrp_Zones` / `popupgroup_Zones` | Поочерёдно показывать Hall или Terrace в одной области. Участники взаимоисключающие. | Организационный Frame с обычными popup одного размера; фон и геометрия обёртки не экспортируются. |
| Место popup: `pr_Sources` / `popupref_Sources` | Указать область страницы, в которой появляется popup или группа. | Пустой Frame размера цели. Автоцель `popup.sources`; группу `group.zones` задают формой, оставив ключ popup пустым. |

## 2. Управление и индикаторы

| Сущность и имена | Что это и для чего использовать | Как подготовить / поведение |
|---|---|---|
| Кнопка: `btn_Music` / `button_Music` | Команда, выбор источника, зоны или Mute, когда достаточно двух видов. | Ровно 2 состояния: normal + feedback либо normal + pressed. Например, Off / On, Passive / Active или Normal / Pressed. |
| Кнопка целиком в PNG: `ibtn_VideoControl` / `imagebutton_VideoControl` | Карточка с произвольным положением и оформлением текста и иконок. | Весь вид каждого состояния, включая подпись, в одном PNG; Text Button пустой, отдельного Label нет. У новой кнопки 2 состояния как у btn_; у переименованной сохраняется назначенный тип и ID. Text Feedback подпись в PNG не меняет. Поддерживается локальным development build от 27.10.2026. |
| Feedback-кнопка: `fbtn_Mute` / `feedbackbutton_Mute` | Показывать состояние устройства и при необходимости отдельный вид нажатия. | Normal / Active, Passive / Active или Off / On; Pressed необязателен. Экспортируются 2 или 3 существующих состояния. |
| Громкость «+»/«-»: `btn_VolumeUp`, `btn_VolumeDown` / `button_VolumeUp`, `button_VolumeDown` | Увеличивать или уменьшать громкость с видом при удержании. | Normal / Pressed; цвет Pressed рисует дизайнер. Шаг, повтор и команды реализует программа. |
| Mute: `btn_Mute` / `button_Mute` | Показывать включённое заглушение звука. | Off / On; устойчивый On приходит по feedback. Для дополнительного Pressed использовать `fbtn_Mute` с Off / On / Pressed. |
| Кастомный Slider: `sld_Volume` / `slider_Volume` | Регулировать громкость ползунком со своей поддержанной дорожкой и бегунком. | Frame без фона, внутри ровно Track, Fill, Thumb. Диапазон и направление задают формой; по умолчанию 0-100 слева направо. |
| Простой Level: `lvl_Volume` / `level_Volume` | Простой регулятор без собственных частей Track / Fill / Thumb. | Пустой Frame со сплошной заливкой; PBLevel в режиме Slider. |
| Gauge: `gau_Signal` / `gauge_Signal` | Показывать уровень сигнала или измеренное значение без регулировки пользователем. | Пустой Frame со сплошной заливкой; PBLevel Gauge. |
| Индикатор: `ind_Status` / `indicator_Status` | Другой префикс того же числового Gauge. | Отдельную лампу, кнопку или переключатель не создаёт. |
| LED-шкала: `led_Audio` / `volumeled_Audio` | Показывать уровень аудиосигнала сегментами. | Пустой Frame с заливкой; PBLevel VolumeLED. Фактический вид проверить на панели. |
| Multistate Level: `mlvl_Status` / `multilevel_Status` | Показывать дискретные состояния «Нет связи», «Готов», «Ошибка». | Frame без фона с 2-8 состояниями; первое normal, остальные feedback; без Pressed. |

## 3. Текст и графика

| Сущность и имена | Что это и для чего использовать | Как подготовить / результат |
|---|---|---|
| Статичный текст: `txt_Title` / `text_Title` | Постоянный заголовок Hall, подпись «Громкость» или пояснение. | Text Arial Regular/Bold, Inter / Inter Display; девять сочетаний выравнивания при поддержанном оформлении; PBLabel без управляющего ID, иначе PNG. |
| Обновляемая подпись: `val_VolumeValue` / `value_VolumeValue` | Показывать актуальные «42%», источник или состояние соединения. | Text с начальным текстом → PBLabel с dynamicText и собственным controlId. Обновление и форматирование задаёт программа. |
| Дата/время: `dt_Clock` / `datetime_Clock` | Показывать текущие часы и дату панели. | Компонент `datetime_Clock` из Extron Kit (свойство Format), Text-пример `September 28, 12:00 AM` или Text с форматом `HH:mm` → PBDateTime. Время и часовой пояс проверить на панели. |
| Логотип: `logo_Company` | Самостоятельная статичная картинка бренда. | Frame с графикой → PNG Native 1× → PBImage без нажатий и controlId. |
| Картинка: `img_Photo` / `image_Photo` | Фото, иллюстрация, обложка или сложный статичный фон. | Frame с графикой → один PNG → отдельный PBImage. Внутренние векторы становятся пикселями. |
| Иконка: `Icon`, `ico_Music` / `icon_Music` | Значок Music или Mute внутри состояния кнопки / Multistate Level. | Вложенный Frame / Artwork → PNG состояния, без отдельного controlId. Для центрированного текста размещайте иконку слева или справа с симметричным резервом. |
| Фигура: `shp_Card` / `shape_Card` | Редактируемый фон карточки, плашка или рамка. | Пустой Frame / Rectangle / Ellipse → PBShape: сплошная заливка, единое скругление, максимум одна SOLID-обводка INSIDE. |
| Линия: `ln_Divider` / `line_Divider` | Редактируемый разделитель секций. | С 0.3.4 горизонтальная/вертикальная Pen (Vector) / Line с SOLID Stroke CENTER → PBLine без PNG. Плоские окончания; с 0.5.4 толщина и окрашенная область округляются при экспорте. Прежний пустой Frame / Rectangle без скругления и обводки также поддержан. |

### Пример: громкость в процентах

```text
Home
  button_VolumeDown       Normal / Pressed, Text «-» в каждом состоянии
  slider_Volume          Track / Fill / Thumb
  value_VolumeValue      отдельный Text «42%»
  button_VolumeUp         Normal / Pressed, Text «+» в каждом состоянии
  button_Mute             Off / On
```

Для цифр «42%» нужен `value_`, для регулировки - `slider_` / `level_`, для визуального индикатора без регулировки - `gauge_`. Это отдельные элементы с разными ID. Программист связывает их, задаёт начальное значение и обновляет процентный текст с `%`. Положение Thumb в Figma служит предпросмотром.

## 4. Состояния и сохранённые назначения

Для новых макетов использовать единые схемы:

| Назначение | Состояния | Префикс |
|---|---|---|
| Включение или выбор | **Off / On** | `button_` / `btn_` |
| Нажатие и удержание | **Normal / Pressed** | `button_` / `btn_` |
| Выбор с отдельным видом нажатия | **Normal / Active / Pressed** | `feedbackbutton_` / `fbtn_` |

Passive / Active, Normal / Active без Pressed и другие поддержанные синонимы сохраняют совместимость. В оформлении обычных кнопок выбирается Off / On либо Normal / Pressed. Override преобразует готовые пары и обновляет имена и роли назначений; ID кнопок и слоты 0/1 в пакете сохраняются. Пропуск сохраняет готовые пары. Для feedback-кнопок создаётся Normal / Active, Pressed для тройки добавляется вручную. [Подготовка по эталонам Rectangle](../src/figma-plugin/BUTTON_STATES.md).

| Имена состояния | Роль | Когда использовать |
|---|---|---|
| Normal / Off / Passive; также `st_` / `state_` | normal | Исходный вид. ID 0 в пакете / GDL. |
| On / Active / Feedback; также `st_` / `state_` | feedback | Состояние от программы: выбранная зона, активный источник, включённый Mute. В обычной паре ID 1. |
| Pressed; также `st_Pressed` / `state_Pressed` | pressed | Вид при удержании. ID 1 в паре Normal / Pressed, ID 2 в тройке normal / feedback / pressed. |
| `st_Ready` / `state_Ready`, `state_Error`, `state_Disabled` | feedback | Дополнительные виды у прежних сохранённых кнопок без явного типа и у Multistate Level. Для новых btn_ / fbtn_ произвольные имена недопустимы. Disabled не блокирует касание; это делает программа. |

Для нового btn_ нужны normal и ровно один feedback либо pressed. Для fbtn_ нужны normal и feedback; pressed необязателен. Нельзя дублировать одну роль: например, одновременно Normal и Passive. Экспортируются существующие состояния, включая скрытые; отсутствующее состояние и его PNG не создаются. Видимо ровно одно состояние. Цвета, подписи и графику рисует дизайнер.

Сохранённые уникальные назначения приоритетнее имён. В плагине 0.3.5 проверка и скачивание автоматически заполняют ключи и свободные ID, исправляют копии и совпадения. Переименование обновляет автоматический ключ, сохраняя тип и числовые ID; форма нужна для особых настроек. Диапазон регуляторов по умолчанию — 0–100, свой диапазон сохраняется. Новые ключи используют нижний регистр; CamelCase не добавляет дефисы. Одинаковые имена получают суффиксы `-2`, `-3`; понятные разные имена, например `slider_Volume` и `value_VolumeValue`, упрощают карту ID.

## 5. Extron Kit и ограничения

Свежие экземпляры брать из Assets и размещать непосредственно в странице / popup. Одинаково названным экземплярам и обычным слоям плагин выдаёт разные ключи и ID. У кнопок кита редактировать Label и графику внутри существующих Artwork-слотов, сохраняя их служебные имена. Служебный Text над Artwork оставить пустым, Arial, на всю кнопку. Один существующий Artwork-вид даёт один PNG; кнопка с двумя видами - 2 PNG, с тремя - 3 PNG. Отсутствующий третий вид не добавляется. [Подробности Kit](../src/figma-plugin/EXTRON_KIT.md).

В обновлённом **exui/5 нет отдельного предела числа PNG**. Для пакетов более 16 PNG нужны **плагин 0.3.1 и CLI 0.3.0**. Сохраняются ограничения: PNG до 4 MiB и 4096×4096, распакованный пакет до 16 MiB, ZIP до 20 MiB, manifest.json до 64 KiB и screen.json до 256 KiB. Старые форматы exui/1-4 сохраняют предел 16 PNG; старый CLI 0.2.1 не принимает большие наборы ресурсов.

Проект: 1-16 страниц, до 32 popup, 16 групп, 256 элементов всего; внутри одного контейнера 1-64 элемента. Целые координаты и размеры, без поворота. Свободная графика и эффекты допустимы внутри растеризуемых Artwork / изображений; у нативных частей Slider и примитивов сохраняются ограничения оформления.

Видео `vid_` / `video_` и обновляемая по URL картинка `dimg_` / `dynamicimage_` зарезервированы, но для профилей 1025M / 300M вызывают ошибку экспорта. Prototype interactions Figma не экспортируются. Группа выбора, доступность и видимость передаются в id-map как указания для программы управления. Переходы задаются в GCP; привязывать экраны к кнопкам в Figma не требуется.

## Текст и иконки в новых кнопках

Основной вариант: **текст Middle-Center по центру всей кнопки, иконка слева или справа внутри Artwork**. В блоке «Текст кнопок для GCP» явно примените «По центру». Оставьте симметричный резерв с обеих сторон и проверьте самую длинную подпись Text Feedback. Экспортёр не сдвигает иконку и не проверяет пересечения.

GUI Designer имеет сетку 3x3. Текущий экспорт нативного текста Button поддерживает центр и низ по центру; это ограничение плагина. Label / Value / DateTime поддерживают девять сочетаний. Иконка входит в PNG состояния и не получает своего controlId. Для Text Feedback подпись должна храниться в Button, а не в отдельном Label или PNG. [Подробности](../src/figma-plugin/NATIVE_TEXT.md).

## 6. Экспорт и совместимость

Выбрать внешний Frame экрана / проекта и профиль → «Проверить макет» → исправить ошибки → «Скачать .exui». Ключи и свободные ID назначаются автоматически. Затем CLI: `validate-package` → `convert-package` → GUI Designer: открыть → Verify → Save and Build → повторно открыть. Передать программисту `id-map`, проверить касания, удержание и feedback на панели.

Таблица актуализирована для **плагина 0.8.4 + CLI 0.8.3, EXUI/5**. Архив 0.2.2 ещё требует строгие Off / On для btn_ и Normal / Active / Pressed для fbtn_. Прежние сохранённые назначения сохраняют свои правила и ID; при удалении назначенного состояния с пропуском ID оставшиеся ID нужно явно согласовать через форму. Новый запуск пользовательского макета в Figma, GUI Designer Verify / Build и оборудование для текущей ревизии требуют отдельной проверки.

Основания: [стандарт авторинга](../src/figma-plugin/AUTHORING_STANDARD.md), [правила распознавания](../src/figma-plugin/src/recognize.ts), [контракт состояний](../src/figma-plugin/src/model.ts), [контракт пакета](exui-v5.md), [проверка изменений](verification/results/2026-10-21-flexible-authoring.md), [комплект 0.3.1](../releases/figma-plugin/Legacy/0.3.1/README.md).

---

<a id="english"></a>

# Figma → Extron: prefix table

[Русский](#russian) · **English**

25 Oct 2026 · plugin **0.8.4 preview** · compatible CLI **0.8.3** · EXUI/5.

[PDF cheat sheet](prefix_map/figma-extron-prefix-cheatsheet.pdf) · [Five use cases PDF](prefix_map/figma-extron-use-cases.pdf) · [Offline website](web/index.html) (in Russian) · [Detailed preparation rules](../src/figma-plugin/AUTHORING_STANDARD.md) (in Russian) · [Full reference](../src/figma-plugin/PREFIXES.md#english).

The plugin interface is in Russian; its labels are quoted as shown, followed by their English meaning.

## What a prefix is and what it is for

A prefix is the part of a layer name before the first `_`. In `btn_Music`, the prefix `btn_` means a button, and `Music` is its purpose. From the name, the plugin suggests a type, a key and an ID; after the assignments are saved, it exports the element into the `.exui`, and the CLI creates the GUI Designer project.

Short and full prefixes are equivalent, and case does not matter. `btn_Music` and `BUTTON_MUSIC` mean the same type. After the prefix there must be a Latin letter; then Latin letters, digits, dots and hyphens between non-empty parts are allowed. Spaces, extra `_`, a leading/trailing dot and empty parts are forbidden. `button_side.hall` keeps its name and gets the new key `home.side.hall`. The visible text may be in any language.

Prefixes help choose the right element and prepare it for export. Links to devices, AV commands, navigation, selection groups and feedback are connected by the Extron program. The name `button_Music` does not turn on music by itself.

## 1. Screens and structure

| Entity and names | What it is and when to use it | How to prepare it |
|---|---|---|
| Project: `prj_Trilliant` / `project_Trilliant` | The whole interface in one export: Home, Settings, popups. | An outer Frame of any size; inside are pages, popups and their groups. |
| Project section: any name | An organizing container for several screens (plugin 0.3.2+). | Select a section with page/popup Frames → recognize and save the assignments. The section's size and styling are not exported; `project_` is not needed for a section. |
| Page: `Home`, `scr_Home` / `screen_Home` | A standalone screen such as Home, Hall, Terrace or Settings. | A Frame of the exact panel size: 1025M — 1280×800; 300M portrait — 320×480. Exactly one start page per project. |
| Popup: `pop_Sources` / `popup_Sources` | An extra area over the main page for choosing a source or settings. | A Frame of its own size inside the project or a group; the page needs a popupref of the same size. |
| Modal popup: `mdl_Confirm` / `modalpopup_Confirm` | A confirmation such as "Turn the system off?" that needs the user's answer. | A full-screen Frame inside the project, without a group. The links are created by the standard Build. Dimming is done with the Frame's own fill with Fill transparency and the «Экспортировать фон Frame» (Export Frame background) checkbox. |
| Popup group: `pgrp_Zones` / `popupgroup_Zones` | Show Hall or Terrace in turn in one area. The members are mutually exclusive. | An organizing Frame with ordinary popups of the same size; the wrapper's background and geometry are not exported. |
| Popup place: `pr_Sources` / `popupref_Sources` | Marks the area of the page where a popup or a group appears. | An empty Frame of the target's size. Automatic target `popup.sources`; the group `group.zones` is set in the form, leaving the popup key empty. |

## 2. Controls and indicators

| Entity and names | What it is and when to use it | How to prepare it / behavior |
|---|---|---|
| Button: `btn_Music` / `button_Music` | A command, a choice of source or zone, or Mute, when two looks are enough. | Exactly 2 states: normal + feedback or normal + pressed. For example, Off / On, Passive / Active or Normal / Pressed. |
| Whole-state PNG button: `ibtn_VideoControl` / `imagebutton_VideoControl` | A card with freely positioned and styled captions and icons. | Every whole state is one PNG, including captions; Button Text is empty and no separate Label is created. A new button uses two states like btn_; a renamed one retains its assigned type and IDs. Text Feedback does not replace captions drawn in PNG. Available in the local development build dated 2026-10-27. |
| Feedback button: `fbtn_Mute` / `feedbackbutton_Mute` | Shows the device state and, if needed, a separate pressed look. | Normal / Active, Passive / Active or Off / On; Pressed is optional. 2 or 3 existing states are exported. |
| Volume "+"/"−": `btn_VolumeUp`, `btn_VolumeDown` / `button_VolumeUp`, `button_VolumeDown` | Raise or lower the volume with a look while held. | Normal / Pressed; the designer draws the Pressed color. Step, repeat and commands are implemented by the program. |
| Mute: `btn_Mute` / `button_Mute` | Shows that muting is on. | Off / On; the stable On comes from feedback. For an extra Pressed look use `fbtn_Mute` with Off / On / Pressed. |
| Custom Slider: `sld_Volume` / `slider_Volume` | Adjust the volume with a slider that has its own supported track and thumb. | A Frame without background, containing exactly Track, Fill, Thumb. Range and direction are set in the form; default 0–100, left to right. |
| Simple Level: `lvl_Volume` / `level_Volume` | A simple control without its own Track / Fill / Thumb parts. | An empty Frame with a solid fill; PBLevel in Slider mode. |
| Gauge: `gau_Signal` / `gauge_Signal` | Shows a signal level or a measured value that the user does not adjust. | An empty Frame with a solid fill; PBLevel Gauge. |
| Indicator: `ind_Status` / `indicator_Status` | Another prefix for the same numeric Gauge. | Does not create a separate lamp, button or switch. |
| LED scale: `led_Audio` / `volumeled_Audio` | Shows the audio signal level in segments. | An empty Frame with a fill; PBLevel VolumeLED. Check the actual look on the panel. |
| Multistate Level: `mlvl_Status` / `multilevel_Status` | Shows discrete states such as "No connection", "Ready", "Error". | A Frame without background with 2–8 states; the first is normal, the others feedback; no Pressed. |

## 3. Text and graphics

| Entity and names | What it is and when to use it | How to prepare it / result |
|---|---|---|
| Static text: `txt_Title` / `text_Title` | A permanent Hall title, a "Volume" caption or an explanation. | Text in Arial Regular/Bold, Inter / Inter Display; all nine alignment combinations for supported styling; PBLabel without a control ID, otherwise PNG. |
| Updatable label: `val_VolumeValue` / `value_VolumeValue` | Shows the current "42%", the source or the connection state. | Text with initial text → PBLabel with dynamicText and its own controlId. The program sets updates and formatting. |
| Date/time: `dt_Clock` / `datetime_Clock` | Shows the panel's current time and date. | The `datetime_Clock` component from the Extron Kit (Format property), the Text sample `September 28, 12:00 AM` or a Text with the `HH:mm` format → PBDateTime. Check the time and time zone on the panel. |
| Logo: `logo_Company` | A standalone static brand picture. | A Frame with artwork → PNG Native 1× → PBImage without touches or controlId. |
| Picture: `img_Photo` / `image_Photo` | A photo, illustration, cover or complex static background. | A Frame with artwork → one PNG → a separate PBImage. Internal vectors become pixels. |
| Icon: `Icon`, `ico_Music` / `icon_Music` | A Music or Mute icon inside a button state / Multistate Level. | A nested Frame → the state PNG; it is not a standalone touch element. |
| Shape: `shp_Card` / `shape_Card` | An editable card background, plate or frame. | An empty Frame / Rectangle / Ellipse → PBShape: solid fill, a single corner radius, at most one SOLID stroke INSIDE. |
| Line: `ln_Divider` / `line_Divider` | An editable section divider. | Since 0.3.4, a horizontal/vertical Pen (Vector) / Line with a SOLID Stroke CENTER → PBLine without a PNG. Flat ends; since 0.5.4 the thickness and the painted area are rounded on export. The earlier empty Frame / Rectangle without radius or stroke is also supported. |

### Example: volume in percent

```text
Home
  button_VolumeDown       Normal / Pressed, Text "-" in each state
  slider_Volume          Track / Fill / Thumb
  value_VolumeValue      separate Text "42%"
  button_VolumeUp         Normal / Pressed, Text "+" in each state
  button_Mute             Off / On
```

The digits "42%" need `value_`, adjustment needs `slider_` / `level_`, and a visual indicator without adjustment needs `gauge_`. These are separate elements with different IDs. The programmer links them, sets the initial value and updates the percent text with `%`. The Thumb position in Figma is only a preview.

## 4. States and saved assignments

For new layouts use these uniform schemes:

| Purpose | States | Prefix |
|---|---|---|
| Switching on or selecting | **Off / On** | `button_` / `btn_` |
| Pressing and holding | **Normal / Pressed** | `button_` / `btn_` |
| Selecting with a separate pressed look | **Normal / Active / Pressed** | `feedbackbutton_` / `fbtn_` |

Passive / Active, Normal / Active without Pressed and other supported synonyms remain compatible. For ordinary buttons, the styling chooses Off / On or Normal / Pressed. Override converts existing pairs and updates the names and roles of the assignments; button IDs and slots 0/1 in the package are kept. Skip keeps existing pairs. Feedback buttons get Normal / Active; Pressed for a triple is added by hand. [Preparation from Rectangle references](../src/figma-plugin/BUTTON_STATES.md#english).

| State names | Role | When to use |
|---|---|---|
| Normal / Off / Passive; also `st_` / `state_` | normal | The initial look. ID 0 in the package / GDL. |
| On / Active / Feedback; also `st_` / `state_` | feedback | A state set by the program: the selected zone, the active source, Mute on. ID 1 in an ordinary pair. |
| Pressed; also `st_Pressed` / `state_Pressed` | pressed | The look while held. ID 1 in a Normal / Pressed pair, ID 2 in a normal / feedback / pressed triple. |
| `st_Ready` / `state_Ready`, `state_Error`, `state_Disabled` | feedback | Extra looks for earlier saved buttons without an explicit type and for Multistate Level. Arbitrary names are not allowed for new btn_ / fbtn_. Disabled does not block touches; the program does that. |

A new btn_ needs normal and exactly one feedback or pressed. An fbtn_ needs normal and feedback; pressed is optional. A role cannot be duplicated: for example, Normal and Passive at the same time. Existing states are exported, including hidden ones; a missing state and its PNG are not created. Exactly one state is visible. Colors, captions and artwork are drawn by the designer.

Saved unique assignments take precedence over names. In plugin 0.3.5, the check and the download fill in keys and free IDs automatically and fix copies and collisions. Renaming updates the automatic key and keeps the type and numeric IDs; the form is needed for special settings. The default slider range is 0–100; a custom range is kept. New keys are lowercase; CamelCase does not add hyphens. Identical names get the suffixes `-2`, `-3`; clear distinct names such as `slider_Volume` and `value_VolumeValue` make the ID map easier to read.

## 5. Extron Kit and limits

Take fresh instances from Assets and place them directly in a page / popup. The plugin gives different keys and IDs to identically named instances and ordinary layers. In kit buttons, edit the Label and the artwork inside the existing Artwork slots, keeping their service names. Leave the service Text above the Artwork empty, in Arial, covering the whole button. One existing Artwork look gives one PNG; a button with two looks gives 2 PNGs, with three — 3 PNGs. A missing third look is not added. [Kit details](../src/figma-plugin/EXTRON_KIT.md#english).

The updated **exui/5 has no separate limit on the number of PNGs**. Packages with more than 16 PNGs need **plugin 0.3.1 and CLI 0.3.0**. The remaining limits: a PNG up to 4 MiB and 4096×4096, an unpacked package up to 16 MiB, a ZIP up to 20 MiB, manifest.json up to 64 KiB and screen.json up to 256 KiB. The older exui/1–4 formats keep the limit of 16 PNGs; the old CLI 0.2.1 does not accept large resource sets.

A project: 1–16 pages, up to 32 popups, 16 groups, 256 elements in total; 1–64 elements inside one container. Integer coordinates and sizes, no rotation. Free artwork and effects are fine inside rasterized Artwork / images; the native Slider parts and primitives keep their styling limits.

Video `vid_` / `video_` and the URL-updated picture `dimg_` / `dynamicimage_` are reserved, but cause an export error for the 1025M / 300M profiles. Figma Prototype interactions are not exported. Selection groups, availability and visibility are passed in the id-map as hints for the control program. Configure navigation in GCP; buttons need no links to screens in Figma.

## Text and icons in new buttons

Recommended: **native text at Middle-Center on the whole button, with an icon on the left or right inside Artwork**. Explicitly apply «По центру» (Center) in the Button text for GCP block. Reserve equal space on both sides and test the longest Text Feedback value. The exporter neither moves icons nor checks collisions.

GUI Designer has a 3x3 alignment grid. The plugin's native Button export supports middle-center and bottom-center; Label / Value / DateTime support all nine. Icons are part of a state PNG without their own controlId. Text Feedback needs the caption in Button itself, rather than a separate Label or PNG. [Details](../src/figma-plugin/NATIVE_TEXT.md#english).

## 6. Export and compatibility

Select the outer screen / project Frame and profile → «Проверить макет» (Check layout) → fix errors → «Скачать .exui» (Download .exui). Keys and free IDs are assigned automatically. Then the CLI: `validate-package` → `convert-package` → GUI Designer: open → Verify → Save and Build → reopen. Hand the `id-map` to the programmer and check touches, holds and feedback on the panel.

This table is updated for **plugin 0.8.4 + CLI 0.8.3, EXUI/5**. The 0.2.2 archive still requires strict Off / On for btn_ and Normal / Active / Pressed for fbtn_. Earlier saved assignments keep their rules and IDs; when an assigned state with a skipped ID is deleted, the remaining IDs must be agreed explicitly in the form. A new run of a user layout in Figma, GUI Designer Verify / Build and hardware need a separate check for the current revision.

Sources: [authoring standard](../src/figma-plugin/AUTHORING_STANDARD.md) (in Russian), [recognition rules](../src/figma-plugin/src/recognize.ts), [state contract](../src/figma-plugin/src/model.ts), [package contract](exui-v5.md#english), [check of the changes](verification/results/2026-10-21-flexible-authoring.md) (in Russian), [kit 0.3.1](../releases/figma-plugin/Legacy/0.3.1/README.md) (in Russian).

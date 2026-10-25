<a id="russian"></a>

# Оформление и состояния кнопок — 0.8.4 preview

**Русский** · [English](#english)

Координаты и размеры кнопки и её состояний при экспорте округляются до ближайшего целого пикселя: 218.21 → 218, 218.7 → 219, 218.5 → 219. PNG состояний получает тот же размер, что и кнопка. Геометрия исходных слоёв в Figma не меняется; детали внутри PNG сохраняют дробные значения. После округления состояния должны занимать всю кнопку, а кнопка — помещаться в экран.

## Контраст при применении оформления

Настройка **«Исправлять контраст текста и иконок»** включена по умолчанию. После переноса образцов каждое изменённое состояние, включая скрытое On / Active, проверяется отдельно: текст — минимум 4.5:1, однотонная графика — 3:1 по относительной яркости sRGB. Контрастные цвета сохраняются; недостаточно контрастные сплошные заливки и обводки становятся чёрными либо белыми. Например, белая подпись Input 7 и золотая иконка на золотом фоне станут чёрными. Текст, геометрия, имена и ID слоёв не меняются. Для сохранения авторских цветов отключите настройку перед применением.

Коррекция действует только на состояния, которым применяется образец. При пропуске готовые кнопки целиком сохраняются. При обновлении готовых кнопок проверяется также Pressed, получающий активный образец. В результате показано число исправленных слоёв. Если контраст нельзя надёжно оценить (изображение, градиент, смешанные заливки текста, маски, эффекты, режимы наложения или прозрачность), соответствующий участок сохраняется и учитывается в числе требующих ручной проверки. Полупрозрачная однотонная заливка учитывается через смешивание с фоном; если чёрный и белый с прежней прозрачностью не достигают порога, нужна ручная проверка. Это целевая проверка оформления кнопок, а не подтверждение полной доступности макета.

## Единое правило для новых макетов

| Назначение | Состояния | Префикс |
|---|---|---|
| Включение или выбор: Power, Mute, зона, источник | **Off / On** | `button_` / `btn_` |
| Нажатие и удержание: Volume + / −; действие или переход: Back / Home / Settings | **Normal / Pressed** | `button_` / `btn_` |
| Выбор с отдельным видом нажатия | **Normal / Active / Pressed** | `feedbackbutton_` / `fbtn_` |

Это единая схема именования для нового дизайна. Поддержанные синонимы **Passive / Active**, **Normal / Active** без Pressed и другие ранее допустимые наборы сохраняются. Проверка и экспорт сохраняют готовые назначения. Явный Override в оформлении обычных кнопок преобразует пару и обновляет имена и роли состояний; ID самой кнопки сохраняются. Off / Normal / Passive — роль normal, On / Active / Feedback — роль feedback; Pressed — отдельная роль нажатия. В одной кнопке нельзя дублировать одну роль.

On / Active задаёт программа управления Extron, Pressed — вид во время удержания. Имена не создают AV-команды, переключение устройства или повтор регулировки громкости.

## Быстрый процесс

Выделенный `popup_`, `modalpopup_` или `popupgroup_` имеет приоритет для оформления кнопок **во всех режимах экспорта**, включая сохранённые «Выбранные фреймы» и «Текущая страница». Выбор слоя внутри popup относится к этому popup. Состав проекта для проверки и экспорта сохраняется. Сообщение результата называет обработанный контейнер, отдельно считает подготовленные и обновлённые кнопки и созданные состояния; если ничего не изменилось, это указано явно.

1. Нарисовать кнопку обычной **Group или Frame** непосредственно внутри Frame экрана. Назвать `button_AudioControl` / `btn_AudioControl` либо `feedbackbutton_Power` / `fbtn_Power`. Внутри достаточно фона, текста и графики; отдельные состояния пока не нужны. Названия `Rectangle 11`, `Voice` и `txt_title.place` менять не требуется.
2. Вне экранов, на той же странице Figma, создать группу или Frame **Button Styles**. Внутри два обычных **Rectangle**: **Off / On**, с разными заливками или обводками. Они автоматически становятся обычным и активным эталонами; размеры образцов не меняют размеры кнопок. Прежние **Passive / Active** и **Normal / Active** также распознаются. Для каждой роли оставить один образец; если найдено несколько, выбрать нужные явно.
3. Выделить в Figma один или несколько фреймов экранов, popup, групп popup либо сами кнопки. Оформление и Override применяются только внутри текущего выделения; сохранённый состав экспорта, режим всей страницы и связанные popup не расширяют область. Для сохранения кастомной кнопки на том же экране выделить только остальные кнопки. Выбор текстового слоя или рисунка относится к ближайшему экрану или popup; выбор секции или Frame проекта охватывает его содержимое. Без выделения оформление недоступно. Раздел **«Оформление кнопок»** показывает область, число кнопок, образцы и план изменений. Для проверки и экспорта по-прежнему нужен экран или проект.
4. Выбрать **«Состояния обычных кнопок»**: **Off / On** для включения или выбора либо **Normal / Pressed** для нажатия и удержания. Если в макете есть готовые кнопки, выбрать **«Пропустить готовые кнопки»** либо **«Применить новый стиль и к готовым»** (Override). До выбора применение недоступно. При Override готовые двухсостояниевые `button_` / `btn_` также преобразуются в выбранную пару в обе стороны. Имена и роли сохранённых состояний обновляются вместе; ID самой кнопки, её слои, содержимое, геометрия и видимость сохраняются. В EXUI/GDL остаются слоты 0/1. При пропуске готовые кнопки сохраняются целиком. Затем нажать **«Применить оформление»**. Скругление образцов применяется только при включённой настройке.
5. В сообщении результата нажать **«Проверить и скачать .exui»**. Отдельные **«Проверить макет»** и **«Скачать .exui»** также доступны внизу. Ключи, роли и свободные ID заполняются обычным механизмом. Текущий CLI **0.7.3**, пакет **EXUI/5**, plugin ID и схемы metadata сохраняются.

Ручной выбор образцов находится в **«Выбрать образцы и фон вручную»**: выделить Rectangle или готовое состояние → **«Выбранное — обычный эталон»**, затем аналогично **«Выбранное — активный эталон»**. После назначения вернуться к экрану. Ссылки сохраняются на текущей странице и переживают перезапуск плагина/переименование образцов. Если явный эталон удалён, назначить новый; автоматической подмены нет. Цветные карточки показывают одну сплошную заливку и цвет обводки; сложная заливка подписывается текстом, её оформление переносится в Figma полностью.

| Префикс | Создаваемая пара |
|---|---|
| `button_` / `btn_` | **Off / On** или **Normal / Pressed** — по выбору в интерфейсе |
| `feedbackbutton_` / `fbtn_` | **Normal / Active** |

Off / Normal / Passive используют обычный эталон; On / Active / Feedback — активный. Сохранённый тип кнопки имеет приоритет над последующим переименованием. Дополнительный префикс `button_onoff_` не вводится.

Для **Normal / Pressed** выбрать эту пару перед применением оформления. Обычный эталон применяется к Normal, активный — к Pressed. Для **Normal / Active / Pressed** создать пару у `feedbackbutton_`, затем добавить и оформить третье состояние Pressed вручную. Выбор пары для обычных кнопок не меняет схему feedback-кнопок.

Исходное содержимое оборачивается в первую **Group**. Второе состояние — его копия с оформлением другого эталона. Внешняя Group остаётся Group, Frame остаётся Frame; исходные слои сохраняют свои ID, размеры и координаты. Если фон задан на внешнем Frame, его оформление переносится в Rectangle Background внутри первого состояния, внешний Frame становится прозрачным.

Если есть ровно одно состояние у обычной кнопки, оно приводится к выбранной паре и добавляется недостающее. У готовых двухсостояниевых обычных кнопок Override также меняет пару; при пропуске имена, роли и оформление сохраняются. Число готовых состояний не меняется. У feedbackbutton_ / fbtn_ третье состояние Pressed добавляется вручную.

## Изменение оформления

Переносятся заливки, обводки, их цвета/прозрачность, толщина, положение и штриховка. Размеры, текст, иконки, шрифты не заменяются эталоном. Скругление переносится только при включённой настройке **«Использовать скругление образцов»**. Обычный и активный образцы должны визуально различаться.

После изменения образцов выбрать экран и нужную пару, отметить **«Применить новый стиль и к готовым»** и нажать **«Применить оформление»**. Обновляется фон normal/feedback/pressed; при включённой коррекции исправляются неконтрастные цвета текста и иконок. При смене пары обновляются имена, роли и внутренние назначения состояний; ключи и objectId/controlId кнопки, видимость и слои сохраняются. Слоты состояний в пакете остаются 0/1. Повторное применение не дублирует состояния. Операция входит в одну границу Undo; при сбое плагин восстанавливает дерево, назначения и оформление. Если все кнопки готовы и выбран пропуск, применение недоступно.

Фон — Rectangle или Frame, совпадающий с областью кнопки. У Frame состояния это может быть собственная заливка. Если подходящих слоёв несколько, выбрать нужный внутри кнопки или состояния, раскрыть **«Выбрать образцы и фон вручную»** и нажать **«Выбранный слой — фон»**. Выбор сохраняется на самом слое и переносится в копии. Повторное нажатие снимает отметку. Несогласованная структура блокируется до изменения первой кнопки.

## Экспорт и границы поддержки

- Начиная с 0.5.5 «Проверить макет», «Скачать .exui» и сохранение распознанных назначений автоматически оставляют одно видимое состояние. При нескольких видимых приоритет у обычного Off / Normal / Passive, если оно видно; иначе остаётся первое видимое. Если скрыты все, показывается обычное. Единственное выбранное On / Active / Pressed сохраняется. Распознавание без сохранения только показывает план. При других ошибках проверки слои не меняются, при сбое записи назначения и видимость восстанавливаются. Имена, оформление и ID сохраняются; экспортируются все состояния.

- Group поддерживаются у кнопки и её состояний. Страницы, popup, Slider и другие виды сохраняют свои прежние правила.
- Оформление составного состояния экспортируется в PNG размером с кнопку, включая заливки, обводки, иконки и скругления. Источник не переключается и не перестраивается при экспорте; временные копии удаляются и при ошибке.
- Один верхний непосредственный Text на всю площадь состояния, Arial Regular/Bold, Inter / Inter Display и с поддержанным CENTER / CENTER либо CENTER / BOTTOM сохраняется нативным редактируемым текстом Button. Тексты с другой геометрией, сложным оформлением или несколькими подписями остаются в PNG, чтобы не сдвигать авторский дизайн. В Figma они продолжают редактироваться.
- Одинаковые Inter-подписи, расположенные в отдельном прямоугольнике во всех состояниях, автоматически экспортируются одним редактируемым Label поверх кнопки. Их текст, шрифт, цвет, геометрия и выравнивание должны совпадать. Меняющиеся по состоянию или сложные подписи остаются в PNG. Отдельный Label не получает controlId и не следует за feedback/видимостью кнопки автоматически. [Правила](NATIVE_TEXT.md).
- Начиная с 0.7.0 заливка состояний с PNG прозрачная (`#00000000`): скругления и прозрачные участки PNG показывают то, что лежит под кнопкой, включая фоновое изображение страницы. Раньше под углами был виден однотонный цвет Frame страницы, например белый. Внешняя обводка за границей кнопки обрезается областью PNG; для полного сохранения контура использовать INSIDE.
- Каждое состояние должно совпадать с областью кнопки; координаты/размеры — целые пиксели. Auto layout у неподготовленной внешней кнопки нужно отключить. Изменять число состояний экземпляра компонента следует в его исходном компоненте; у готовых экземпляров обновляется оформление существующих normal/feedback/pressed.
- On/Active переключает программа управления Extron. Создание состояний не создаёт команды устройству или автоматическую обратную связь.

Проверки Figma API в тестах моделируются явно. Автоматические тесты и Chromium не подтверждают реальный рендер Figma Desktop, Verify / Save and Build GUI Designer или работу оборудования.

---

<a id="english"></a>

# Button styling and states — 0.8.4 preview

[Русский](#russian) · **English**

The plugin interface is in Russian; its labels are quoted as shown, followed by their English meaning.

On export, the coordinates and sizes of a button and its states are rounded to the nearest whole pixel: 218.21 → 218, 218.7 → 219, 218.5 → 219. The state PNGs get the same size as the button. The geometry of the source layers in Figma does not change; details inside the PNG keep their fractional values. After rounding, the states must cover the whole button and the button must fit the screen.

## Contrast when styling is applied

The **«Исправлять контраст текста и иконок»** (Fix text and icon contrast) setting is on by default. After the samples are transferred, every changed state, including the hidden On / Active, is checked separately: text needs at least 4.5:1, single-color artwork 3:1 by sRGB relative luminance. Colors with enough contrast are kept; solid fills and strokes without enough contrast become black or white. For example, a white Input 7 caption and a gold icon on a gold background become black. Text, geometry, layer names and IDs do not change. To keep the author's colors, turn the setting off before applying.

The correction applies only to the states that receive a sample. When skipped, existing buttons are kept entirely. When existing buttons are updated, Pressed, which receives the active sample, is checked too. The result shows the number of corrected layers. If contrast cannot be judged reliably (an image, gradient, mixed text fills, masks, effects, blend modes or transparency), that part is kept and counted among those needing a manual check. A semi-transparent single-color fill is evaluated by blending with the background; if black and white with the original transparency do not reach the threshold, a manual check is needed. This is a targeted check of button styling, not a confirmation of the full accessibility of the layout.

## One rule for new layouts

| Purpose | States | Prefix |
|---|---|---|
| Switching on or selecting: Power, Mute, zone, source | **Off / On** | `button_` / `btn_` |
| Pressing and holding: Volume + / −; an action or navigation: Back / Home / Settings | **Normal / Pressed** | `button_` / `btn_` |
| Selecting with a separate pressed look | **Normal / Active / Pressed** | `feedbackbutton_` / `fbtn_` |

This is the single naming scheme for new designs. The supported synonyms **Passive / Active**, **Normal / Active** without Pressed and other previously allowed sets are kept. The check and export keep existing assignments. An explicit Override in the styling of ordinary buttons converts the pair and updates the names and roles of the states; the IDs of the button itself are kept. Off / Normal / Passive have the normal role, On / Active / Feedback the feedback role; Pressed is a separate pressed role. A role cannot be duplicated within one button.

On / Active is set by the Extron control program, Pressed is the look while held. The names do not create AV commands, switch devices or repeat volume steps.

## Quick process

A selected `popup_`, `modalpopup_` or `popupgroup_` takes precedence for button styling **in every export mode**, including the saved «Выбранные фреймы» (Selected frames) and «Текущая страница» (Current page). Selecting a layer inside a popup refers to that popup. The project content for checking and export stays the same. The result message names the processed container, counts prepared and updated buttons and created states separately, and says so explicitly if nothing changed.

1. Draw the button as an ordinary **Group or Frame** directly inside the screen Frame. Name it `button_AudioControl` / `btn_AudioControl` or `feedbackbutton_Power` / `fbtn_Power`. A background, text and artwork inside are enough; separate states are not needed yet. Names like `Rectangle 11`, `Voice` and `txt_title.place` do not need to change.
2. Outside the screens, on the same Figma page, create a group or Frame named **Button Styles**. Inside it, put two ordinary **Rectangles**: **Off / On**, with different fills or strokes. They automatically become the normal and active samples; the sample size does not change the button size. The older **Passive / Active** and **Normal / Active** are recognized too. Keep one sample per role; if several are found, choose the ones you need explicitly.
3. In Figma, select one or more screen Frames, popups, popup groups or the buttons themselves. Styling and Override apply only within the current selection; the saved export content, the whole-page mode and linked popups do not widen the scope. To keep a custom button on the same screen, select only the other buttons. Selecting a text layer or artwork refers to the nearest screen or popup; selecting a section or a project Frame covers its content. Without a selection, styling is unavailable. The **«Оформление кнопок»** (Button styling) section shows the scope, the number of buttons, the samples and the planned changes. Checking and export still need a screen or project.
4. Choose **«Состояния обычных кнопок»** (States of ordinary buttons): **Off / On** for switching or selecting, or **Normal / Pressed** for pressing and holding. If the layout has existing buttons, choose **«Пропустить готовые кнопки»** (Skip existing buttons) or **«Применить новый стиль и к готовым»** (Apply the new style to existing ones too, i.e. Override). Applying is unavailable until you choose. With Override, existing two-state `button_` / `btn_` are also converted to the chosen pair in either direction. The names and roles of saved states are updated together; the button's own IDs, layers, content, geometry and visibility are kept. Slots 0/1 stay in the EXUI/GDL. When skipped, existing buttons are kept entirely. Then click **«Применить оформление»** (Apply styling). The samples' corner radius is applied only when that setting is on.
5. In the result message click **«Проверить и скачать .exui»** (Check and download .exui). The separate **«Проверить макет»** (Check layout) and **«Скачать .exui»** (Download .exui) are also available at the bottom. Keys, roles and free IDs are filled in by the usual mechanism. Current CLI **0.7.3**; the **EXUI/5** package, the plugin ID and the metadata schemas are kept.

Manual sample selection is in **«Выбрать образцы и фон вручную»** (Choose samples and background manually): select a Rectangle or an existing state → **«Выбранное — обычный эталон»** (Selection is the normal sample), then likewise **«Выбранное — активный эталон»** (Selection is the active sample). After assigning, go back to the screen. The links are saved on the current page and survive a plugin restart and renaming of the samples. If an explicit sample is deleted, assign a new one; there is no automatic substitute. The color cards show one solid fill and the stroke color; a complex fill is labeled with text, and its styling is transferred in Figma in full.

| Prefix | Pair created |
|---|---|
| `button_` / `btn_` | **Off / On** or **Normal / Pressed** — as chosen in the interface |
| `feedbackbutton_` / `fbtn_` | **Normal / Active** |

Off / Normal / Passive use the normal sample; On / Active / Feedback the active one. The saved button type takes precedence over later renaming. No extra `button_onoff_` prefix is introduced.

For **Normal / Pressed**, choose this pair before applying the styling. The normal sample is applied to Normal, the active one to Pressed. For **Normal / Active / Pressed**, create the pair on a `feedbackbutton_`, then add and style the third Pressed state by hand. Choosing the pair for ordinary buttons does not change the scheme of feedback buttons.

The source content is wrapped into the first **Group**. The second state is its copy with the styling of the other sample. An outer Group stays a Group, a Frame stays a Frame; the source layers keep their IDs, sizes and coordinates. If the background is set on the outer Frame, its styling moves into a Rectangle Background inside the first state, and the outer Frame becomes transparent.

If an ordinary button has exactly one state, it is converted to the chosen pair and the missing state is added. For existing two-state ordinary buttons, Override also changes the pair; when skipped, names, roles and styling are kept. The number of existing states does not change. For feedbackbutton_ / fbtn_, the third Pressed state is added by hand.

## Changing the styling

Fills, strokes, their colors/transparency, weight, position and dashes are transferred. Sizes, text, icons and fonts are not replaced by the sample. Corner radius is transferred only when **«Использовать скругление образцов»** (Use the samples' corner radius) is on. The normal and active samples must look different.

After changing the samples, select the screen and the pair you need, tick **«Применить новый стиль и к готовым»** (Apply the new style to existing ones too) and click **«Применить оформление»** (Apply styling). The normal/feedback/pressed background is updated; with correction on, text and icon colors without enough contrast are fixed. When the pair changes, the names, roles and internal state assignments are updated; the button's keys and objectId/controlId, visibility and layers are kept. The state slots in the package stay 0/1. Applying again does not duplicate states. The operation is a single Undo step; on failure the plugin restores the tree, assignments and styling. If all buttons are ready and skip is chosen, applying is unavailable.

The background is a Rectangle or Frame that matches the button area. For a state Frame, it can be its own fill. If several layers fit, select the one you need inside the button or state, open **«Выбрать образцы и фон вручную»** (Choose samples and background manually) and click **«Выбранный слой — фон»** (Selected layer is the background). The choice is saved on the layer itself and carried into copies. Clicking again removes the mark. An inconsistent structure is blocked before the first button is changed.

## Export and support limits

- Since 0.5.5, «Проверить макет» (Check layout), «Скачать .exui» (Download .exui) and saving recognized assignments automatically leave one visible state. If several are visible, the ordinary Off / Normal / Passive wins if it is visible; otherwise the first visible one stays. If all are hidden, the ordinary one is shown. A single chosen On / Active / Pressed is kept. Recognition without saving only shows the plan. On other check errors the layers do not change; if writing fails, assignments and visibility are restored. Names, styling and IDs are kept; all states are exported.
- Groups are supported for the button and its states. Pages, popups, Slider and other kinds keep their existing rules.
- The styling of a composite state is exported to a PNG the size of the button, including fills, strokes, icons and corner radii. The source is not switched or rebuilt during export; temporary copies are removed even on error.
- One top-level direct Text covering the whole state area, in Arial Regular/Bold or Inter / Inter Display, with a supported CENTER / CENTER or CENTER / BOTTOM, is kept as native editable Button text. Texts with other geometry, complex styling or several captions stay in the PNG so as not to shift the author's design. They remain editable in Figma.
- Identical Inter captions placed in a separate rectangle in all states are automatically exported as one editable Label on top of the button. Their text, font, color, geometry and alignment must match. Captions that change per state or are complex stay in the PNG. The separate Label gets no controlId and does not follow the button's feedback/visibility automatically. [Rules](NATIVE_TEXT.md#english).
- Since 0.7.0, the fill of states with a PNG is transparent (`#00000000`): corner radii and transparent PNG areas show what is under the button, including the page background image. Before, the solid color of the page Frame, for example white, showed under the corners. An outer stroke beyond the button edge is clipped by the PNG area; to keep the whole outline, use INSIDE.
- Each state must match the button area; coordinates/sizes are whole pixels. Turn off Auto layout on an unprepared outer button. Change the number of states of a component instance in its main component; for existing instances, the styling of the existing normal/feedback/pressed states is updated.
- On/Active is switched by the Extron control program. Creating states does not create device commands or automatic feedback.

Figma API checks are simulated explicitly in the tests. Automated tests and Chromium do not confirm the real Figma Desktop rendering, GUI Designer Verify / Save and Build or hardware behavior.

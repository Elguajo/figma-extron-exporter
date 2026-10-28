<a id="russian"></a>

# Редактируемый Inter — плагин и CLI 0.5.0

**Русский** · [English](#english)

Оставьте обычный Text с именем `txt_Title` / `text_Title`. Выберите Inter или Inter Display, затем «Проверить макет» → «Скачать .exui». Конвертируйте обновлённым CLI 0.5.0. В GUI Designer подпись будет Label с редактируемыми Text, Font, Font Style и Font Size; Use Flattened Text остаётся False.

CLI содержит неизменённую статическую коллекцию Inter 4.1 под SIL OFL. Она добавляется в GDL один раз, только когда используется. На компьютере с GUI Designer устанавливать Inter отдельно не нужно. Плагин не скачивает файлы шрифтов и не передаёт исполняемые данные; EXUI содержит только имена и параметры текста.

Поддержаны Thin, Extra Light, Light, Regular, Medium, Semi Bold, Bold, Extra Bold, Black и их курсивы — 18 начертаний каждого семейства. Для Label, Value и DateTime доступны девять сочетаний Left/Center/Right и Top/Center/Bottom. Value и DateTime сохраняют обновляемое содержимое. Arial Regular/Bold работает по прежнему пути.

В GUI Designer промежуточные веса могут отображаться в поле Font как отдельные Windows-семейства, например Inter Medium или Inter SemiBold, со стилем Regular/Italic. Это сохраняет выбранный вес; Regular/Bold используют семейство Inter.

Нативный текст требует одного начертания внутри Text, одной непрозрачной SOLID-заливки и Opacity слоя 100%, размера 4..200 pt, нулевого letter spacing, без преобразования регистра/декораций. Figma может возвращать стандартное начертание как variable font: штатные значения веса 100…900, optical size 14 (Inter) / 32 (Inter Display) и стандартного наклона принимаются. Промежуточные веса, другой optical size или произвольные оси сохраняются только в PNG. Эффекты, маски и повороты проверяются по прежним ограничениям.

С 0.7.0 полупрозрачный текст (непрозрачность заливки или слоя меньше 100%) останавливает проверку с указанием слоя и способа исправления. Раньше в зависимости от случая выдавалась общая ошибка opacity либо подпись молча превращалась в PNG. GUI Designer умеет хранить альфу цвета текста, но её вид на панели и в GCP не проверен, поэтому она не экспортируется. Цвет текста может быть любым непрозрачным `#RRGGBB`. Подписи, которые по другим причинам остаются частью PNG кнопки, не затрагиваются.

Размер в Figma переводится из px в pt по прежнему правилу ×0.75. Координаты и размеры нативного объекта целые; дробная геометрия статической подписи сохраняется в PNG. Figma-слой и его назначения при экспорте не меняются. CLI содержит Inter версии 4.1: если в Figma используется другая версия, метрики могут немного различаться; проверить окончательную компоновку в GUI Designer.

GUI Designer рисует Inter через GDI: без кернинга, с округлёнными ширинами символов и строкой 1.21 em. Поэтому рамка отдельного Label с Inter при экспорте расширяется: по ширине на max(0.75 em, 6 %), по высоте до числа строк × 1.21 em + 0.25 em. Расширение идёт от точки выравнивания (Left/Right — в одну сторону, Center — симметрично) и не выходит за кнопку или холст. Текст с фиксированной шириной и Auto height, который Figma переносит сам, расширяется только на 0.25 em, чтобы переносы остались на месте. Arial сохраняет прежнюю геометрию.

## Подписи кнопок

- **Редактируемая подпись — button_ / btn_, feedbackbutton_ / fbtn_.** Префикс сам выбирает нативный Text состояний Button. Применять команду текста для этого не требуется. Фон и иконки могут оставаться PNG, но подпись исключается из временной PNG-копии и записывается в сам Button. Отдельный Label поверх кнопки не создаётся.
- Поддержана одна непустая видимая подпись на состояние, включая вложенный Text внутри Artwork; пустые заполнители кита игнорируются. Содержимое и цвет могут различаться по состояниям, шрифт общий. Кнопки только с иконкой работают без обязательного Text.
- По умолчанию подпись по центру всей кнопки. Для Text-рамки на всю кнопку сохраняется Bottom. Сохранённые явные Auto / Middle-Center / Bottom-Center продолжают выбирать выравнивание; сброс настройки возвращает нативный текст, а не PNG или отдельный Label. Произвольные координаты текста в GDL не обещаются.
- Несколько непустых Text, неподдержанный шрифт, маски или преобразования в цепочке подписи останавливают проверку с указанием слоя и предложением imagebutton_ / ibtn_. Обычная кнопка не превращает неподдержанную подпись в картинку молча.
- **Состояние целиком в PNG — imagebutton_ / ibtn_.** Фон, иконки и подписи сохраняют расположение из Figma. Text состояний Button пустой, отдельные Label не создаются. Кнопка сохраняет управляющий ID и состояния; Text Feedback не заменяет нарисованную подпись.
- imagebutton_ / ibtn_ имеют приоритет над сохранённым выравниванием. Переименование с сохранением части имени не меняет ID и назначенный тип. Возврат к button_ снова включает нативный текст. Новые и старые макеты используют одинаковое правило при следующем экспорте; существующие GDL/GCP автоматически не изменяются.

Другие семейства и смешанное сложное оформление статического текста продолжают автоматически экспортироваться в PNG без ручного Frame. Нативная поддержка произвольных шрифтов не объявляется: каждому семейству нужен доступный ресурс и отдельная проверка. Неподдержанный шрифт Value/DateTime вызывает понятную ошибку, чтобы обновляемый текст не стал неподвижной картинкой.

## Текст по центру и иконка сбоку

Для новых кнопок с нативной подписью принят основной вариант: **текст по центру всей кнопки (Middle-Center), иконка слева или справа внутри Artwork каждого состояния**. Это основной вариант для обычных кнопок без сохранённого выравнивания. Для изменения откройте «Выравнивание текста кнопок»; исходные слои не перемещаются.

Текст центрируется по всей ширине Button. Соседняя иконка слева или справа от текстовой рамки (в том же ряду, не дальше двух размеров шрифта) сдвигается в экспортном PNG вслед за подписью, сохраняя зазор. Для Inter добавляется запас под метрики GDI. Это относится к компактным иконкам размером до половины ширины кнопки; отдалённый декор и иконки над подписью остаются на своих местах. Если сдвинутая иконка выходит за кнопку, проверка просит увеличить кнопку или уменьшить содержимое. В Figma слои не перемещаются; controlId остаётся у одного Button, отдельный Label не создаётся.

Во временной копии подпись и прежнее место перемещённой иконки сохраняют размеры с Opacity 0: Auto Layout не схлопывает ряд. Иконка входит в PNG состояния и не имеет отдельного controlId. После экспорта её положение фиксировано; для Text Feedback проверяйте самое длинное реальное значение во всех состояниях. `imagebutton_` / `ibtn_` сохраняют исходное расположение целиком в PNG.

**Граница продукта:** GUI Designer 1.28.0.7 имеет девять сочетаний Text Alignment (верх / середина / низ x лево / центр / право). Текущий плагин использует для нативного текста Button только Middle-Center и Bottom-Center; Label / Value / DateTime поддерживают девять. Bottom-Center под иконкой остаётся допустимой альтернативой. Верхнее положение Button не поддержано текущим режимом экспорта, хотя есть в GUI Designer.

[Схемы и префиксы PDF](../../docs/prefix_map/figma-extron-prefix-cheatsheet.pdf) · [Подробные сценарии PDF](../../docs/prefix_map/figma-extron-use-cases.pdf) · [Проверка](../../docs/verification/results/2026-10-25-product-guides.md).

## Совместимость

### Автоматически из Figma (плагин 0.8.2)

В блоке «Выравнивание текста кнопок» можно выбрать режим «Автоматически из Figma» вместо нативного выравнивания по умолчанию. Один раз примените его к выделенным кнопкам, экрану или popup; положение каждой подписи будет вычисляться при каждом экспорте. Новые кнопки включаются при повторном применении к области. Ранее сохранённые ручные режимы действуют, пока не применён автоматический режим.

Используется геометрия Text-рамки относительно состояния кнопки. Её вертикальный центр сравнивается с верхом, серединой и низом кнопки: ближайшая середина даёт Middle-Center, ближайший низ — Bottom-Center. Настройки абзаца Text (Left / Center / Right / Justified и Top / Center / Bottom) намеренно игнорируются: в GDL горизонтальное выравнивание всегда Center. Смещённая по горизонтали рамка также центрируется при экспорте. Рамка на всю кнопку означает Middle-Center независимо от абзаца; чтобы получить низ автоматически, разместите короткую рамку внизу. Точное произвольное положение и отступы Figma не воспроизводятся.

Рамка должна полностью находиться внутри кнопки. Верхнее положение и равное расстояние между якорями вызывают ошибку с указанием Text-слоя; выберите ручной режим либо переместите рамку. Проверка всей области выполняется до записи настроек. Позиции допускают обычное округление до целых пикселей экспорта. Слои Figma не перемещаются; текст остаётся частью состояния Button, без Label и текста в PNG.

Режим сохраняется как `auto` в прежнем ключе `exui-button-native-text`. Его читает плагин 0.8.2 или новее; старый плагин отклонит неизвестный режим. Чтобы вернуться к 0.8.1, сначала примените ручное выравнивание или «По умолчанию — редактируемый текст» новым плагином. EXUI/5 не изменён; используйте CLI 0.8.2 (подходит и 0.8.1). Автоматический режим не меняет уже созданные EXUI/GDL/GCP: нужен повторный экспорт.

### Текст кнопок для GCP (0.8.0)

Прежние версии могли создавать отдельный Label поверх кнопки. Текущий экспорт больше этого не делает: Text Feedback работает с подписью самого Button.

Выделите нужные кнопки, экран или popup и откройте **«Выравнивание текста кнопок»**. Выберите **«Снизу по центру»** для подписи под иконкой либо **«По центру»**, затем **«Применить выравнивание»**. При следующем экспорте подпись исключается из временного PNG и записывается в Text каждого состояния Button. Дополнительный Label не создаётся. Фон, иконки, ID, имена, исходные Text и их геометрия в Figma сохраняются; положение текста в GDL определяется выбранным режимом. Перед отправкой на панель проверьте компоновку в GUI Designer.

Поддержана одна непустая видимая подпись в каждом подготовленном состоянии, в том числе внутри Artwork. Пустой Text-заполнитель кита не считается второй подписью. Содержимое и цвет могут различаться, шрифт общий. Кнопки без текста пропускаются. Несколько подписей, неподдержанный шрифт, маски или преобразования в цепочке подписи останавливают операцию до записи настроек. При ошибке записи прежние настройки восстанавливаются.

Настройка действует только в выбранной области, хранится отдельно от ID в plugin data кнопки (`exui-button-native-text`) и учитывается при проверке изменений во время экспорта. Для отмены выберите **«По умолчанию — редактируемый текст»** и примените. Старые макеты без настройки теперь тоже экспортируют нативный текст Button. Схема EXUI/5 и CLI не меняются; используйте CLI 0.8.0. Старый плагин игнорирует эту настройку, поэтому повторный экспорт нужно выполнять версией 0.8.0 или новее.

Уже созданные GDL/GCP автоматически не изменяются: после настройки экспортируйте новый EXUI, создайте новый GDL и выполните Save and Build в GUI Designer. Обновление настроенного GCP выполняйте с сохранением назначений по [инструкции](../../docs/updating-configured-projects.md).

Обновить **оба компонента** до 0.5.0. EXUI/5, plugin ID, metadata и ключи/ID исходных объектов сохраняются. Новый CLI читает прежние EXUI/5. CLI 0.4.0 отклоняет новые шрифты и поле textAlign; архивы прежних версий остаются неизменными. Ранее экспортированный PNG не превращается обратно в текст — нужно повторно экспортировать исходный Text из Figma.

---

<a id="english"></a>

# Editable Inter — plugin and CLI 0.5.0

[Русский](#russian) · **English**

The plugin interface is in Russian; its labels are quoted as shown, followed by their English meaning.

Keep an ordinary Text named `txt_Title` / `text_Title`. Choose Inter or Inter Display, then «Проверить макет» (Check layout) → «Скачать .exui» (Download .exui). Convert with the updated CLI 0.5.0. In GUI Designer the caption becomes a Label with editable Text, Font, Font Style and Font Size; Use Flattened Text stays False.

The CLI contains the unmodified static Inter 4.1 collection under the SIL OFL. It is added to the GDL once, only when used. You do not need to install Inter separately on the computer with GUI Designer. The plugin does not download font files or pass executable data; the EXUI contains only the names and parameters of the text.

Supported styles are Thin, Extra Light, Light, Regular, Medium, Semi Bold, Bold, Extra Bold, Black and their italics — 18 styles per family. Label, Value and DateTime offer nine combinations of Left/Center/Right and Top/Center/Bottom. Value and DateTime keep their updatable content. Arial Regular/Bold works as before.

In GUI Designer, intermediate weights may appear in the Font field as separate Windows families, for example Inter Medium or Inter SemiBold, with the Regular/Italic style. This keeps the chosen weight; Regular/Bold use the Inter family.

Native text needs one style within the Text, one opaque SOLID fill and 100% layer Opacity, a size of 4..200 pt, zero letter spacing, and no case transformation or decorations. Figma may report a standard style as a variable font: standard weight values 100…900, optical size 14 (Inter) / 32 (Inter Display) and the standard slant are accepted. Intermediate weights, another optical size or arbitrary axes are kept only in PNG. Effects, masks and rotation are checked under the existing limits.

Since 0.7.0, semi-transparent text (fill or layer opacity below 100%) stops the check and names the layer and how to fix it. Before, depending on the case, a generic opacity error was shown or the caption silently became a PNG. GUI Designer can store the alpha of a text color, but how it looks on the panel and in GCP is not verified, so it is not exported. The text color can be any opaque `#RRGGBB`. Captions that stay part of a button PNG for other reasons are not affected.

The size in Figma is converted from px to pt with the same ×0.75 rule. Coordinates and sizes of the native object are integers; the fractional geometry of a static caption is kept in PNG. The Figma layer and its assignments do not change on export. The CLI contains Inter version 4.1: if Figma uses another version, the metrics may differ slightly; check the final layout in GUI Designer.

GUI Designer draws Inter through GDI: without kerning, with rounded glyph widths and a line height of 1.21 em. That is why the frame of a separate Inter Label is enlarged on export: in width by max(0.75 em, 6%), in height to the number of lines × 1.21 em + 0.25 em. The enlargement starts from the alignment point (Left/Right — to one side, Center — symmetrically) and does not go beyond the button or the canvas. Text with a fixed width and Auto height, which Figma wraps itself, is enlarged by only 0.25 em so that the line breaks stay in place. Arial keeps the previous geometry.

## Button captions

- **Editable captions — button_ / btn_, feedbackbutton_ / fbtn_.** The prefix selects native state Text on Button without applying a text command. Backgrounds and icons may use PNGs; captions are omitted only from temporary PNG copies. No separate caption Label is created.
- One nonempty visible Text per state is supported, including nested Artwork captions; blank Kit placeholders are ignored. Content and color may differ by state, with one shared font. Icon-only buttons do not require dummy Text.
- Default alignment is Middle-Center; a full-area Bottom caption retains Bottom-Center. Saved Auto / Middle-Center / Bottom-Center settings still control alignment. Resetting a setting keeps native text. Arbitrary caption positions are not reproduced in GDL.
- Multiple captions, unsupported fonts, masks or transforms on the caption path cause a contextual error suggesting imagebutton_ / ibtn_; ordinary buttons never silently rasterize the caption.
- **Whole-state PNG — imagebutton_ / ibtn_.** Backgrounds, icons and captions retain the authored composition. Button state Text is empty and there are no separate caption Labels. IDs and states remain; Text Feedback cannot replace raster captions.
- The image prefix overrides saved alignment. Renaming with the same suffix preserves IDs and the assigned button type. Returning to button_ restores native text. The rule applies to new and saved layouts on the next export; existing GDL/GCP files are not changed automatically.

Other families and mixed complex styling of static text are still exported to PNG automatically without a manual Frame. Native support for arbitrary fonts is not claimed: each family needs an available resource and its own check. An unsupported Value/DateTime font causes a clear error so that updatable text does not become a frozen picture.

## Centered text with an icon at the side

For new buttons, the recommended composition is **native text centered on the whole Button (Middle-Center), with an icon on the left or right inside each state's Artwork**. This is the default for ordinary buttons without saved alignment. Use the alignment section to change it; source layers are not repositioned.

Text is centered on the whole Button. An adjacent inline icon on either side of its text box (within two font sizes) follows the caption in the exported PNG, preserving the gap and adding room for Inter's GDI metrics. This applies to compact icons up to half the button width; distant decorations and icons above the caption stay in place. An icon that would leave the button produces a contextual layout error. Source layers and the single Button controlId stay intact; no separate Label is created.

In the temporary copy, the caption and the moved icon's original slot retain their sizes at Opacity 0, preventing Auto Layout reflow. Icons remain part of each state PNG and have no controlId. Their exported positions are fixed, so check the longest actual Text Feedback value in every state. `imagebutton_` / `ibtn_` retain the complete original artwork layout.

GUI Designer 1.28.0.7 has all nine Text Alignment combinations (top/middle/bottom x left/center/right). The current plugin's native Button mode exports Middle-Center or Bottom-Center; Label / Value / DateTime support all nine. Bottom-Center below an icon remains an alternative; top-aligned Button text is not supported by the current plugin mode.

[Prefix/layout PDF](../../docs/prefix_map/figma-extron-prefix-cheatsheet.pdf) · [Detailed use cases PDF](../../docs/prefix_map/figma-extron-use-cases.pdf).

## Compatibility

### Automatic from Figma (plugin 0.8.2)

In the «Выравнивание текста кнопок» (Button text alignment) block, you can select «Автоматически из Figma» (Automatic from Figma) instead of the default native alignment. Apply it once to the selected buttons, screen or popup; the position of each caption is then calculated on every export. New buttons are included when you apply the mode to the area again. Earlier saved manual modes stay in effect until the automatic mode is applied.

The geometry of the Text frame relative to the button state is used. Its vertical center is compared with the top, middle and bottom of the button: the nearest middle gives Middle-Center, the nearest bottom gives Bottom-Center. The Text paragraph settings (Left / Center / Right / Justified and Top / Center / Bottom) are deliberately ignored: in the GDL the horizontal alignment is always Center. A horizontally shifted frame is centered on export too. A frame covering the whole button means Middle-Center regardless of the paragraph; to get the bottom automatically, place a short frame at the bottom. An exact arbitrary position and Figma padding are not reproduced.

The frame must be fully inside the button. A top position and an equal distance between anchors cause an error that names the Text layer; choose a manual mode or move the frame. The whole area is checked before the settings are written. Positions allow the usual rounding to whole export pixels. Figma layers are not moved; the text stays part of the Button state, without a Label and without text in the PNG.

The mode is saved as `auto` under the existing `exui-button-native-text` key. It is read by plugin 0.8.2 or newer; an older plugin refuses the unknown mode. To go back to 0.8.1, first apply a manual alignment or «По умолчанию — редактируемый текст» (Default editable text) with the new plugin. EXUI/5 did not change; use CLI 0.8.2 (0.8.1 also works). The automatic mode does not change EXUI/GDL/GCP files that already exist: export again.

### Button text for GCP (0.8.0)

Earlier versions could create a separate caption Label. Current exports keep editable captions on Button itself.

Select the buttons, screen or popup and open **«Выравнивание текста кнопок»** (Button text for GCP). Choose **«Снизу по центру»** (Bottom center) for a caption below the icon or **«По центру»** (Center), then **«Применить выравнивание»** (Apply text for GCP). On the next export, the caption is excluded from the temporary PNG and written into the Text of every Button state. No extra Label is created. The background, icons, IDs, names, source Texts and their geometry in Figma are kept; the position of the text in the GDL is set by the chosen mode. Check the layout in GUI Designer before sending it to the panel.

One non-empty visible caption per prepared state is supported, including inside Artwork. The empty Text placeholder of the kit does not count as a second caption. Content and color may differ; the font is shared. Buttons without text are skipped. Several captions, an unsupported font, masks or transformations in the caption's chain stop the operation before the settings are written. If writing fails, the previous settings are restored.

The setting applies only to the selected area, is stored separately from the IDs in the button's plugin data (`exui-button-native-text`) and is taken into account when changes are checked during export. To undo, choose **«По умолчанию — редактируемый текст»** (Default editable text) and apply. Saved layouts without the setting also use native Button text. The EXUI/5 schema and the CLI do not change; use CLI 0.8.0. An older plugin ignores this setting, so export again with version 0.8.0 or newer.

GDL/GCP files that already exist are not changed automatically: after the setup, export a new EXUI, create a new GDL and run Save and Build in GUI Designer. Update a configured GCP keeping its assignments by following the [guide](../../docs/updating-configured-projects.md#english).

Update **both components** to 0.5.0. EXUI/5, the plugin ID, metadata and the keys/IDs of the source objects are kept. The new CLI reads earlier EXUI/5 packages. CLI 0.4.0 refuses the new fonts and the textAlign field; archives of earlier versions stay unchanged. A previously exported PNG does not turn back into text — export the source Text from Figma again.

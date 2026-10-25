<a id="russian"></a>

# Префиксы слоёв Figma → Extron

**Русский** · [English](#english)

Актуализация 25.10.2026: плагин 0.8.4 preview, CLI 0.8.3, EXUI/5. Регистр букв не важен: `btn_volumeup`, `btn_VolumeUp` и `BUTTON_VOLUMEUP` равнозначны. Короткий и полный префиксы дают один и тот же тип элемента. Сохранённые назначения имеют приоритет над новым именем. Старый архив 0.2.2 ещё требует Off / On либо Normal / Active / Pressed.

Кнопки и состояния могут быть Group или Frame. Для готового дизайна: задать обычный/активный образцы → выбрать экран → «Оформление кнопок → Применить оформление». Для button_/btn_ выберите Off/On либо Normal/Pressed, feedbackbutton_/fbtn_ создаёт Normal/Active; фон готовых состояний обновляется тем же действием только после явного выбора обновления вместо пропуска. Третье состояние добавляется вручную. [Полная инструкция](BUTTON_STATES.md). Описанная ниже строгая схема Text + Frame-иконка остаётся вариантом нативного текста; составное оформление групп поддерживает произвольную графику через PNG.

[Таблица «что это и для чего использовать»](../../docs/figma-prefix-reference.md) · [Шпаргалка в PDF](../../docs/prefix_map/figma-extron-prefix-cheatsheet.pdf).

## Текст с иконкой

Для новых кнопок: **нативный текст по центру всей кнопки, иконка слева или справа в Artwork**. Примените «Текст кнопок для GCP» > «По центру». Оставьте симметричный резерв с обеих сторон под самое длинное значение Text Feedback. icon_ входит в PNG состояния и не получает controlId. Текущий плагин экспортирует для текста Button центр / низ по центру; GUI Designer имеет девять сочетаний. [Подробности и ограничения](NATIVE_TEXT.md).

## Элементы экрана

| Что рисуем | Короткое имя | Полное имя | Что получится и как подготовить |
|---|---|---|---|
| Проект целиком | `prj_Trilliant` | `project_Trilliant` | Секция с любым именем либо внешний Frame с этим префиксом. Внутри — Frame страниц, popup и групп popup. Размер контейнера произвольный. |
| Экран | `Home` или `scr_Home` | `screen_Home` | Внешний Frame 1280×800 или 320×480. Отдельный экран либо страница внутри проекта. |
| Обычная кнопка | `btn_Music` | `button_Music` | Group или Frame → PBButton. Для нового макета: **Off / On** — включение или выбор, **Normal / Pressed** — нажатие и удержание. В оформлении выбирается Off / On либо Normal / Pressed. Passive / Active также поддерживается. |
| Кнопка с feedback | `fbtn_Music` | `feedbackbutton_Music` | Для нового макета: **Normal / Active / Pressed** — выбор с отдельным видом нажатия. По эталонам создаётся Normal / Active, Pressed добавить вручную. Normal / Active без Pressed и прежние синонимы остаются совместимыми. |
| Увеличить громкость | `btn_VolumeUp` | `button_VolumeUp` | Кнопка «+»: Normal / Pressed. Для трёх состояний — `fbtn_VolumeUp`. |
| Уменьшить громкость | `btn_VolumeDown` | `button_VolumeDown` | Кнопка «−»: Normal / Pressed. Для трёх состояний — `fbtn_VolumeDown`. |
| Заглушить звук | `btn_Mute` | `button_Mute` | Off + On. Для Normal + Active + Pressed — `fbtn_Mute` / `feedbackbutton_Mute`. |
| Ползунок громкости | `lvl_Volume` | `level_Volume` | Горизонтальный PBLevel Slider 0–100. Пустой Frame с одной сплошной заливкой. |
| Надпись | `txt_Title` | `text_Title` | Самостоятельный Text → PBLabel для Arial Regular/Bold, Inter / Inter Display; девять выравниваний. Другие семейства и сложное оформление → PNG/PBImage автоматически, без Frame. |
| Значение громкости | `txt_VolumeValue` | `text_VolumeValue` | Статическая подпись, например «42%». Автоматическая динамическая привязка не создаётся. |
| Логотип | `logo_Company` | `logo_Company` | Отдельный Frame внутри экрана → PNG-ресурс и объект PBImage. Состояния и ID управления не нужны. |
| Фото, иллюстрация, статичная графика | `img_Photo` | `image_Photo` | Такой же PBImage. Внутрь Frame поместить нужную графику; она экспортируется одним PNG. |
| Иконка состояния кнопки | `Icon` или `ico_Music` | `icon_Music` | Frame **внутри состояния кнопки**. PNG-ресурс этого состояния; не отдельный объект экрана. |
| Обычный popup | `pop_Sources` | `popup_Sources` | Frame внутри проекта. Свой размер, место задаёт popupref. |
| Модальный popup | `mdl_Confirm` | `modalpopup_Confirm` | Frame внутри проекта, размером с панель. Можно также выбрать «Модальный popup: Да» у popup через форму. Затемнение — заливкой самого Frame с прозрачностью Fill и флажком «Экспортировать фон Frame». |
| Группа popup | `pgrp_Zones` | `popupgroup_Zones` | Организационный Frame внутри проекта; внутри обычные popup одинакового размера. В GUI Designer — группа, её участники взаимоисключающие. |
| Место popup | `pr_Sources` | `popupref_Sources` | Пустой Frame на странице; размер точно совпадает с popup. С 0.7.0 при первом распознавании находит соседний popup или popupgroup с таким же окончанием имени; при нескольких совпадениях цель выбирается через форму. Сохранённая связь имеет приоритет. |
| Кастомный ползунок | `sld_Volume` | `slider_Volume` | Frame без фона, внутри Track, Fill, Thumb. Нативный PBSlider, оформление остаётся редактируемым. |
| Индикатор уровня | `gau_Signal` | `gauge_Signal` | Пустой Frame с заливкой. PBLevel Gauge; показывает значение. |
| Индикатор значения | `ind_Status` | `indicator_Status` | Тот же PBLevel Gauge; не отдельная лампа или переключатель. |
| Светодиодная шкала | `led_Audio` | `volumeled_Audio` | Пустой Frame с заливкой → PBLevel VolumeLED. |
| Уровень с несколькими видами | `mlvl_Status` | `multilevel_Status` | Frame без фона, внутри 2–8 состояний с Text, начиная с Normal. PBLevel MultistateLevel; Pressed не используется. |
| Обновляемая подпись | `val_VolumeValue` | `value_VolumeValue` | Text → PBLabel с управляющим ID. Исходный текст «42%»; обновляет программа управления. |
| Фигура | `shp_Card` | `shape_Card` | Пустой Frame/Rectangle/Ellipse → PBShape. Заливка, одинаковые скругления углов и одна внутренняя SOLID-обводка. |
| Линия | `ln_Divider` | `line_Divider` | С 0.3.4: прямая горизонтальная/вертикальная Pen (Vector) или Line с одним SOLID Stroke CENTER, плоские окончания. Либо прежний пустой Frame/Rectangle без скруглений и обводки: меньшая сторона — толщина. Нативный PBLine, без PNG. |
| Дата и время | `dt_Clock` | `datetime_Clock` | Готовый компонент из Extron Kit (свойство **Format**, 28 форматов) либо Text с примером из каталога, например `September 28, 12:00 AM`, либо Text с самим форматом `HH:mm` → PBDateTime. [Подробнее](AUTHORING_STANDARD.md#дата-и-время) |


Элементы располагаются непосредственно в Frame страницы или popup. Иконки — внутри состояния; Track/Fill/Thumb — внутри Slider. Страницы и popup объединяются Frame проекта, обычные popup можно вложить в Frame группы. `logo_` — уже полное слово, дополнительного сокращения нет. `logo_Company`, `img_Company` и `image_Company` означают одну статичную картинку: одновременно использовать эти имена на одном экране нельзя.

`button_Music` означает «кнопка с функцией Music», но не выбирает аудиоустройство автоматически. Увеличение/уменьшение громкости, шаг, повтор при удержании, Mute и обратную связь реализует программа управления Extron.

## Состояния кнопки

| Имя Frame внутри кнопки | Допустимые варианты | Для чего |
|---|---|---|
| `Normal` | `Off`, `Passive`; также с `st_` / `state_` | Исходный вид. |
| `On` | `Active`, `Feedback`; также с `st_` / `state_` | Вид по команде программы управления, например Mute включён. |
| `state_Ready`, `state_Error`, `state_Disabled` | `st_Ready`, `st_Error`, `st_Disabled` | Дополнительные виды feedback: общий лимит 8 состояний. Disabled — только внешний вид; блокировку нажатия задаёт программа. |
| `Pressed` | `st_Pressed`, `state_Pressed` | Вид, пока кнопку удерживают; после отпускания возвращается обычный вид. |

Единое правило для новых макетов — выбирать схему по поведению кнопки:

| Схема | Где подходит | Нажатие и отпускание |
|---|---|---|
| **Normal + Pressed** | «+», «−», команды без постоянного On | При удержании Pressed, после отпускания Normal. |
| **Off + On** | Два состояния устройства без отдельного эффекта нажатия | On выбирает программа; отдельный Pressed не создаётся. |
| **Normal / Active / Pressed** | Mute/источник с обратной связью и эффектом удержания (`feedbackbutton_` / `fbtn_`) | Pressed при удержании; после отпускания вид соответствует обратной связи. Проверить с программой управления. |

Для готовых макетов Passive / Active, Normal / Active без Pressed, Off / On / Pressed и другие ранее поддержанные синонимы остаются совместимыми. Имена, оформление и ID автоматически не переписываются.

Для **новых** button_/btn_ нужны 2 состояния: одно normal и одно feedback либо pressed. Для feedbackbutton_/fbtn_ нужны normal и feedback; Pressed необязателен. Normal / Off / Passive — одна роль, On / Active / Feedback — одна роль; дублировать роли нельзя. Экспортируются только существующие состояния и их изображения, включая скрытые состояния; отсутствующее третье состояние не создаётся. Произвольные state_Ready/state_Error в прежних сохранённых назначениях поддерживаются как совместимость. Для предпросмотра выбирать состояние по имени и ID в плагине. Видно ровно одно состояние; каждый Frame занимает всю кнопку, внутри один Text на всю площадь и необязательная иконка. Text может быть ровно пустым для отдельных нативных подписей; пробельная строка запрещена. Шрифт общий, виды различаются текстом, цветом или изображением.

Пример «+», жёлтая при удержании:

```text
Home
├── button_VolumeUp
│   ├── Normal                 Frame, обычная заливка, видим
│   │   └── Text               Text «+», на всю кнопку
│   └── Pressed                Frame, жёлтая заливка, скрыт в preview
│       └── Text               Text «+», на всю кнопку
└── logo_Company               Frame, внутри графика логотипа
```

Жёлтый цвет задаёт дизайнер, например `#FFCC00`. Плагин сохраняет оформление, но не перекрашивает состояние по имени Pressed.

## Имена, зоны и ID

После префикса — имя латиницей, можно цифры, точки и дефисы между непустыми частями; первый символ — буква. Без пробелов и дополнительных `_`. Например, `button_side.hall` → имя объекта `button_side.hall` и ключ `home.side.hall`. Переименовывать в SideHall не нужно. Видимый текст внутри Text может быть русским.

Короткие и полные варианты равнозначны во всех строках, регистр не важен. `logo_`, `gauge_` и другие полные слова не требуют искусственного сокращения, если выбран полный вариант.

Для нескольких зон: `button_HallVolumeUp`, `button_HallVolumeDown`, `level_HallVolume`, `button_TerraceVolumeUp`, `level_TerraceVolume`. Префикс обозначает тип, оставшаяся часть — уникальное назначение на этом экране.

Новые ключи формируются из контекста экрана и имени в нижнем регистре: `Home` + `button_VolumeUp` → `home.volumeup`. CamelCase не добавляет дефисы. В 0.3.5 `btn_volumeup` рядом с `button_VolumeUp` получает отдельный свободный ключ и ID. Старые уникальные ключи, в том числе `home.volume-up`, и ID не заменяются.

Переименование обновляет автоматический смысловой ключ, сохраняя числовые ID. Для смены типа или поведения используйте ручную форму и сверку с AV-программой. Копии уже назначенных узлов и совпадения получают свободные назначения автоматически при проверке/экспорте. Одинаковые имена слоёв разрешены, если сохранены поддержанные префиксы и структура.

## Логотипы и картинки

С 0.6.6 для растрового фона используйте Frame `image_Background` / `img_Background` внутри экрана. Если Frame больше экрана, включите **Clip content у экрана**: PNG обрежется по его прямоугольным границам без масштабирования рисунка. То же работает для `logo_` и графики внутри popup с включённым Clip content. Сам исходный Frame не меняется; полностью вынесенная за холст графика и нативные контролы за границами остаются ошибкой.

Внешний Frame логотипа находится внутри экрана, видим, opacity 100%, без поворота, обводки, эффектов и скруглений на самом внешнем Frame. Допустимы дробные координаты/размеры: PNG получает целые внешние границы и прозрачные поля, сохраняя исходную геометрию без масштабирования. Для прозрачного фона убрать заливку внешнего Frame. Внутри можно использовать векторы, текст, изображения и скругления — содержимое экспортируется одним PNG 1× с прозрачностью.

PBImage остаётся отдельным объектом в GUI Designer: можно менять положение и ресурс. Внутренние векторы/буквы логотипа становятся пикселями PNG и отдельно не редактируются. У логотипа нет нажатий, On/Off или controlId.

Если логотип должен нажиматься — использовать `button_Company` со состояниями и иконкой внутри состояния. Если картинка должна отображать динамическое состояние устройства — это отдельная задача программы управления.

В обновлённом exui/5 отдельного лимита числа PNG нет. Каждый PNG — до 4 MiB, общий распакованный пакет — до 16 MiB, manifest.json — до 64 KiB и screen.json — до 256 KiB. Для пакетов с более чем 16 PNG нужны плагин 0.3.1 и CLI 0.3.0 preview; прежние форматы сохраняют предел 16 PNG. Масштабирования PNG нет; размер ресурса равен размеру Frame.

## Кастомный Slider

```text
slider_Volume                 Frame 260×32, без fills
├── Track                     Frame/Rectangle 260×16, x=0 y=8, цвет #292D30, radius=8
├── Fill                      Frame/Rectangle 104×16, x=0 y=8, цвет #F47700, radius=8
└── Thumb                     Frame 28×28, x=100 y=2, белый, radius=14
```

Track занимает всю длину и центрируется поперёк Slider. Fill имеет ту же толщину и скругление, начинается с края, соответствующего направлению. Thumb — круглый Frame, прямоугольник без скругления или Ellipse; расположен по центру поперёк Slider и не выходит за границы. Внутри частей нет других слоёв; эффекты, обводки и градиенты не поддержаны. Направление и диапазон задаются формой, по умолчанию слева направо и 0–100.

Положение бегунка и длина Fill в Figma служат предпросмотром; начальное фактическое значение сообщает программа управления. Подпись рядом — отдельный value_, кнопки «−»/«+» — отдельные button_. Префикс не создаёт автоматическую связь между ними.

## Проект с несколькими экранами

```text
project_Trilliant
├── Home
│   ├── slider_Volume
│   ├── value_VolumeValue
│   └── popupref_Sources       размер 240×180
├── screen_Settings
│   └── text_Title
├── popup_Sources             размер 240×180, содержит элементы
├── modalpopup_Confirm        размером с панель
└── popupgroup_Zones
    ├── popup_Hall             оба popup одного размера
    └── popup_Terrace
```

Для группы нужен отдельный popupref на странице с полем «Или ключ группы popup» = `group.zones`; поле «Ключ popup» оставить пустым. Одна ссылка указывает либо popup, либо группу. В модальном popup нет popupref: штатные ссылки создаёт Build. Popup не вкладываются в popup. Группа — организационная обёртка; её фон и геометрия не экспортируются.

В 0.6.4 ручной ввод ключей не нужен: сохраните пустое место `popupref_…`, затем выделите popup вместе или их группу → «Размещение popup» → выберите место по имени → «Связать с местом popup». Группа и привязка подготовятся автоматически, положение и размеры popup не изменятся. Все popup группы должны быть выбраны; размеры совпадают с местом. Модальные popup не участвуют. Сохранённые связи и типы восстанавливаются после перезапуска плагина.

В 0.6.5 при выборе самого popupref доступен обратный список «Popup или группа» с подходящими целями. «Сохранить связь popup» заменяет цель, «Без связи» снимает назначение; Frame остаются на месте. Связанные popup можно показать на холсте. Отдельные списки помогают назначить стартовый экран и группу выбора кнопок; технические ключи вводить не требуется, сохранение явное.

С 0.6.2 фон самих Frame popup/popupref по умолчанию прозрачен, обводки, радиусы и Opacity Frame игнорируются. Красные рамки можно оставить в Figma для обозначения границ. Для намеренного переноса фона или обводки включите соответствующий флажок в «Назначение выбранного элемента» и сохраните назначение. Переносимая обводка — SOLID Inside, одинаковая толщина, без пунктира; радиусы и Opacity Frame всё равно игнорируются. Оформление вложенных контролов сохраняет прежние правила. Для таких пакетов нужен CLI 0.6.1 или новее.

По умолчанию первая новая страница — стартовая, остальные показывает программа. Ровно одна страница должна оставаться стартовой. С 0.6.3 она стоит первой в списке страниц GDL; остальные идут по именам с учётом чисел. Для добавленного `screen_StartPage` выберите «Показывается → Стартовая страница» и сохраните назначение; с 0.6.4 прежняя стартовая автоматически становится обычной. Через форму у кнопки можно задать цель `page.settings`/`popup.sources`, а у цели — «По кнопке». Эти связи попадают в карту ID; переходы исполняет программа Extron. Prototype interactions Figma не экспортируются.

## Поведение и платформенные ограничения

| Что нужно | Где задать | Что экспортируется |
|---|---|---|
| Один выбранный источник | «Группа выбора», например `sources.hall`, у соответствующих кнопок | Группа в карте ID для программиста; feedback возвращает программа. |
| Недоступный элемент | «Доступность при запуске» + при необходимости state_Disabled | Указание в карте ID и внешний вид состояния. Само состояние не блокирует нажатия. |
| Скрытый элемент при запуске | «Видимость при запуске» | Указание в карте ID. В Figma держать сам элемент видимым для экспорта. |
| Видео | `vid_Preview` / `video_Preview` | Зарезервировано. На наших профилях 1025M/300M — явная ошибка, без подмены картинкой. |
| Динамическая картинка | `dimg_Cover` / `dynamicimage_Cover` | Зарезервировано. Для наших профилей — явная ошибка; статичную обложку можно экспортировать через image_. |

Поддержка видео/динамических изображений требует других профилей и отдельной проверки платформы. Обычная картинка PBImage и динамическое изображение с URL — разные возможности.

## Экспорт

В 0.3.5 выбрать секцию проекта или внешний Frame экрана / проекта и профиль → **«Скачать .exui»**. Ключи и свободные ID заполняются автоматически, диапазон регуляторов по умолчанию — 0–100. **«Проверить макет»** выполняет ту же подготовку. Для предварительного просмотра доступно **«Распознать по именам»** → проверить список → **«Сохранить распознанные назначения»**.

Все типы и проекты экспортируются в `.exui/5`: текущий комплект — плагин 0.4.0 и CLI 0.4.0. Пакеты EXUI/1–4 актуальный CLI отклоняет; исходный макет нужно экспортировать заново. Результат требует отдельной проверки в Figma/GUI Designer и на панели.

Остальные правила: [полный стандарт подготовки](AUTHORING_STANDARD.md), [установка](README.md).

---

<a id="english"></a>

# Figma → Extron layer prefixes

[Русский](#russian) · **English**

Updated 25 Oct 2026: plugin 0.8.4 preview, CLI 0.8.3, EXUI/5. Case does not matter: `btn_volumeup`, `btn_VolumeUp` and `BUTTON_VOLUMEUP` are equivalent. The short and the full prefix give the same element type. Saved assignments take precedence over a new name. The old 0.2.2 archive still requires Off / On or Normal / Active / Pressed.

The plugin interface is in Russian; its labels are quoted as shown, followed by their English meaning.

Buttons and states can be a Group or a Frame. For a finished design: set the normal/active samples → select the screen → «Оформление кнопок → Применить оформление» (Button styling → Apply styling). Choose Off/On or Normal/Pressed for button_/btn_; feedbackbutton_/fbtn_ creates Normal/Active; the background of existing states is updated by the same action only after you explicitly choose updating instead of skipping. The third state is added by hand. [Full guide](BUTTON_STATES.md#english). The strict Text + Frame icon scheme described below remains the native text option; composite group styling supports arbitrary artwork through PNG.

[Table "what it is and when to use it"](../../docs/figma-prefix-reference.md#english) · [PDF cheat sheet](../../docs/prefix_map/figma-extron-prefix-cheatsheet.pdf) (in Russian).

## Text with an icon

For new buttons: **native text centered on the whole button, with an icon to the left or right inside Artwork**. Apply «Текст кнопок для GCP» > «По центру». Reserve equal space on both sides for the longest Text Feedback value. An icon is part of the state PNG without its own controlId. The current plugin exports Button text at middle-center or bottom-center; GUI Designer has nine combinations. [Details and limits](NATIVE_TEXT.md#english).

## Screen elements

| What you draw | Short name | Full name | Result and how to prepare it |
|---|---|---|---|
| The whole project | `prj_Trilliant` | `project_Trilliant` | A section with any name or an outer Frame with this prefix. Inside — Frames of pages, popups and popup groups. The container size is arbitrary. |
| Screen | `Home` or `scr_Home` | `screen_Home` | An outer Frame of 1280×800 or 320×480. A standalone screen or a page inside a project. |
| Ordinary button | `btn_Music` | `button_Music` | Group or Frame → PBButton. For a new layout: **Off / On** for switching or selecting, **Normal / Pressed** for pressing and holding. Creating from samples adds Off / On. Passive / Active is supported too. |
| Button with feedback | `fbtn_Music` | `feedbackbutton_Music` | For a new layout: **Normal / Active / Pressed** — selecting with a separate pressed look. Creating from samples gives Normal / Active; add Pressed by hand. Normal / Active without Pressed and the earlier synonyms remain compatible. |
| Volume up | `btn_VolumeUp` | `button_VolumeUp` | The "+" button: Normal / Pressed. For three states — `fbtn_VolumeUp`. |
| Volume down | `btn_VolumeDown` | `button_VolumeDown` | The "−" button: Normal / Pressed. For three states — `fbtn_VolumeDown`. |
| Mute | `btn_Mute` | `button_Mute` | Off + On. For Normal + Active + Pressed — `fbtn_Mute` / `feedbackbutton_Mute`. |
| Volume slider | `lvl_Volume` | `level_Volume` | A horizontal PBLevel Slider 0–100. An empty Frame with one solid fill. |
| Label | `txt_Title` | `text_Title` | A standalone Text → PBLabel for Arial Regular/Bold, Inter / Inter Display; nine alignments. Other families and complex styling → PNG/PBImage automatically, without a Frame. |
| Volume value | `txt_VolumeValue` | `text_VolumeValue` | A static caption such as "42%". No automatic dynamic binding is created. |
| Logo | `logo_Company` | `logo_Company` | A separate Frame inside the screen → a PNG resource and a PBImage object. No states or control ID are needed. |
| Photo, illustration, static artwork | `img_Photo` | `image_Photo` | The same PBImage. Put the artwork inside the Frame; it is exported as one PNG. |
| Button state icon | `Icon` or `ico_Music` | `icon_Music` | A Frame **inside a button state**. The PNG resource of that state; not a separate screen object. |
| Ordinary popup | `pop_Sources` | `popup_Sources` | A Frame inside the project. Its own size; the place is set by a popupref. |
| Modal popup | `mdl_Confirm` | `modalpopup_Confirm` | A Frame inside the project, the size of the panel. You can also set «Модальный popup: Да» (Modal popup: Yes) for a popup in the form. Dimming is done with the Frame's own fill with Fill transparency and the «Экспортировать фон Frame» (Export Frame background) checkbox. |
| Popup group | `pgrp_Zones` | `popupgroup_Zones` | An organizing Frame inside the project; ordinary popups of the same size inside it. In GUI Designer it is a group whose members are mutually exclusive. |
| Popup place | `pr_Sources` | `popupref_Sources` | An empty Frame on the page; its size matches the popup exactly. Since 0.7.0, on first recognition it finds a neighboring popup or popupgroup with the same name ending; if there are several matches, the target is chosen in the form. A saved link takes precedence. |
| Custom slider | `sld_Volume` | `slider_Volume` | A Frame without background, with Track, Fill, Thumb inside. A native PBSlider; the styling stays editable. |
| Level indicator | `gau_Signal` | `gauge_Signal` | An empty Frame with a fill. PBLevel Gauge; shows a value. |
| Value indicator | `ind_Status` | `indicator_Status` | The same PBLevel Gauge; not a separate lamp or switch. |
| LED scale | `led_Audio` | `volumeled_Audio` | An empty Frame with a fill → PBLevel VolumeLED. |
| Level with several looks | `mlvl_Status` | `multilevel_Status` | A Frame without background with 2–8 states with Text inside, starting with Normal. PBLevel MultistateLevel; Pressed is not used. |
| Updatable label | `val_VolumeValue` | `value_VolumeValue` | Text → PBLabel with a control ID. The initial text is "42%"; the control program updates it. |
| Shape | `shp_Card` | `shape_Card` | An empty Frame/Rectangle/Ellipse → PBShape. A fill, equal corner radii and one inner SOLID stroke. |
| Line | `ln_Divider` | `line_Divider` | Since 0.3.4: a straight horizontal/vertical Pen (Vector) or Line with one SOLID Stroke CENTER, flat ends. Or the earlier empty Frame/Rectangle without radius or stroke: the shorter side is the thickness. A native PBLine, without a PNG. |
| Date and time | `dt_Clock` | `datetime_Clock` | The ready component from the Extron Kit (the **Format** property, 28 formats), a Text with a sample from the catalog such as `September 28, 12:00 AM`, or a Text with the format itself, `HH:mm` → PBDateTime. [Details](AUTHORING_STANDARD.md#дата-и-время) (in Russian) |

Elements are placed directly in the Frame of a page or popup. Icons go inside a state; Track/Fill/Thumb inside a Slider. Pages and popups are combined by a project Frame; ordinary popups can be nested in a group Frame. `logo_` is already a full word; there is no extra short form. `logo_Company`, `img_Company` and `image_Company` mean one static picture: these names cannot be used together on one screen.

`button_Music` means "a button with the Music function", but it does not select an audio device automatically. Volume up/down, the step, repeat while held, Mute and feedback are implemented by the Extron control program.

## Button states

| Frame name inside the button | Allowed variants | Purpose |
|---|---|---|
| `Normal` | `Off`, `Passive`; also with `st_` / `state_` | The initial look. |
| `On` | `Active`, `Feedback`; also with `st_` / `state_` | The look set by a control program command, for example Mute on. |
| `state_Ready`, `state_Error`, `state_Disabled` | `st_Ready`, `st_Error`, `st_Disabled` | Extra feedback looks: a total limit of 8 states. Disabled is only a look; blocking presses is done by the program. |
| `Pressed` | `st_Pressed`, `state_Pressed` | The look while the button is held; after release the normal look returns. |

One rule for new layouts — choose the scheme by the button's behavior:

| Scheme | Where it fits | Press and release |
|---|---|---|
| **Normal + Pressed** | "+", "−", commands without a permanent On | Pressed while held, Normal after release. |
| **Off + On** | Two device states without a separate press effect | The program selects On; no separate Pressed is created. |
| **Normal / Active / Pressed** | Mute/source with feedback and a hold effect (`feedbackbutton_` / `fbtn_`) | Pressed while held; after release the look matches the feedback. Check with the control program. |

For finished layouts, Passive / Active, Normal / Active without Pressed, Off / On / Pressed and other previously supported synonyms remain compatible. Names, styling and IDs are not rewritten automatically.

**New** button_/btn_ need 2 states: one normal and one feedback or pressed. feedbackbutton_/fbtn_ need normal and feedback; Pressed is optional. Normal / Off / Passive are one role, On / Active / Feedback are one role; roles cannot be duplicated. Only existing states and their images are exported, including hidden states; a missing third state is not created. Arbitrary state_Ready/state_Error in earlier saved assignments are supported for compatibility. For a preview, choose the state by name and ID in the plugin. Exactly one state is visible; each Frame covers the whole button, with one Text over the whole area and an optional icon inside. The Text may be exactly empty for separate native captions; a whitespace-only string is forbidden. The font is shared; the looks differ by text, color or image.

Example of "+", yellow while held:

```text
Home
├── button_VolumeUp
│   ├── Normal                 Frame, normal fill, visible
│   │   └── Text               Text "+", over the whole button
│   └── Pressed                Frame, yellow fill, hidden in the preview
│       └── Text               Text "+", over the whole button
└── logo_Company               Frame with the logo artwork inside
```

The designer sets the yellow color, for example `#FFCC00`. The plugin keeps the styling but does not recolor a state because it is named Pressed.

## Names, zones and IDs

After the prefix comes a name in Latin letters; digits, dots and hyphens between non-empty parts are allowed; the first character is a letter. No spaces or extra `_`. For example, `button_side.hall` → object name `button_side.hall` and key `home.side.hall`. There is no need to rename it to SideHall. The visible text inside a Text may be in any language.

Short and full variants are equivalent in all rows, and case does not matter. `logo_`, `gauge_` and other full words do not need an artificial short form if you choose the full variant.

For several zones: `button_HallVolumeUp`, `button_HallVolumeDown`, `level_HallVolume`, `button_TerraceVolumeUp`, `level_TerraceVolume`. The prefix gives the type; the rest is a unique purpose on this screen.

New keys are built from the screen context and the name in lowercase: `Home` + `button_VolumeUp` → `home.volumeup`. CamelCase does not add hyphens. In 0.3.5, `btn_volumeup` next to `button_VolumeUp` gets its own free key and ID. Old unique keys, including `home.volume-up`, and IDs are not replaced.

Renaming updates the automatic semantic key while preserving numeric IDs. To change the type or behavior, use the manual form and check it against the AV program. Copies of already assigned nodes and collisions get free assignments automatically on check/export. Identical layer names are allowed as long as supported prefixes and the structure are kept.

## Logos and pictures

Since 0.6.6, for a raster background use an `image_Background` / `img_Background` Frame inside the screen. If the Frame is larger than the screen, turn on **Clip content on the screen**: the PNG is cropped to its rectangular bounds without scaling the picture. The same works for `logo_` and for artwork inside a popup with Clip content on. The source Frame itself does not change; artwork placed entirely outside the canvas and native controls beyond the bounds remain an error.

The outer logo Frame is inside the screen, visible, opacity 100%, without rotation, stroke, effects and corner radii on the outer Frame itself. Fractional coordinates/sizes are allowed: the PNG gets whole outer bounds and transparent margins, keeping the source geometry without scaling. For a transparent background, remove the fill of the outer Frame. Inside you can use vectors, text, images and corner radii — the content is exported as one PNG 1× with transparency.

PBImage stays a separate object in GUI Designer: you can change its position and resource. The logo's internal vectors/letters become PNG pixels and are not editable separately. A logo has no presses, On/Off or controlId.

If the logo must be pressable, use `button_Company` with states and the icon inside a state. If the picture must show a dynamic device state, that is a separate task for the control program.

The updated exui/5 has no separate limit on the number of PNGs. Each PNG is up to 4 MiB, the total unpacked package up to 16 MiB, manifest.json up to 64 KiB and screen.json up to 256 KiB. Packages with more than 16 PNGs need plugin 0.3.1 and CLI 0.3.0 preview; earlier formats keep the limit of 16 PNGs. PNGs are not scaled; the resource size equals the Frame size.

## Custom Slider

```text
slider_Volume                 Frame 260×32, no fills
├── Track                     Frame/Rectangle 260×16, x=0 y=8, color #292D30, radius=8
├── Fill                      Frame/Rectangle 104×16, x=0 y=8, color #F47700, radius=8
└── Thumb                     Frame 28×28, x=100 y=2, white, radius=14
```

Track covers the full length and is centered across the Slider. Fill has the same thickness and radius and starts from the edge that matches the direction. Thumb is a round Frame, a rectangle without radius or an Ellipse; it is centered across the Slider and does not go beyond its bounds. The parts contain no other layers; effects, strokes and gradients are not supported. Direction and range are set in the form; the default is left to right and 0–100.

The thumb position and the Fill length in Figma are a preview; the program reports the actual initial value. A caption next to it is a separate value_, the "−"/"+" buttons are separate button_. The prefix does not create an automatic link between them.

## A project with several screens

```text
project_Trilliant
├── Home
│   ├── slider_Volume
│   ├── value_VolumeValue
│   └── popupref_Sources       size 240×180
├── screen_Settings
│   └── text_Title
├── popup_Sources             size 240×180, contains elements
├── modalpopup_Confirm        the size of the panel
└── popupgroup_Zones
    ├── popup_Hall             both popups of the same size
    └── popup_Terrace
```

A group needs its own popupref on the page with the field «Или ключ группы popup» (Or popup group key) = `group.zones`; leave the «Ключ popup» (Popup key) field empty. One link points either to a popup or to a group. A modal popup has no popupref: Build creates the standard links. Popups are not nested in popups. A group is an organizing wrapper; its background and geometry are not exported.

In 0.6.4 you do not need to type keys: save an empty `popupref_…` place, then select the popups together or their group → «Размещение popup» (Popup placement) → choose the place by name → «Связать с местом popup» (Link to popup place). The group and the binding are prepared automatically; the popup positions and sizes do not change. All popups of the group must be selected; their sizes match the place. Modal popups do not take part. Saved links and types are restored after a plugin restart.

In 0.6.5, when the popupref itself is selected, a reverse list «Popup или группа» (Popup or group) with suitable targets is available. «Сохранить связь popup» (Save popup link) replaces the target, «Без связи» (No link) removes the assignment; the Frames stay in place. Linked popups can be shown on the canvas. Separate lists help assign the start screen and the button selection group; you do not need to type technical keys, and saving is explicit.

Since 0.6.2, the background of popup/popupref Frames themselves is transparent by default; strokes, radii and Frame Opacity are ignored. You can keep red frames in Figma to mark the bounds. To transfer the background or stroke on purpose, turn on the matching checkbox in «Назначение выбранного элемента» (Assignment of the selected element) and save the assignment. A transferable stroke is SOLID Inside, of equal thickness, without dashes; radii and Frame Opacity are ignored anyway. Styling of nested controls keeps the existing rules. Such packages need CLI 0.6.1 or newer.

By default, the first new page is the start page; the others are shown by the program. Exactly one page must remain the start page. Since 0.6.3 it comes first in the list of GDL pages; the others follow by name, taking numbers into account. For an added `screen_StartPage`, choose «Показывается → Стартовая страница» (Shown → Start page) and save the assignment; since 0.6.4 the previous start page automatically becomes an ordinary one. In the form, a button can get the target `page.settings`/`popup.sources`, and the target «По кнопке» (By button). These links go into the ID map; navigation is executed by the Extron program. Figma Prototype interactions are not exported.

## Behavior and platform limits

| What you need | Where to set it | What is exported |
|---|---|---|
| One selected source | «Группа выбора» (Selection group), for example `sources.hall`, on the matching buttons | The group in the ID map for the programmer; the program returns the feedback. |
| An unavailable element | «Доступность при запуске» (Availability at startup) + state_Disabled if needed | A hint in the ID map and the look of the state. The state itself does not block presses. |
| An element hidden at startup | «Видимость при запуске» (Visibility at startup) | A hint in the ID map. Keep the element itself visible in Figma for export. |
| Video | `vid_Preview` / `video_Preview` | Reserved. On our 1025M/300M profiles — an explicit error, without substituting a picture. |
| Dynamic picture | `dimg_Cover` / `dynamicimage_Cover` | Reserved. An explicit error for our profiles; a static cover can be exported through image_. |

Video/dynamic image support needs other profiles and a separate platform check. An ordinary PBImage picture and a dynamic image with a URL are different features.

## Export

In 0.3.5, select a project section or the outer Frame of a screen / project and the profile → **«Скачать .exui»** (Download .exui). Keys and free IDs are filled in automatically; the default slider range is 0–100. **«Проверить макет»** (Check layout) does the same preparation. For a preview, use **«Распознать по именам»** (Recognize by names) → check the list → **«Сохранить распознанные назначения»** (Save recognized assignments).

All types and projects are exported to `.exui/5`: the current kit is plugin 0.4.0 and CLI 0.4.0. The current CLI refuses EXUI/1–4 packages; export the source layout again. The result needs a separate check in Figma/GUI Designer and on the panel.

Other rules: [the full preparation standard](AUTHORING_STANDARD.md) (in Russian), [installation](README.md#english).

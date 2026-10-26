<a id="russian"></a>

# Extron Kit — библиотека для Figma

**Русский** · [English](#english)

**Apple-inspired Light · ревизия 2026-10-26-control-feedback**, входит в локальную сборку плагина **0.8.4**, совместимый CLI **0.8.3**, контракт **EXUI/5**. Архивы 0.7.3 предшествуют этой актуализации. В новой библиотеке стиль и ревизия показаны в заголовке и инструкции на холсте.

Генератор `src/kit.ts` использует каталог `docs/design/extron-kit/kit.json` и создаёт 29 отдельных компонентов (15 универсальных и 14 готовых), набор `datetime_Clock` с 28 вариантами, шаблон проекта и пример для выбранной панели: TLP Pro 1025M (1280×800) или TLP Pro 300M (320×480, портрет). Всего 57 основных компонентов с учётом вариантов часов. Холст pen.dev также актуализирован 24.10: обновлены состояния, инструкция и примеры 28 форматов. В pen.dev форматы показаны связанными экземплярами одного компонента; набор вариантов Format создаётся в Figma. [Материалы pen.dev](../../docs/design/extron-kit/README.md) сохраняют обе ревизии. Автоматической синхронизации pen.dev и Figma нет.

## Установка

1. Для актуальной локальной сборки выполнить `npm ci`, затем `npm run verify` в `src/figma-plugin`. Использовать `manifest.json` из этой папки. Для переносимой копии выполнить `npm run package` и распаковать полученный ZIP из `output/figma-plugin` в постоянную папку. Ранее созданный архив 0.7.3 новый кит не содержит.
2. Открыть редактируемый Design-файл в **Figma Desktop**.
3. **Plugins → Development → Import plugin from manifest…** → выбрать `manifest.json`. Для уже импортированного плагина сохранить его прежний ID и обновить путь к локальной версии.
4. Запустить **Figma → Extron Exporter**, проверить заголовок **0.8.4**, выбрать профиль панели.
5. Раскрыть **«Библиотека компонентов»** и нажать **«Создать Extron Kit»**. Команда добавит библиотеку, проект со страницей/popup/модальным popup/группой зон и пример экрана рядом с существующими объектами. Повторный запуск создаёт ещё один комплект.
6. При необходимости сохранить Figma-документ через **File → Save local copy** как `.fig`. Такой файл уже создаёт сама Figma.

Нужны права редактирования файла, Inter Regular/Bold и Figma с API `createSlot`. Процесс выполняется локальным плагином без Figma MCP.

## Apple-inspired Light

Весь кит использует светлый фон, белые поверхности, Inter, синий акцент и единую геометрию. Кнопки округлены на 16 px, поверхности — на 24 px. Состояния Off/On, Normal/Pressed и Normal/Active/Pressed показаны рядом в отдельном разделе библиотеки; выбранное состояние отличается синим фоном и отдельным маркером. Ошибка и готовность Multilevel используют красный и зелёный. На примере Music уже выбран как источник; это статический preview, не команда устройству.

Холст организован как библиотека с обложкой и восемью главами: **01 Основы и состояния**, **02 Компоненты и AV-пресеты**, **03 Дата и время**, **04 Шаблоны Extron**, **05 Готовые экраны**, **06 AV-сценарии**, **07 Иконки и размеры**, **08 Ожидание, доступность и компактный экран**. Каталог и рабочие контейнеры находятся в отдельных блоках; шаблоны и экран сохраняют натуральные размеры. Выбирайте для экспорта сам `project_` или `screen_`, а не главу документации. Это разделы текущего холста, не дополнительные Figma Pages.

Пример 1025M группирует источник, зону и громкость; 300M сохраняет те же основные действия в вертикальной композиции. Popup и подтверждение используют ту же систему. Регуляторы остаются нативными; кнопки экспортируют округлённый PNG с прозрачными углами. Интерфейс плагина, AV-команды и правила ID не меняются. Визуальные решения, ограничения Extron и официальные источники Apple: [DESIGN.md](../../docs/design/extron-kit/DESIGN.md).

Локальное исправление от 26.10.2026: размеры кнопок и текста в примерах задаются через constraints основных компонентов. Ползунки в Home и AV-сценариях создаются как редактируемые Frame с частями Track/Fill/Thumb, чтобы менять их геометрию без запрещённых overrides экземпляра. Основные компоненты Slider сохраняются в библиотеке; кнопки, текст и часы в примерах сохраняют связи с компонентами. Экспорт ползунков остаётся нативным.

## AV-сценарии, иконки и размеры

Дополнение на основе [исследования](../../docs/design/extron-kit/RESEARCH-2026-10-24.md) сохраняет 30 семейств / 57 основных компонентов и добавляет 18 вспомогательных иконок без controlId. Раздел 06 содержит `project_AVPatterns`: пять страниц Welcome, Presentation, AudioZones, ConnectionHelp, SystemStatus и `modalpopup_Shutdown`. Для каждого профиля используется своя компоновка. Существующий пример Home сохраняется.

Экспортируйте весь `project_AVPatterns`, чтобы сохранить страницы и modal, либо отдельный `screen_`. Кнопки, Slider/Value и Multilevel имеют отдельные назначения. Состояния Starting/Ready/Offline, запускаемые команды, переходы, тайм-ауты и синхронизацию громкости подключает программа управления. Имя кнопки не создаёт поведение автоматически.

Раздел 07: `Icon / …` из Lucide 1.61.0, символ 24 px, цели кнопок от 56 px, отступы 8/16/24/32/48/64. Иконки переносить внутрь Artwork; для отдельной пассивной графики нужен контейнер `image_`. Полные ISC/MIT-уведомления включены в `licenses/lucide.txt` в архиве. Это добавляет требование Figma API `createNodeFromSvg`.

## Обновление существующей библиотеки

### Дополнение содержимого от 26.10.2026

Раздел **08 / Ожидание, доступность и компактный экран** добавляется при обычном «Создать Extron Kit». Генератор по-прежнему использует Apple-inspired Light; переключателя стилей нет. Каталог [content.json](../../docs/design/extron-kit/content.json) хранит тексты и отдельные компоновки обеих панелей.

- `project_ControlStates` содержит три экрана выбранного профиля: `screen_SystemWaiting`, `screen_SourceUnavailable`, `screen_ConnectionLost`. На них показаны статус, причина, следующий шаг и доступная помощь; при потере связи есть `button_Retry` с Normal / Pressed.
- `image_UnavailableAction` — пассивная картинка без controlId. В ожидании и при недоступном источнике она заменяет основное действие: нет ложного обещания, что серый вид кнопки блокирует нажатия. Программа выбирает нужный экран и управляет повторными запросами.
- `multilevel_Connection` содержит три готовых состояния, `value_Reason` остаётся нативным обновляемым текстом. Их значения, команды Help/Retry и переходы подключаются программой Extron.
- `screen_CompactAudio` — отдельный готовый экран **320×480**: Music/HDMI, Mute, Slider/Value, Volume −/+. Он создаётся для наглядности при обоих профилях, но экспортируется отдельно с **TLP Pro 300M · портрет**. В `project_ControlStates` его нет: проект не смешивает размеры панелей.

Состав основных компонентов и контракт EXUI/5 сохранены. Живой файл Figma дополнен через Figwright на страницах Apple Style, Material 3 Inspired и Industrial HMI в их текущем оформлении. Обновление файлов плагина не дополняет старые экземпляры автоматически. Проверки: [протокол](../../docs/verification/results/2026-10-26-kit-content.md).

Обновление файлов плагина не меняет созданные ранее компоненты и экземпляры. **«Создать Extron Kit» добавляет новый комплект рядом**, без замены старого. Проверьте **Apple-inspired Light / 2026-10-26-control-feedback** в его заголовке/инструкции и берите новые экземпляры из нужной библиотеки в Assets. Старые назначения Extron, ID и индивидуальные правки сохраняются. Автоматического переноса экземпляров на новые основные компоненты нет.

Старые кнопки с `Off / On` остаются допустимыми. Для изменения пары у готовых обычных Frame/Group предусмотрены **«Оформление кнопок» → Normal / Pressed → обновление готовых кнопок**; экземпляры компонентов кита эта команда пропускает. Для экземпляров используйте новый основной компонент либо осознанно изменяйте старый основной компонент с проверкой его связей и состояний. Не удаляйте старую библиотеку, пока её экземпляры используются.

## Состояния кнопок

| Компоненты | Состояния | Назначение |
|---|---|---|
| `button_Button` | Off / On | Включение или выбор с feedback |
| `button_VolumeUp`, `button_VolumeDown` | Normal / Pressed | Нажатие и удержание громкости |
| `button_Back`, `button_Home`, `button_Settings` | Normal / Pressed | Действие или переход с видом нажатия |
| `feedbackbutton_*` | Normal / Active / Pressed | Выбор с отдельным видом нажатия |

У моментарных кнопок `Pressed` использует тёмный фон и белую подпись; состояние экспортируется даже скрытым. В пакете у пары Normal / Pressed — ID 0 / 1 и роль pressed у второго состояния. On / Active задаёт программа управления Extron, Pressed — вид во время удержания. Имена не подключают AV-команды, повтор регулировки или переходы автоматически. Подробности: [оформление кнопок](BUTTON_STATES.md).

## Использование

- Брать **свежие экземпляры** из Assets. Основные компоненты лежат в библиотеке, экран и шаблон проекта — рядом. Переносить экземпляры непосредственно внутрь страницы или popup.
- У кнопок менять текст слоя **Label** внутри каждого состояния Artwork. Для своей графики, нескольких текстов, групп, изображений, эффектов и градиентов редактировать слот **Artwork / Off**, **Artwork / On** либо **Artwork / Normal**, **Artwork / Active**, **Artwork / Pressed**. Figma запрещает привязку текстового свойства компонента внутри слота и автоматически даёт слою слота имя свойства `Artwork / …`; экспортёр это учитывает. Сохранять имена слотов, внешнего компонента и состояний.
- Изменения основного компонента распространяются на экземпляры, кроме индивидуально переопределённых свойств/содержимого слотов. Индивидуальные правки делать в экземпляре.
- Служебный слой `Text` над Artwork кнопки оставить пустым, на всю площадь, в поддержанном шрифте. Он обеспечивает контракт нативной кнопки; видимая подпись и свободная графика внутри Artwork становятся PNG состояния. Скругление состояния и Background сохраняйте; внешний Component/Instance остаётся без скруглений, заливки и эффектов.
- Выбрать секцию проекта или внешний Frame экрана / проекта и профиль → **«Скачать .exui»**. Ключи и свободные ID заполняются автоматически. «Проверить макет» выполняет ту же подготовку; «Распознать по именам» позволяет заранее просмотреть назначения.
- У свежих одинаково названных экземпляров появятся разные ключи (`home.button`, `home.button-2`) и ID без переименования слоёв. Основные компоненты не содержат назначенных ID. ID уже подготовленных экземпляров сохраняются при изменениях дизайна.
- Копии **уже назначенных** элементов получают собственные ключи и ID при проверке/скачивании, вместе с состояниями и PNG. Оригиналы и заданные свойства сохраняются. Можно также брать свежие экземпляры из Assets.
- Шаблоны страниц/popup — обычные Frame, чтобы внутри можно было свободно размещать элементы. В проекте уже настроены места обычного popup и группы зон.
- Новые `popupref_Name` могут находить соседний `popup_Name` или `popupgroup_Name` по общей части имени в том же проекте; сохранённые связи имеют приоритет. Фон и обводка popup по умолчанию не экспортируются; включаются явно в назначении.
- Для нумерации выделить **сами кнопки**, открыть «Нумерация кнопок» и проверить предпросмотр. Счёт отдельный внутри каждого непосредственного родителя; обновление текста включается отдельно. Выбор родителя не включает его дочерние кнопки.

## Дата и время

Раздел **03 / Дата и время** библиотеки — набор вариантов `datetime_Clock`: 24 пресета Pattern из GUI Designer 1.28 и 4 дополнительных формата. Под каждым вариантом подписан его Pattern.

1. Перетащите `datetime_Clock` из Assets на экран. Имя экземпляра — `datetime_Clock`; при необходимости переименуйте, например `datetime_HeaderClock`.
2. В правой панели Figma выберите **Format**, например `Month day time 12h` → `September 28, 12:00 AM` (Pattern `MMMM d, h:mm tt`).
3. Меняйте размер, шрифт (Arial или Inter), цвет и выравнивание текста. У всех вариантов слой называется `Content`, поэтому оформление сохраняется при смене Format. Текст-пример на панели заменится текущими датой и временем.
4. Своего формата нет в списке — переименуйте Text-слой `Content` внутри экземпляра в `Pattern: dddd, d MMMM` (имя слоя важнее Format) либо задайте формат в плагине. Текст-пример тогда можно оставить любым.

В GDL получится нативный PBDateTime с этим Pattern, без PNG. Правила определения формата — в [стандарте макета](AUTHORING_STANDARD.md#дата-и-время).

## Возможности и ограничения

| Элемент | Что разрешено |
|---|---|
| Button / Feedback Button | Произвольное содержимое Artwork; обычная кнопка с 2 состояниями Off/On, Passive/Active или Normal/Pressed; feedback-кнопка Normal/Active с необязательным Pressed. В GDL — нативная кнопка и PNG каждого существующего состояния. |
| Image / Logo | Произвольная графика в Artwork; единый PNG → PBImage. |
| Slider | Track / Fill / Thumb; поддержанные нативные цвета, размеры, скругления, направление и диапазон. Произвольные рисунки дорожки/бегунка пока не экспортируются. |
| Level / Gauge / Indicator / Volume LED | Поддержанное нативное оформление PBLevel; это не контейнер для произвольной графики. |
| Multilevel | Именованные состояния, нативный текст и PNG Artwork. |
| Text / Value | Один внутренний `Content` на всю площадь; Arial, Inter или Inter Display в рамках нативного текста. Value остаётся нативным обновляемым элементом. |
| DateTime | Набор вариантов `datetime_Clock`; свойство **Format** задаёт Pattern панели. Один Text `Content` на всю площадь с примером, как в GUI Designer. Шрифт, цвет, выравнивание и размер меняются в экземпляре и сохраняются при смене Format. |
| Shape / Line | Поддержанные нативные свойства, без произвольных дочерних слоёв. |
| Pages / Popup / Modal / Group | Обычные структурные Frame; внутрь помещаются поддержанные элементы. |

Нативный Slider, динамический текст и другие работающие элементы не заменяются общей картинкой. Поэтому обещание «любой дизайн внутри абсолютно любого элемента» ещё не выполнено для этих типов. Свободное оформление полностью доступно в растеризуемых Artwork кнопок и изображений.

В **EXUI/5 отдельного лимита числа PNG нет**. Ограничения: до 4 MiB и 4096×4096 каждый PNG, до 16 MiB распакованный пакет, до 20 MiB ZIP, manifest.json до 64 KiB, screen.json до 256 KiB. Для текущей сборки используйте **CLI 0.7.3**. Кнопка Artwork с двумя состояниями занимает 2 PNG, с тремя — 3, картинка — 1. Отсутствующее третье состояние не создаётся и не экспортируется; скрытое существующее состояние экспортируется. При удалении Pressed из своего шаблона сохранять оставшиеся служебные имена состояний и Artwork. Полная библиотека служит каталогом, экспортировать её целиком не нужно. Связь Slider/Value, AV-команды и feedback задаёт программа управления Extron.

## Проверено

Дополнение AV-сценариев: [протокол](../../docs/verification/results/2026-10-24-extron-kit-av-patterns.md). В Figma fixture импорт SVG проверяется на границе API; визуалы подтверждаются рендерами pen.dev. Новый живой импорт SVG в Figma Desktop отдельно не заявляется.

Проверки текущего стиля и их границы — в [протоколе Apple-inspired Light](../../docs/verification/results/2026-10-24-extron-kit-apple-light.md). Предыдущая функциональная актуализация: [протокол](../../docs/verification/results/2026-10-24-extron-kit-refresh.md). `test/kit.test.ts` проверяет контраст палитры, создание для обеих панелей, каждый тип компонента, прозрачный фон PNG-кнопок, скрытый Pressed, стабильность ID, сохранение старого комплекта и очистку при ошибке. `test/kit-integration.ts` проверяет экраны и проект обеих панелей, а также все 28 форматов через настоящий CLI/Extron writer; Figma API и растеризация в нём моделируются.

Исторические проверки настоящей Figma Desktop: [первоначальный кит](../../docs/verification/results/2026-10-21-extron-kit.md), [экспорт кита 23 октября](../../docs/verification/results/2026-10-23-figma-live-update-handoff.md). Эти результаты не подтверждают новый ручной прогон ревизии 2026-10-24. GUI Designer Build, GCP и физическая панель требуют отдельного прогона.

Если установленная Figma не предоставляет `createSlot`, генерация завершится ошибкой и удалит только новый комплект. Обновить Figma и повторить. Существующий дизайн не очищается.

---

<a id="english"></a>

# Extron Kit — a library for Figma

[Русский](#russian) · **English**

**Apple-inspired Light · revision 2026-10-26-control-feedback**, part of the local plugin **0.8.4** build, compatible CLI **0.8.3**, contract **EXUI/5**. The 0.7.3 archives predate this update. In the new library, the style and revision are shown in the title and in the instructions on the canvas.

The plugin interface and the generated kit canvas are in Russian; labels are quoted as shown, followed by their English meaning.

The `src/kit.ts` generator uses the catalog `docs/design/extron-kit/kit.json` and creates 29 separate components (15 universal and 14 ready-made), a `datetime_Clock` set with 28 variants, a project template and an example for the selected panel: TLP Pro 1025M (1280×800) or TLP Pro 300M (320×480, portrait). In total that is 57 main components, counting the clock variants. The pen.dev canvas was also updated on 24 Oct: states, instructions and examples of the 28 formats. In pen.dev the formats are shown as linked instances of one component; the Format variant set is created in Figma. The [pen.dev materials](../../docs/design/extron-kit/README.md) (in Russian) keep both revisions. pen.dev and Figma are not synchronized automatically.

## Installation

1. For an up-to-date local build, run `npm ci`, then `npm run verify` in `src/figma-plugin`. Use the `manifest.json` from that folder. For a portable copy, run `npm run package` and unpack the resulting ZIP from `output/figma-plugin` into a permanent folder. The earlier 0.7.3 archive does not contain the new kit.
2. Open an editable Design file in **Figma Desktop**.
3. **Plugins → Development → Import plugin from manifest…** → choose `manifest.json`. For an already imported plugin, keep its ID and update the path to the local version.
4. Run **Figma → Extron Exporter**, check that the title shows **0.8.4**, and choose the panel profile.
5. Open **«Библиотека компонентов»** (Component library) and click **«Создать Extron Kit»** (Create Extron Kit). The command adds the library, a project with a page/popup/modal popup/zone group and an example screen next to the existing objects. Running it again creates another kit.
6. If needed, save the Figma document with **File → Save local copy** as `.fig`. Figma itself creates that file.

You need edit access to the file, Inter Regular/Bold and a Figma version with the `createSlot` API. The process runs in the local plugin, without Figma MCP.

## Apple-inspired Light

The whole kit uses a light background, white surfaces, Inter, a blue accent and one geometry. Buttons have a 16 px radius, surfaces 24 px. The Off/On, Normal/Pressed and Normal/Active/Pressed states are shown side by side in a separate library section; the selected state has a blue background and a separate marker. Multilevel error and ready use red and green. In the example, Music is already selected as the source; this is a static preview, not a device command.

The canvas is organized as a library with a cover and eight chapters: **01 Основы и состояния** (Foundations and states), **02 Компоненты и AV-пресеты** (Components and AV presets), **03 Дата и время** (Date and time), **04 Шаблоны Extron** (Extron templates), **05 Готовые экраны** (Ready screens), **06 AV-сценарии** (AV scenarios), **07 Иконки и размеры** (Icons and sizes), **08 Ожидание, доступность и компактный экран** (Waiting, availability and compact screen). The catalog and the working containers are in separate blocks; templates and the screen keep their natural sizes. For export, select the `project_` or `screen_` itself, not a documentation chapter. These are sections of the current canvas, not extra Figma Pages.

The 1025M example groups source, zone and volume; 300M keeps the same main actions in a vertical layout. The popup and the confirmation use the same system. Sliders stay native; buttons export a rounded PNG with transparent corners. The plugin interface, AV commands and ID rules do not change. Visual decisions, Extron limits and official Apple sources: [DESIGN.md](../../docs/design/extron-kit/DESIGN.md) (in Russian).

Local fix, 26 Oct 2026: example buttons and text resize through their main components' constraints. Sliders in Home and AV scenarios are editable Frames with Track/Fill/Thumb children, allowing independent geometry without forbidden instance overrides. Slider main components remain in the library; example buttons, text and clocks retain their component links. Sliders still export as native controls.

## AV scenarios, icons and sizes

The addition based on the [research](../../docs/design/extron-kit/RESEARCH-2026-10-24.md) (in Russian) keeps 30 families / 57 main components and adds 18 auxiliary icons without a controlId. Section 06 contains `project_AVPatterns`: five pages Welcome, Presentation, AudioZones, ConnectionHelp, SystemStatus and `modalpopup_Shutdown`. Each profile has its own layout. The existing Home example is kept.

Export the whole `project_AVPatterns` to keep the pages and the modal, or a single `screen_`. Buttons, Slider/Value and Multilevel have separate assignments. The Starting/Ready/Offline states, the commands they run, navigation, timeouts and volume synchronization are connected by the control program. A button name does not create behavior automatically.

Section 07: `Icon / …` from Lucide 1.61.0, a 24 px symbol, button targets from 56 px, spacing 8/16/24/32/48/64. Move icons inside the Artwork; standalone passive artwork needs an `image_` container. The full ISC/MIT notices are included in `licenses/lucide.txt` in the archive. This adds the Figma API requirement `createNodeFromSvg`.

## Updating an existing library

### Content addition, 26 Oct 2026

Section **08 / Ожидание, доступность и компактный экран** (Waiting, availability and compact screen) is included in Create Extron Kit. The generator keeps Apple-inspired Light and has no style selector. [content.json](../../docs/design/extron-kit/content.json) contains the copy and separate layouts for both panel profiles.

`project_ControlStates` contains SystemWaiting, SourceUnavailable and ConnectionLost pages for the selected panel: a status, a reason, a next step, Help and, on connection loss, Retry with Normal / Pressed. The unavailable primary action is `image_UnavailableAction`, a passive graphic with no controlId. A gray button appearance does not block presses. The control program selects pages, prevents duplicate commands, updates `multilevel_Connection` and `value_Reason`, and implements Help/Retry.

The separate **320×480** `screen_CompactAudio` provides Music/HDMI, Mute, Slider/Value and Volume −/+. It is generated for reference with either profile; export it separately using **TLP Pro 300M · portrait**. It is outside `project_ControlStates` so that project never mixes panel sizes. The component inventory and EXUI/5 contract are unchanged. The existing Figma file was also extended through Figwright on Apple Style, Material 3 Inspired and Industrial HMI pages in their respective styles. See the [verification report](../../docs/verification/results/2026-10-26-kit-content.md).

Updating the plugin files does not change components and instances created earlier. **«Создать Extron Kit» (Create Extron Kit) adds a new kit next to the old one** without replacing it. Check **Apple-inspired Light / 2026-10-26-control-feedback** in its title/instructions and take new instances from the right library in Assets. Old Extron assignments, IDs and individual edits are kept. Instances are not moved to the new main components automatically.

Old buttons with `Off / On` remain valid. To change the pair of existing ordinary Frames/Groups, use **«Оформление кнопок» (Button styling) → Normal / Pressed → update existing buttons**; this command skips instances of kit components. For instances, use the new main component or deliberately change the old main component, checking its links and states. Do not delete the old library while its instances are in use.

## Button states

| Components | States | Purpose |
|---|---|---|
| `button_Button` | Off / On | Switching on or selecting with feedback |
| `button_VolumeUp`, `button_VolumeDown` | Normal / Pressed | Pressing and holding for volume |
| `button_Back`, `button_Home`, `button_Settings` | Normal / Pressed | An action or navigation with a pressed look |
| `feedbackbutton_*` | Normal / Active / Pressed | Selecting with a separate pressed look |

On momentary buttons, `Pressed` uses a dark background and a white caption; the state is exported even when hidden. In the package, a Normal / Pressed pair has IDs 0 / 1 and the pressed role on the second state. On / Active is set by the Extron control program, Pressed is the look while held. The names do not connect AV commands, volume repeat or navigation automatically. Details: [button styling](BUTTON_STATES.md#english).

## Usage

- Take **fresh instances** from Assets. The main components are in the library; the screen and project template are next to it. Move instances directly into a page or popup.
- On buttons, change the text of the **Label** layer inside each Artwork state. For your own artwork, several texts, groups, images, effects and gradients, edit the **Artwork / Off**, **Artwork / On** or **Artwork / Normal**, **Artwork / Active**, **Artwork / Pressed** slot. Figma does not allow binding a component text property inside a slot and automatically names the slot layer after the `Artwork / …` property; the exporter takes this into account. Keep the names of the slots, the outer component and the states.
- Changes to a main component propagate to instances, except for individually overridden properties/slot contents. Make individual edits in the instance.
- Leave the service `Text` layer above the button Artwork empty, covering the whole area, in a supported font. It provides the native button contract; the visible caption and free artwork inside the Artwork become the state PNG. Keep the state's corner radius and Background; the outer Component/Instance stays without radius, fill and effects.
- Select a project section or the outer Frame of a screen / project and the profile → **«Скачать .exui»** (Download .exui). Keys and free IDs are filled in automatically. «Проверить макет» (Check layout) does the same preparation; «Распознать по именам» (Recognize by names) lets you review the assignments in advance.
- Fresh identically named instances get different keys (`home.button`, `home.button-2`) and IDs without renaming the layers. Main components carry no assigned IDs. IDs of already prepared instances are kept when the design changes.
- Copies of **already assigned** elements get their own keys and IDs on check/download, together with their states and PNGs. The originals and their set properties are kept. You can also take fresh instances from Assets.
- Page/popup templates are ordinary Frames so that you can place elements freely inside. The project already has places set up for an ordinary popup and the zone group.
- New `popupref_Name` can find a neighboring `popup_Name` or `popupgroup_Name` by the shared part of the name in the same project; saved links take precedence. A popup's background and stroke are not exported by default; turn them on explicitly in the assignment.
- For numbering, select **the buttons themselves**, open «Нумерация кнопок» (Button numbering) and check the preview. Counting is separate within each direct parent; updating the text is turned on separately. Selecting a parent does not include its child buttons.

## Date and time

The library section **03 / Дата и время** (Date and time) is the `datetime_Clock` variant set: 24 Pattern presets from GUI Designer 1.28 and 4 extra formats. Each variant is labeled with its Pattern.

1. Drag `datetime_Clock` from Assets onto the screen. The instance is named `datetime_Clock`; rename it if needed, for example `datetime_HeaderClock`.
2. In the Figma right panel, choose **Format**, for example `Month day time 12h` → `September 28, 12:00 AM` (Pattern `MMMM d, h:mm tt`).
3. Change the size, font (Arial or Inter), color and text alignment. In all variants the layer is named `Content`, so the styling is kept when Format changes. On the panel, the sample text is replaced by the current date and time.
4. If your format is not in the list, rename the `Content` Text layer inside the instance to `Pattern: dddd, d MMMM` (the layer name takes precedence over Format) or set the format in the plugin. The sample text can then be anything.

The GDL gets a native PBDateTime with this Pattern, without a PNG. The rules for detecting the format are in the [layout standard](AUTHORING_STANDARD.md#дата-и-время) (in Russian).

## Capabilities and limits

| Element | What is allowed |
|---|---|
| Button / Feedback Button | Any Artwork content; an ordinary button with 2 states Off/On, Passive/Active or Normal/Pressed; a feedback button Normal/Active with an optional Pressed. In the GDL — a native button and a PNG for each existing state. |
| Image / Logo | Any artwork in the Artwork; a single PNG → PBImage. |
| Slider | Track / Fill / Thumb; supported native colors, sizes, radii, direction and range. Arbitrary track/thumb pictures are not exported yet. |
| Level / Gauge / Indicator / Volume LED | Supported native PBLevel styling; not a container for arbitrary artwork. |
| Multilevel | Named states, native text and PNG Artwork. |
| Text / Value | One inner `Content` covering the whole area; Arial, Inter or Inter Display within the native text rules. Value stays a native updatable element. |
| DateTime | The `datetime_Clock` variant set; the **Format** property sets the panel Pattern. One `Content` Text covering the whole area with a sample, as in GUI Designer. Font, color, alignment and size are changed in the instance and kept when Format changes. |
| Shape / Line | Supported native properties, without arbitrary child layers. |
| Pages / Popup / Modal / Group | Ordinary structural Frames; supported elements go inside. |

Native Slider, dynamic text and other working elements are not replaced by a single picture. So the promise "any design inside absolutely any element" is not met yet for these types. Free styling is fully available in the rasterized Artwork of buttons and images.

**EXUI/5 has no separate limit on the number of PNGs.** Limits: up to 4 MiB and 4096×4096 per PNG, up to 16 MiB for the unpacked package, up to 20 MiB for the ZIP, manifest.json up to 64 KiB, screen.json up to 256 KiB. For the current build use **CLI 0.7.3**. A button Artwork with two states takes 2 PNGs, with three — 3, a picture — 1. A missing third state is neither created nor exported; a hidden existing state is exported. When removing Pressed from your own template, keep the remaining service names of the states and the Artwork. The full library is a catalog; you do not need to export it as a whole. The Slider/Value link, AV commands and feedback are set by the Extron control program.

## Verified

The AV scenarios addition: [report](../../docs/verification/results/2026-10-24-extron-kit-av-patterns.md) (in Russian). In the Figma fixture, SVG import is checked at the API boundary; the visuals are confirmed by pen.dev renders. A new live SVG import in Figma Desktop is not claimed separately.

Checks of the current style and their limits are in the [Apple-inspired Light report](../../docs/verification/results/2026-10-24-extron-kit-apple-light.md) (in Russian). The previous functional update: [report](../../docs/verification/results/2026-10-24-extron-kit-refresh.md) (in Russian). `test/kit.test.ts` checks palette contrast, creation for both panels, every component type, the transparent background of PNG buttons, hidden Pressed, ID stability, keeping the old kit and cleanup on error. `test/kit-integration.ts` checks the screens and the project for both panels, and all 28 formats through the real CLI/Extron writer; the Figma API and rasterization are simulated there.

Historical checks in real Figma Desktop: [the original kit](../../docs/verification/results/2026-10-21-extron-kit.md), [kit export on 23 October](../../docs/verification/results/2026-10-23-figma-live-update-handoff.md) (in Russian). These results do not confirm a new manual run of revision 2026-10-24. GUI Designer Build, GCP and the physical panel need a separate run.

If the installed Figma does not provide `createSlot`, generation fails and removes only the new kit. Update Figma and try again. The existing design is not cleared.

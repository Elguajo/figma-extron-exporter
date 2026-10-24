# 88 отсутствующих ID кнопок перед полным импортом в GCP — 25.10.2026

**Итог после уточнения пользователя:** часть страниц и кнопок (PAGE 1 / PAGE 2, video-экраны) намеренно создал старший программист в GUI Designer. Полный импорт GDL из Figma для этого проекта не планируется. Рабочий путь — выборочное обновление совместимых кнопок с сохранением ручных страниц ([проверка](2026-10-25-gcp-selected-update.md)). Шаги ниже нужны только если когда-нибудь понадобится полный импорт.

Решение для полного импорта: восстанавливать ID нужно **только у 4 кнопок** PAGE 1 / PAGE 2. Остальные 84 в GCP не настроены, их потеря ничего не отвязывает. Перед полным импортом нужно также перенаправить одну команду Show Page. Данные: `output/gcp-verify-20261025/` (исключено из Git), карта соответствий — `id-recovery-map.json`.

## Откуда 88 ID

Все 88 кнопок находятся на страницах и popup, которые были созданы **вручную в GUI Designer**: у них низкие ID контейнеров (0–4) и ID кнопок (1–89), имена `Button1_IDxx`. Из Figma эти экраны теперь экспортируются заново, с новыми именами и ID:

| База GCP (вручную) | Кнопок | Новый GDL из Figma |
| --- | --- | --- |
| `screen_Video Control` (ID 0) | 4: Main, Hall, Terrace, VideoWall | `screen_VideoControl` (182) |
| `screen_VIdeoWall` (3) | 2: Videowall 1/2 | `screen_VideoWallControl` (130) |
| `popup_Video Hall  Sources` (2) | 28: TV 1–4, Box 1–22, HDMI 1/2 | `popup_VideoHallSources ` (172) |
| `popup_Video Terrace Sources` (1) | 26: Projection 1/2, Box 1–22, HDMI 1/2 | `popup_VideoTerraceSources ` (173) |
| `Video Wall Preset` (4) | 24: Box 1–22, HDMI 1/2 | `popup_TerraceSources (2)` (171), заголовок «Video Wall» |
| `popup_HallSources ` / `popup_TerraceSources` | 4: PAGE 1 / PAGE 2 (ID 1–4) | **нет** |

Ещё один отсутствующий элемент, `logo_company_ID63`, — PBImage без управления.

## Что настроено в GCP

Проверено в копии проекта GCP по меткам настроек на макете (Press — зелёная, Feedback — фиолетовая) и выборочным открытием вкладок у кнопок Videowall 1, Box 1, HDMI 2 и Hall:

- **84 кнопки без настроек:** все кнопки `screen_Video Control`, `screen_VIdeoWall`, обоих video-popup и `Video Wall Preset`. Press, Release, Visual и Text Feedback пусты.
- **4 настроенные кнопки:**

| ID | Popup | Press | Visual Feedback |
| --- | --- | --- | --- |
| 1 | `popup_HallSources` | `Audio Hal Page Selection (State 1)` | `Audio Hal Page Selection`: Off ↔ 2 |
| 2 | `popup_HallSources` | `Audio Hal Page Selection (State 2)` | `Audio Hal Page Selection`: Off ↔ 1 |
| 3 | `popup_TerraceSources` | `Audio Terrace Page Selection (State 1)` | настроен |
| 4 | `popup_TerraceSources` | `Audio Terrace Page Selection (State 2)` | настроен |

Эти кнопки переключают состояние, по которому ветвятся команды CH01–CH08 (If State = 1 / Else If State = 2), и Text Feedback каналов. В новом Figma popup `popup_HallSources` и `popup_TerraceSources` содержат только CH01–CH08, VolumeUp/Down и Mute: **PAGE 1 / PAGE 2 отсутствуют**. После полного импорта переключать страницы источников будет нечем.

## Почему не восстанавливать ID по положению

В старых video-popup источники расставлены по столбцам (Box 1–4 в первом столбце), в новых из Figma — по строкам (Box 1–6 в первой строке). При сопоставлении по геометрии старая «Box 5» совпадает с новой «Box 8» и т. д. Это привязало бы будущие команды к неверным источникам. По подписям все 84 кнопки сопоставляются однозначно (`match: label` в карте). Но так как настроек у них нет, переносить старые ID **не нужно**: новые ID Figma безопаснее, а логику для них нужно назначать с нуля.

## Что сделать перед полным импортом

1. **Figma:** добавить кнопки PAGE 1 и PAGE 2 в `popup_HallSources` и `popup_TerraceSources`, по два состояния, и вручную задать «ID управления Extron» (поле `controlId` в форме назначения):
   - Hall: PAGE 1 → **1**, PAGE 2 → **2**;
   - Terrace: PAGE 1 → **3**, PAGE 2 → **4**.

   Плагин принимает ручные controlId 1–65535; в новом проекте эти номера не заняты. Тогда при Layout Reconciliation GCP сохранит их Press и Visual Feedback.
2. **GCP после импорта:** у кнопки Video Control (`screen_MainDashboard`, ID 8130) команда `Show Page (screen_Video Control)` указывает на ручную страницу с ID **0**. Плагин не может выдать странице ID 0 (допустимо 1–65534), поэтому нужно вручную выбрать новую `screen_VideoControl`.
3. **Новым video-кнопкам** назначить логику с нуля — в старом проекте её не было.

## Замечания к макету Figma

- `popup_TerraceSources (2)` с заголовком «Video Wall» — по составу (Box 1–22, HDMI 1/2) это замена `Video Wall Preset`. Имя похоже на непереименованную копию; лучше переименовать до настройки команд.
- В `screen_VideoControl` кнопка «Videowall» называется `button_side.terrace` (ключ `videocontrol.side.terrace-2`), как и кнопка Terrace. В GCP две кнопки с одним именем легко перепутать.
- У `button_side.hall` / `button_side.terrace` на `screen_AudioControl` изменились имена состояний (Passive/Active → Off/Active и Passive/On). Visual Feedback у них не настроен (Press — Show Popup), поэтому на работу это не влияет.

## Границы проверки

- Метки на макете GCP проверены визуально, вкладки действий открыты выборочно. Чтения зашифрованного `.gcplus` нет.
- Полный импорт и работа на панели не проверялись; макет Figma не изменялся.

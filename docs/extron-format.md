# Наблюдаемый формат Extron: первый срез

Проверено 19.10.2026 на пользовательском GDL версии GUI Designer 1.28.0.7 и 44 установленных GLT. Это описание исследованного подмножества, не официальная спецификация Extron.

## Контейнер

Все 45 исследованных несобранных файлов содержат одну запись `ProjectGCP`; после Save and Build добавляется вторая (раздел «Штатная сборка»). Сигнатуры локального заголовка, центрального каталога и конца: `4B 50 03 04`, `4B 50 01 02`, `4B 50 05 06`. Это `KP`, а не стандартное `PK`.

Поля заголовков соответствуют исследованной ZIP-подобной структуре little endian. Данные сжаты raw DEFLATE (метод 8). Реализация также проверена на синтетическом stored-варианте (метод 0); реальный образец stored Extron пока отсутствует.

Локальный заголовок: CRC32 по смещению 14, сжатый размер 18, исходный размер 22, длина имени 26, длина extra 28, имя начинается с 30.

Центральный заголовок: CRC32 16, сжатый размер 20, исходный размер 24, длины имени/extra/comment 28/30/32, диск 34, смещение локального заголовка 42, имя начинается с 46.

End record: диск 4, диск каталога 6, число записей 8/10, размер каталога 12, смещение каталога 16, длина комментария 20, комментарий начинается с 22.

Пересборка сохраняет исходные заголовки, extra-поля и комментарии; пересчитывает CRC, размеры и смещение центрального каталога. `Repack` не меняет payload; `RepackWithPayload` упаковывает явно переданные байты после проверки вызывающим кодом. Простая подмена всех последовательностей `KP` во всём файле не используется: она могла бы испортить данные внутри payload.

## Payload

Microsoft System.Formats.Nrbf 10.0.11 успешно декодирует NRBF всех 45 файлов. Это сильнее прежней гипотезы по найденным ASCII-строкам. Объекты прикладных классов не создаются, сборки Extron не загружаются.

В `Full-Test-Project.gdl`:

- Размер исходного контейнера: 1 592 701 байт.
- Размер payload: 2 652 133 байта.
- SHA-256 payload: `03B8AF83B00EB9F45C85AD6A7CC3E6C7F52EDD5B78D11368AFD0FE4723D1E14C`.
- Корень: `Extron.GUICPro.PBProject`.
- Записей в словаре декодера: 12 693.
- Классов PBPage: 13; PBButton: 88; PBLabel: 33; PBLevel: 5.

Количество PBPage относится к найденному классу, а не ко всем возможным категориям страниц, включая Offline. Наличие класса PBLevel само по себе не устанавливает визуальный вариант каждого регулятора.

Корень содержит страницы, popup pages, ресурсы, платформу, версию приложения, preview stream и `checksum`. В исходном образце checksum — UInt64 со значением 0. Изменение подписи при сохранении нулевого checksum прошло штатную GUI-проверку. Алгоритм ненулевого checksum ещё не исследован; такие проекты редактор текста отклоняет.

## Проверенное изменение строки

Кнопка `Start`: пользовательский ID 8000 (UInt16), внутренний `PBControlBase+idField` 5; left/top 65/159, width/height 190/66. Её `PBControlBase+statesField → mItems → _items` ведёт к двум PBState, Off и On. Оба `textField` ссылаются на один BinaryObjectString, ObjectId 8597, со значением `Press to begin`. Поля текста непосредственно в PBButton равны null.

В эксперименте заменены только длина и UTF-8 значение этой записи: исходное смещение 2540980, 15 байт → 13 байт (`Музыка`). Байты заголовка записи, ObjectId, ссылки и остальные байты payload сохранены. Декодирование после изменения проверяет идентичность набора записей и всех полей классов, кроме двух выбранных textField. Общие с другими объектами строки или состояния отклоняются. Файл прошёл GUI Designer 1.28.0.7; протокол: `../verification/results/2026-10-19-gui-text-edit.md`.

Синтаксис строки: [Microsoft MS-NRBF BinaryObjectString](https://learn.microsoft.com/en-us/openspecs/windows_protocols/ms-nrbf/eb503ca5-e1f6-4271-a7ee-c4ca38d07996). Это ограниченное изменение существующей записи, а не сериализация нового графа.

## Штатная сборка

Save and Build выполняется внутри GUI Designer, не экспортёром. После него контейнер имеет две записи: ProjectGCP и `<имя-проекта>.tgz4`.

В `output/Full-Test-Project-music.gdl` записи идут подряд:
- ProjectGCP с 0, extra 32 байта;
- `.tgz4` сразу после неё, extra 68 байт;
- центральный каталог из двух записей без комментариев.

С 19.10.2026 reader принимает такой файл структурно (до 16 записей, ProjectGCP первой) и проверяет CRC каждой записи. Пересборка копирует `.tgz4` побайтно. На этом файле подтверждено, что кнопка 8000 после GUI-сохранения по-прежнему содержит «Музыка» в обоих состояниях.

## Профиль панели в графе

Прочитано из Full-Test-Project и сверено с типами Extron в x86-адаптере (1.28.0.7):

| Панель | Класс `platformField` | `platformTypeField` (PlatformProTypeEnum) | `partNumberField` | Разрешение |
|---|---|---:|---|---|
| TLP Pro 300M, портрет | `PBTLP300MPlatform` | TLP300M = 44 | 60-1667-02 | 320×480 |
| TLP Pro 1025M | `PBTLP1025MPlatform` | TLP1025M = 30 | 60-1566-02 | 1280×800 |

`screenSizeField` (System.Drawing.Size) хранит размер холста. Платформа 300M перечисляет два `supportedResolutions` (портрет и ландшафт), 1025M — один.

`PBPlatformPro.CreatePlatform(PBProject, PlatformProTypeEnum)` — публичный статический метод. Без UI он вернул `PBTLP1025MPlatform` с part number 60-1566-02 и 1280×800. Профиль 1025M получен только так. Сгенерированный на его основе проект GUI Designer открыл как TLP Pro 1025M и собрал; сам донор в GUI не открывался.

NRBF хранит enum числом (`value__`). Поэтому числовые значения проверяются по типам Extron при каждом запуске адаптера.

## Элементы нового экрана

Наблюдения по графу 1.28.0.7; поля читаются нашим `ProjectModel`:

- **ID.**
  - `PBControlBase.idField` (UInt64) — editor ID, уникальный на странице.
  - `userIdField` (UInt16) — ID Extron; хранится на нескольких уровнях наследования, значения должны совпадать.
  - У страницы `idField` (UInt64), но `PBProject.defaultPageField` — UInt16; поэтому ID страницы ограничен 1..65534. 65535 — Offline page.
- **Кнопка.**
  - Состояния: `PBControlBase+statesField` → `PBStates.mItems` → `List<PBState>`.
  - У PBState свои `nameField`, `idField`, `indexField`, `textField`, `borderFillColorField`, `textColorField`, `buttonImageField`.
  - Press feedback — `<TLPPressFeedbackStateID>k__BackingField` кнопки. В несобранном доноре он равен −1; генератор записывает индекс состояния pressed.
- **Level.**
  - `displayTypeField` — LevelDisplayTypeEnum: Gauge 0, Slider 1, MultistateLevel 2, None 3, VolumeLED 4.
  - `orientationField`: LeftToRight 0, RightToLeft 1, BottomToTop 2, TopToBottom 3.
  - `minValueField`/`maxValueField` — UInt32; `gaugeFillColorField` — PBColor.
  - В Full-Test-Project все пять Level — Gauge. Отдельного экземпляра `PBSlider` нет, хотя класс в сборке существует.
- **Цвет.** `PBColor` с `paletteIndexField = −1` хранит `System.Drawing.Color` с `state = 2` и ARGB в `value`.
- **Изображение.**
  - `PBImageResource` в `resourceSetField.resourcesField` хранит name, filename, width, height, size и Bitmap в `dataField`.
  - Состояние ссылается на ресурс через `PBResourceReferenceImage.resourceNameField`.

Генератор переносит в новый проект ресурсы и палитру донора, но не его страницы. Offline popup донора сохраняется как есть. Устаревшие preview, VersionInfo и даты донора не меняются; по наблюдениям toolkit, Build их обновляет (у нас не проверено).

## Граница доказанного

Подтверждены:
- чтение одно- и многозаписного контейнера, CRC, NRBF decode, инвентаризация классов;
- пересборка контейнера с неизменным payload;
- изменение одной существующей подписи с сохранением ID;
- открытие, редактирование, Verify, Save and Build и повторное открытие обоих вариантов в GUI Designer 1.28.0.7.

Подтверждено создание новой страницы, кнопок, подписи, Level и PNG-ресурсов через x86-адаптер для двух профилей:
- проверка данных — независимая, NRBF;
- ручной цикл GUI Designer: открытие, редактирование, Verify, Save and Build, повторное открытие.

Протокол: `../verification/results/2026-10-19-first-screen.md`.

Наблюдения после Build сгенерированных проектов:
- Build status меняется с 1 (Needed) на 0 (Done).
- TLPImageID получают все элементы, у каждого состояния кнопки свой.
- `.tgz4` содержит `layout.json`, PNG по одному на изображение и встроенные TTF.
- Подписи в PNG не входят: в `layout.json` они остаются текстом.
- VersionInfo в `layout.json` отстаёт на одну сборку от ProjectGCP (0.0.2 против 0.0.3).
- При Save and Build можно удалить неиспользуемые ресурсы (Remove). Тогда ресурсы донора, на которые экран не ссылается, исчезают; наши PNG остаются.

Не подтверждены:
- сам донор 1025M в GUI (открывался только сгенерированный из него проект);
- произвольное изменение графа и ненулевые контрольные суммы уровня проекта;
- другие версии;
- работа панели.

## Источники

- Локальный GDL и шаблоны; хеш образца в `samples/manifest.json`.
- https://learn.microsoft.com/dotnet/standard/serialization/binaryformatter-migration-guide/read-nrbf-payloads
- https://www.nuget.org/packages/System.Formats.Nrbf/10.0.11
- https://learn.microsoft.com/dotnet/core/tools/dotnet-install-script

SDK 10.0.402 получен официальным dotnet-install по каналу 10.0 GA и зафиксирован в global.json. В локальном XML пакета проверены Decode с out recordMap, leaveOpen и ClassRecord.GetRawValue. После Decode поток оставляется открытым для проверки отсутствия хвостовых данных.

## Входной пакет экспортёра

Этап 5 не расширяет заявленный формат Extron. Контракт нашего ZIP `.exui/1` описан отдельно в [exui-v1.md](exui-v1.md); он понижается до прежнего плана генерации. Для обоих профилей пакетный результат побайтово совпал с экспериментальным путём; [протокол](../verification/results/2026-10-19-exui-v1.md). Build остаётся ручным действием пользователя.

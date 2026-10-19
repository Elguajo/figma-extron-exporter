# Логотипы, Normal/Pressed и регистр имён — 19.10.2026

Результат: плагин 0.1.5, справочник PREFIXES.md и встроенная таблица, статичные logo_/img_/image_ → PBImage, схема кнопки Normal/Pressed без обязательного On, case-insensitive имена функций при сохранении прежних metadata/ключей/ID. [Стандарт v1.2](../../src/figma-plugin/AUTHORING_STANDARD.md), [таблица](../../src/figma-plugin/PREFIXES.md), [контракт exui/4](../../docs/exui-v4.md), D016.

## Обоснование и влияние

Затронуты Figma producer/ручная форма/PNG packaging, новые схемы v4, lowerer, optional ссылка graphic в реестре донора, native writer и независимый reader/verifier. Риск MEDIUM: новый тип GDL и дополнительная схема кнопки. Главные инварианты — старые пакеты не расширяются, новые картинки не получают controlId/состояния, Normal/Pressed имеет два состояния и явный press=1, уже сохранённые ID не переназначаются.

В закреплённых донорах обнаружен PBImage Image1 в Confirmation. Файлы и SHA доноров не менялись. Reflection установила enum Native=3, MiddleCenter=3, Shape None=0. Writer использует клон готового PBImage, PNG-ресурс и прозрачные фон/обводку, без формы и текста. Исходные и генерированные объекты прочитаны независимым NRBF reader; прямые конструкторы и непроверенная десериализация пользовательского GDL не добавлялись.

Metadata остаются exui-node/1, новый kind graphic принимается текущим плагином; старый отклонит неизвестный kind. Счётчики ID не меняли формат. Canonical pressed/2 в metadata сохраняется, при упаковке двухсостояниевого momentary применяется плотная проекция pressed → stateId/press 1. Прежние ключи CamelCase-нормализации с дефисами не мигрируют; новые ключи используют lowercase исходного имени. Проверка raw имён ловит case-only дубликаты и рядом с legacy ключами. Текущий CLI принимает старый реестр без graphic для прежних типов; старый CLI с новым реестром может отклонить неизвестное поле — обновление CLI/реестра совместное.

## Проверки

| id | kind | status | source |
|---|---|---|---|
| plugin | typecheck/build/tests | passed | `npm run verify --prefix src/figma-plugin`: 64 passed, 0 failed |
| core | build/regression | passed | `.tools/dotnet/dotnet.exe build ExtronExporter.slnx --no-restore`: 0 warnings/errors; `run --project tests/format --no-build`: 137 passed |
| browser | actual Chromium UI | passed | [JSON](2026-10-19-logo-momentary-browser.json): справочник открывается клавиатурой, ручная форма graphic без controlId, прежние preview/apply/download/bridge и ошибка восстановления; 0 page errors |
| visual | rendered reference | passed | Просмотр `output/figma-plugin/browser-1792419214780/prefix-reference.png`: объяснения префиксов помещаются по ширине, длинная таблица прокручивается вертикально |
| native | CLI/writer/independent reader | passed | [JSON](2026-10-19-logo-momentary-integration.json): обе панели, v1 65/65, v3 63/63, v4 73/73 |
| compatibility | regression/failure paths | passed | Case-equivalent names, legacy metadata и duplicate names; пассивный graphic; invalid PNG reference/size/controlId/fields; обязательный press momentary и отказ v3; прежние данные/состояния/ID |
| figma-gui-device | real Figma, GUI, Build, hardware | unavailable | В этой проверке не запускались; Figma API/PNG-рендер явно моделировались |

Native команда: `DOTNET_EXE=.tools/dotnet/dotnet.exe`, `EXUI_DONOR_REGISTRY=samples/donors.json`, `node src/figma-plugin/test/native-integration.ts output/figma-plugin/logo-momentary-20261019`. Новый fixture содержит две кнопки (Normal/Pressed и тройку Off/On/Pressed), Label, Level и Frame logo_Company с PNG. Для обеих панелей проверены PBImage, userId 0, native-layout 3, PNG resource, отсутствие состояний/формы/заливки и кнопка с press=1, двумя состояниями Normal/Pressed и жёлтым цветом #FFCC00 у Pressed. Все 73 проверки независимого verifier пройдены. Прежние пути v1/v3 также прошли настоящий writer.

## Review и выпуск

Самостоятельно проверены новые схемы, версия, графика, projections состояния, ключи/ID, ссылки/ресурсы, новый optional реестр, очистка temporary PNG, ошибки и native fields. Существенных незакрытых дефектов в проверенном пути нет. Область видимого состояния при физическом удержании и возврата по feedback требует ручной проверки в GUI Designer/на устройстве; данные press/default записаны writer, это не hardware-подтверждение.

Решение: **SHIP WITH KNOWN RISKS** для локального development-плагина. Для logo/momentary необходим обновлённый CLI с v4. Новых зависимостей и сетевых разрешений нет. Не добавлены AV-команды, динамическая привязка процентов, группы, произвольные layouts или кастомный Slider. Внутренняя графика PBImage растрируется; отдельный объект, позиция и ресурс редактируемы.

Архив `releases/figma-plugin/0.1.5/figma-extron-plugin-0.1.5.zip`: 69 572 байт, SHA-256 `0784981AC150FB8BF92849E068BA94949837CADE2206A9FE36FECE0E6EB182BA`. Внутри собранный плагин, PREFIXES.md и полный стандарт. Локально распакован в соседний игнорируемый каталог unpacked. Старые архивы сохранены, работа велась в main без новых веток/worktree.

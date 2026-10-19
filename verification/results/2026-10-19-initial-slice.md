# Первый исследовательский срез — 19 октября 2026

## Выполнено

- Инициализирован локальный Git-репозиторий без commits/remote.
- Подготовлена неизменяемая по правилам проекта копия пользовательского GDL и манифест с SHA-256.
- Собраны библиотека Extron.Format, CLI inspect/repack и исполняемый набор проверок.
- Установлен приватный SDK 10.0.402 в `.tools/dotnet`, без изменения PATH; зависимости зафиксированы lock-файлами.
- Сборка всей solution: 0 предупреждений, 0 ошибок; restore в locked mode.
- Проверки: **61 passed, 0 failed** — 16 синтетических, 1 реальный GDL, 44 GLT. Лог: `format-tests.txt`.
- Исследование исходного GDL: `full-test-project-inspection.json`.
- Создан `output/Full-Test-Project-repacked.gdl`, 1 612 654 байта. SHA-256: `BDE05538CAD3632B3330436A5B97EC88710CE7616F278CFE71EB962A475884D2`.
- Payload исходника и пересобранной копии побайтово одинаков; его SHA-256: `03B8AF83B00EB9F45C85AD6A7CC3E6C7F52EDD5B78D11368AFD0FE4723D1E14C`.

Разница размеров контейнеров вызвана новой упаковкой DEFLATE. Изменение графа объектов не выполнялось.

## Доказательства по видам проверки

| id | kind | status | source |
|---|---|---|---|
| build-01 | build | passed | dotnet build ExtronExporter.slnx --no-restore, 0 warnings/errors |
| deps-01 | dependency-lock | passed | dotnet restore ExtronExporter.slnx --locked-mode |
| tests-01 | automated | passed | format-tests.txt: 61/61 |
| payload-01 | integrity | passed | tests + full-test-project-inspection.json |
| review-01 | code-review | passed | Self-review: bounds, CRC, decompression limits, no-overwrite CLI; independent reviewer not used |
| ui-original-01 | real-surface-observation | passed | Existing GUI Designer window showed TLP Pro 300M / Full-Test-Project.gdl |
| ui-repacked-01 | real-surface-open | unavailable | Computer Use did not target owned Open dialog input; not proven |
| verify-01 | GUI Designer Verify | unavailable | Repacked project not opened |
| build-gui-01 | GUI Designer Build | unavailable | Repacked project not opened |
| hardware-01 | device | unavailable | No device validation performed |

## Ограничение проверки UI

Computer Use обнаружил открытый GUI Designer и исходный проект. Через Ctrl+O открылся диалог Open, однако отдельный target окна диалога не появился в перечислении окон, а ввод в поле имени файла не сработал. Пересобранный проект не был открыт. Диалог отменён, исходный проект оставлен открытым и не сохранялся. Хеш исходного файла проверен отдельно.

Это ограничение канала автоматизации, а не зарегистрированный отказ GUI Designer открывать результат.

## Границы проверки кода

Проверены отказы для повреждённого контейнера, неправильной контрольной суммы, противоречащих размеров, переполненных объявленных размеров, неподдержанных флагов, чужого имени записи, нескольких записей, некорректного NRBF и распаковки большей/меньшей заявленного размера. CLI отдельно проверен на отказ перезаписи существующего результата.

Следующий шаг: контролируемые минимальные эталоны и подтверждение открытия пересобранного проекта, затем исследование записи изменённых записей и project checksum.

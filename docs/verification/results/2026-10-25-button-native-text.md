# Текст кнопок для GCP — 0.8.1

## Результат

В экспортёре добавлен обратимый режим «Текст кнопок для GCP». Одна видимая непустая подпись состояния, включая вложенную в Artwork, становится текстом состояния Button. Она исключается из временной копии PNG; отдельный PBLabel не создаётся. Положение в GDL выбирается явно: Middle-Center или Bottom-Center. Исходные текстовые слои Figma остаются редактируемыми и не перемещаются. Простое изменение Text Alignment у отдельного Label не меняет владельца текста и само по себе не устраняет дублирование при Text Feedback.

Плагин 0.8.1, совместимый CLI 0.8.0, EXUI/5. Работа выполнена в основной папке на main. Сторонние изменения CLI, формата Extron и updater не включены в исправление плагина.

## Проверки

| Проверка | Результат и источник |
| --- | --- |
| TypeScript, unit, production build | `npm run verify --prefix src/figma-plugin`: 640/640, `output/gcp-text-live-repair/verify-final.log` |
| Настоящий UI и bundle в Chromium | Применение/отмена, клавиатура, ширины 320/420, область выделения, пустое выделение: passed, `output/button-native-text-browser/browser.json`. Figma API моделируется. |
| Генератор и независимый reader Extron | Две панели × два выравнивания; текст Button, отсутствие отдельного Label, сохранение ID, замена текста через CLI: passed, `output/button-native-text-integration/integration.json`. Figma API/PNG моделируются; это не проверка живого Text Feedback GCP. |
| Настоящий экспорт документа Figma | 5 экранов, 8 popup, 3 группы, 217 элементов, 288 ресурсов. Всего 134 кнопки, из них 126 с текстом, 8 без текста. Отдельных `button-caption.*` — 0. `output/gcp-text-live-repair/exported-screen.json` |
| Валидация настоящего EXUI | ZIP, schemas, semantics: passed, `output/gcp-text-live-repair/package-validation.json` |
| Генерация настоящего GDL | 2801/2801 passed, `output/gcp-text-live-repair/generation.json` |
| GUI Designer 1.28.0.7 Verify | `Build Complete - 0 error(s), 0 warning(s)`, `output/gcp-text-live-repair/gui-verify.txt` |
| GUI Designer Save And Build | Завершён, сохранён GDL со встроенным `.tgz4`, Build.StatusValue=0, версия 0.0.2. Независимое чтение: `output/gcp-text-live-repair/built-controls.json` |
| Сохранение текста после GUI Designer | Все 134 Button, их ObjectId/ControlId, тексты состояний и FlattenText совпали до и после Save And Build. CH01 Terrace: ID 9153, Text=Broadcast 1, Bottom-Center, Use Flattened Text=False. `output/gcp-text-live-repair/gui-native-button.txt` |

## Изменения в живом макете

Документ `2026-10 - Trilliant`, страница `TTLP Pro 1025M | 1280x800`. Режим применён ко всем 126 кнопкам с текстом; у источников подпись снизу, у Mute — по центру. В Figma оставлена скрытая резервная группа `Backup before GCP text repair 2026-10-24` (125:7), содержащая копии AudioControl, VideoControl, VideoControls и WallLayouts до исправления ошибок подготовки.

Для полного экспорта дополнительно исправлены существовавшие ошибки авторинга:

- Пустая дублирующая кнопка VideoControl перемещена в резервную группу.
- В Video Terrace Mute фон состояний приведён к размеру кнопки 218×68.
- Два контейнера WallLayouts получили имена popup_WallSplit / popup_WallGrid вместо popupref_ViewScreen.
- Декоративные элементы WallGrid, Divider5 и неподдержанные нативные заливки помещены в прозрачные image_ Frame для экспорта графики. Текст кнопок при этом остаётся нативным. Для Divider5 в ходе диагностики также задавался strokeAlign=CENTER.
- Для 5 неподготовленных кнопок созданы состояния из существующих образцов; готовые состояния не перерисовывались.
- VideoControl и VideoWallControl переведены из shownBy=navigation в shownBy=program, как AudioControl: входящих навигационных назначений в макете не было. Новые переходы не добавлены; переключение этих экранов должно выполнять управление GCP.
- Распознавание назначило свободные ключи/ID новым элементам и исправило владельцев скопированных назначений. Сохранённые корректные ID исходных элементов не менялись. Совместимость с назначениями конкретного проекта GCP ещё требует reconciliation.

Figma показывает предупреждение о невозможности синхронизации. Изменения находятся в локальном открытом документе; облачная синхронизация не подтверждена. Приложение не перезапускалось.

## Файлы

Все файлы проекта находятся в `output/gcp-text-live-repair/`:

| Файл | SHA-256 |
| --- | --- |
| trilliant-native-button-text-1025m.exui | 7A93658D0782043C64154C3A5847AE53B48187C8812AE87CF01EADF084A11F56 |
| trilliant-native-button-text-1025m.gdl | 320B987FFB4752F1401255F0289F3DA526B148C4789E4214E49D14BF90EFB316 |
| trilliant-native-button-text-1025m-built.gdl | 44212D9F5C3F489D01BC35C6DE82A73995E7767DC9F17A6010639BAAE16524B7 |

Архив плагина: `releases/figma-plugin/0.8.1/figma-extron-plugin-0.8.1.zip`; контрольная сумма в `SHA256SUMS`. Установленный development manifest вновь использует штатную сборку, не одноразовый скрипт ремонта.

## Граница проверки

Файл готов для обновления интерфейса через штатный Layout Reconciliation с сохранением назначений. На момент проверки в GCP уже открыто незавершённое окно Layout Reconciliation неизвестного импорта; оно оставлено без изменений. Текущий несохранённый GCP-проект не перезаписывался. Живой Text Feedback GCP, Build GCP и физическая тачпанель не проверены. Решение: SHIP для исправления экспортёра и построенного GDL; обновление действующего GCP требует отдельной проверки соответствия назначений.

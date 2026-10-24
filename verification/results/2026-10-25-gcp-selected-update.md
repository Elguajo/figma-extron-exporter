# Выборочное обновление компоновки в копии GCP — 25.10.2026

Решение: **PASS** для выборочного обновления трёх кнопок в копии проекта GCP. Исходный пользовательский проект не открывался и не изменялся. Рабочие файлы находятся в `output/gcp-verify-20261025/` (исключено из Git).

## Причина выборочного обновления

В новом GDL из Figma отсутствуют **88 из 117** прежних ID кнопок ручных экранов и popup (`button-id-comparison.json`). Полный импорт такого GDL отвязал бы их команды. Кнопка `button_CH01` сохранила исходный ID и имеет настроенные команды и Text Feedback, поэтому она использована как контрольная точка. Обновлены только совместимые кнопки:

| ID | Имя | Экран |
| --- | --- | --- |
| 9166 | `button_Start` | `screen_StartPage` |
| 9140 | `button_CH01` | `popup_HallSources` |
| 9153 | `button_CH01` | `popup_TerraceSources` |

Остальные 114 кнопок и ручные popup в GDL не менялись (`selection.json`, `update-result.json`).

## Проверки

| Проверка | Статус | Источник |
| --- | --- | --- |
| GUI Designer Verify | passed: 0 ошибок, 0 предупреждений | `gui-verify.txt` |
| GUI Designer Save and Build, независимое сравнение | passed: 179 нетронутых элементов без отличий; меняется только `TlpImageId`, который GUI Designer пересоздаёт при сборке | `independent-update-verification.json` |
| GCP Layout Reconciliation | passed: «Only show conflicts» — пустой список для Buttons, Labels and Levels и для Pages; выбрано «Import new layout and keep my existing layout configuration» | `reconciliation.txt` |
| Start: Press | совпадает: `TLP Pro 1025M Show Page (screen_MainDashboard)` | GCP, база и копия |
| Terrace CH01: Press | совпадает. If `Audio Terrace Page Selection = 1`: Group Mute 25 Off, 21 On, 23 On; `Audio Terrace BGM Selection 1`; Invoke Macro `BGM TERACE`. Else If `= 2`: 25 On, 21 On, 23 Off | GCP, база и копия |
| Terrace CH01: Text Feedback | совпадает: 2 → `Floorbox 1`, 1 → `BGM CH 1` | GCP, база и копия |
| Hall CH01: Press | совпадает. If `Audio Hal Page Selection = 1`: Group Mute 24 Off, 20 On, 22 On; `Audio Hall BGM Selection 1`; Invoke Macro `BGM HALL`. Else If `= 2`: 24 On, 20 On, 22 On | GCP, база и копия |
| Hall CH01: Text Feedback | совпадает: 2 → `HDMI`, 1 → `BGM CH 1` | GCP, база и копия |
| Visual Feedback нетронутой Mute (Terrace) | совпадает: `DMP 128 Plus C AT Group Mute (Group 4)`, off → Off, on → On | GCP, база и копия |
| Button Group, Hold Time, Repeat Rate, Press Feedback трёх кнопок | совпадают: 0 : None, выкл., выкл., State | GCP, база и копия |

Сверка в GCP выполнена открытием обеих копий: `trilliant-baseline.gcplus` (до импорта, не изменялась) и `trilliant-selected-update.gcplus` (после импорта, сохранена). Значения комбобоксов, которых нет в текстовых снимках `baseline-*.txt`, сравнивались визуально по обеим копиям.

## Ожидаемые отличия

- **Button Label** теперь заполнено нативным текстом из Figma: Start → `Start`, обе CH01 → `Broadcast 1`; в базе поле было пустым. Это цель нативного текста Button. Во время работы Text Feedback CH01 заменяет подпись значением из `Audio … Page Selection`.
- Изображения трёх кнопок заменены новыми из GDL.

## Файлы

| Файл | SHA-256 |
| --- | --- |
| `trilliant-baseline.gcplus` | 8c36d23a0b468f776a38bca3c3f8dca4aaf24adbd3ec0da3299ac80c6b648cab |
| `selected-update.gdl` | a7377ac78bde3bbc00b4ff1f29bcafed353e23cd5e0acd5a071eb6605d26be63 |
| `trilliant-selected-update.gcplus` | 7bf2f018b7ea97c00ebcdece60a61ceddd0e16a049d80bacf744d2c6debf18e5 |

## Границы проверки

- Build/загрузка в процессор и проверка на физической панели TLP Pro 1025M не выполнялись.
- Оставшиеся 88 кнопок с изменившимися ID этим обновлением не переносятся. Для их обновления нужно сначала восстановить исходные ID в Figma, иначе полный импорт отвяжет их команды.
- Обновлённая копия не заменяет рабочий проект автоматически; перенос в рабочий проект — отдельное решение пользователя.

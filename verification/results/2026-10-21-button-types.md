# Разделение кнопок — плагин 0.2.2

21.10.2026. Итоговое уточнение пользователя: **обычная кнопка — Off + On; второй тип — Normal + Active + Pressed**. Первоначальное предположение о Normal/Pressed для обычной кнопки заменено этим правилом. Работа в основной папке `main`; прежние изменения, исходный Home и релизы сохранены, commit/push не выполнялись.

## Реализованное поведение

| Новая кнопка | Состояния / роли / ID | Native press feedback |
|---|---|---:|
| `button_` / `btn_`, «Обычная» | Off (normal, 0), On (feedback, 1), строго два | −1, отдельного Pressed нет |
| `feedbackbutton_` / `fbtn_`, «С feedback» | Normal (normal, 0), Active (feedback, 1), Pressed (pressed, 2), строго три | 2 |

Тип проверяется и при распознавании, и при capture/export. Неверный набор блокирует экспорт без создания/удаления состояний. Префиксы нечувствительны к регистру; st_/state_ у состояния допустимы и убираются из имени EXUI. В форме добавлен «Тип кнопки», в таблице распознавания виден набор. Новое демо использует Normal/Active/Pressed. On/Active задаёт программа Extron; автоматического переключения и AV-команд нет.

## Совместимость

Влияние MEDIUM: изменяется авторинг/сохранённый тип, EXUI и native writer не меняются. Новые кнопки сохраняют `buttonMode: on-off | feedback` в **exui-node/3**, под прежними private ключом `exui` и plugin ID. Плагин 0.2.1 отказывает на schema/3 вместо молчаливой потери смысла типа. Старые exui-node/1 и /2 читаются без перезаписи; фоновой миграции нет. Сохранённые тип/ID важнее нового имени слоя. Legacy Normal/Pressed, Off/On/Pressed и произвольные feedback-состояния остаются совместимыми.

В форме legacy-пункт доступен только для сохранённой кнопки без нового типа. Новые типы нельзя понизить до legacy этим пунктом. При явном выборе нового типа ID кнопки сохраняются; автор согласует имена/роли/ID состояний. Дизайн и private metadata настоящего Home не изменялись.

Новые кнопки экспортируются как обычный `kind: button` с существующими ролями в **exui/5**. Достаточно CLI **0.2.1**. Все DLL полного комплекта побайтово совпали с выпущенным CLI: [паритет](2026-10-21-button-types/cli-binary-parity.json). Упаковщик читает compatibleCliVersion, чтобы версия плагина не требовала изменения writer. Старые архивы 0.2.1 не заменялись.

## Проверки

| Проверка | Результат | Источник |
|---|---|---|
| Typecheck, unit, build | PASS, **97/97**: оба набора, ошибки без записи, rename/ID, legacy, старый producer refusal | [verify](2026-10-21-button-types/plugin-verify.txt), [финальный typecheck](2026-10-21-button-types/typecheck-final.txt) |
| Source → настоящий CLI / Extron writer | PASS, **16 сценариев** для 1025M/300M, включая новые типы и прежние возможности | [журнал](2026-10-21-button-types/native-integration.txt), [JSON](2026-10-21-button-types/native-integration.json) |
| Архивный UI в Chromium | PASS, тип кнопки, legacy-пункт, preview, скачивания обеих панелей, клавиатура и ошибки; page errors нет | [журнал](2026-10-21-button-types/browser-archive.txt), [JSON](2026-10-21-button-types/browser-archive.json) |
| code.js из ZIP → Release CLI | PASS, **8 сценариев**: на каждом профиле Off/On **63/63**, Normal/Active/Pressed **66/66**, прежние пустые подписи **73/73**, расширенные типы **103/103** | [журнал](2026-10-21-button-types/archive-smoke.txt), [JSON](2026-10-21-button-types/archive-smoke.json) |
| Native имена/связь нажатия | PASS, точные имена Off/On с press −1, Normal/Active/Pressed с press 2 | Независимое list-controls в source- и archive-прогонах |
| code-review / migration | PASS: версия metadata, сохранность ID/legacy, отказ старого producer, неизменность EXUI/writer, защита архивов | Локальный diff и проверки выше; отдельный агент не запускался |

В Figma API/PNG-прогонах используется fixture. Архивный main реально исполняется в VM; встроенный HTML сравнивается с UI в ZIP. EXUI этого прогона упакован функцией из исходников, архивный UI/download отдельно проверен Chromium. CLI/x86 writer настоящие, native результат читается независимым NRBF reader. Это не Figma Desktop/GUI Build/касания панели.

Браузерная проверка помогла уточнить accessible label нового select: добавлен aria-label. Disabled/hidden legacy option проверяется по DOM-свойствам; Playwright isDisabled для скрытого option не подтвердил фактический disabled-флаг. Приход асинхронного legacy-selection ожидается явно. Диагностические журналы сохранены отдельно, итоговый архивный прогон зелёный.

**Решение release-check: SHIP WITH KNOWN RISKS для программного комплекта.** Реальный Desktop/GUI Build новых назначений и оборудование в этом изменении не проверены. [Прежний настоящий Home/GUI-цикл 0.2.1](2026-10-21-release-0.2.1.md) остаётся отдельным доказательством.

## Артефакты

- [Плагин 0.2.2](../../releases/figma-plugin/0.2.2/figma-extron-plugin-0.2.2.zip): **88127 байт**, SHA-256 `4561F5C0A20FA39AF4C46AF7684C4DCFCF9DE98834E3CA1643D0703115931D02`.
- Полный локальный ZIP: `output/releases/0.2.2/figma-extron-complete-0.2.2-local.zip`, **5820244 байт**, SHA-256 `0722DC8928770D308F64314F97C1134F46EE001D89408EF0AA3B271E703507DF`. Внутри плагин 0.2.2, CLI 0.2.1, доноры и прежний Home. Сторонние GDL остаются только в игнорируемом output.
- [Хеши](2026-10-21-button-types/artifacts.json), [упаковка](2026-10-21-button-types/packaging-final.txt), [установка](../../releases/figma-plugin/0.2.2/README.md). Первые локальные кандидаты сохранены как `.candidate.zip`; прежние выпущенные архивы не менялись.

Импортировать manifest из нового архива с прежним plugin ID; перезапустить и проверить заголовок **0.2.2**. Новые имена задают тип при первом назначении. Для существующей кнопки выбрать тип в форме и явно согласовать состояния; одно переименование тип не меняет. Возврат к 0.2.1 после появления metadata/3 требует прежней резервной копии документа: автоматического downgrade нет.

Для повторения (новые пути результатов):

```powershell
$env:DOTNET_EXE = (Resolve-Path '.tools/dotnet/dotnet.exe').Path
node src/figma-plugin/test/archive-smoke.ts releases/figma-plugin/0.2.2/figma-extron-plugin-0.2.2.zip output/releases/0.2.2/installed output/button-types-recheck/archive
$env:EXUI_PLUGIN_UI = (Resolve-Path 'output/releases/0.2.2/installed/figma-plugin/dist/ui.html').Path
node src/figma-plugin/test/browser.ts output/button-types-recheck/browser
```

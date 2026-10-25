<a id="russian"></a>

# Проверка настоящего проекта

**Русский** · [English](#english)

- [x] Проверить SHA-256 копии исходного образца.
- [x] Прочитать KP-контейнер, проверить размеры и CRC.
- [x] Декодировать NRBF без загрузки объектов Extron.
- [x] Пересобрать контейнер и доказать неизменность payload.
- [x] Проверить штатные GLT на чтение NRBF и пересборку контейнера.
- [x] Открыть пересобранный GDL в GUI Designer 1.28.0.7.
- [x] Проверить редактируемость и соответствие выбранной кнопки.
- [x] Выполнить Verify: 0 ошибок, 0 предупреждений.
- [x] Выполнить штатный Save and Build в GUI Designer: сохранение завершено, ошибок в UI не наблюдалось.
- [x] Закрыть и повторно открыть сохранённую копию.
- [x] Повторить с подписью «Музыка», ID 8000, оба состояния.
- [x] Создать новые объекты из описания (страница, Button, Label, Level, PNG) для TLP Pro 1025M и 300M; независимая проверка данных 61/61 — `results/2026-10-19-first-screen.md`.
- [x] Повторить с новым объектом в GUI: открыть `output/first-screen/*.gdl`, проверить элементы, ID, кириллицу и иконку, отредактировать, Verify, Save and Build, закрыть, открыть снова (`tests/fixtures/first-screen/README.md`).
- [x] Подтвердить в GUI профиль TLP Pro 1025M: сгенерированный проект открылся как TLP Pro 1025M и собрался (сам донор не открывался).
- [x] Создать несколько страниц, обычные и модальные popup, группу и ссылки на popup (`exui/2`) для обеих панелей; независимая проверка 271/271 — `results/2026-10-19-pages-popups.md`.
- [x] Открыть копии `output/exui-v2/pages-popups-*.gdl` в GUI: ссылки на popup не «Unassigned», группа «Источники», модальный popup; Verify, Save and Build, повторное открытие; затем выполнить `--gui-built-pages` (результат и ограничения ниже).

  Итог 19.10.2026: пользователь подтвердил GUI-проверки, намеренные ручные правки и повторное открытие обеих актуальных копий в `output/exui-v2/gui-work/` («Всё ок без проблем»); Build подтверждён данными. Последний строгий прогон: 129 passed / 2 failed — только геометрия ручных правок относительно исходных пакетов. Дополнительная проверка ID, ссылок, групп, Modal и изображений: 18/18. Это выполненный ручной цикл и прогон данных с объяснёнными отклонениями, а не утверждение о полностью зелёном строгом тесте. Точные числа Verify не записаны.

  - [x] Зафиксировать сообщения пользователя об открытии, привязках, группе, Modal, ID, кириллице, трёх состояниях и иконке обеих панелей.
  - [x] Подтвердить Build обеих актуальных копий данными файла, записать SHA-256 и проверить сохранность ID и связей после ручных правок.
  - [x] Извлечь актуальные layout и PNG без шрифтов; подтвердить различия PNG состояний всех 13 кнопок каждой панели.
  - [x] Зафиксировать подтверждение пользователя о повторном открытии обеих актуальных копий после последних правок и Build.
  - [ ] Записать точные errors/warnings отдельного Verify: пользователь сообщил «Всё ок без проблем», чисел нет; в протоколе они оставлены неизвестными.

- [ ] Проверить управление и feedback на реальной панели.

Не отмечать последующие пункты на основании предыдущих. Работать с копиями, не перезаписывая исходники.

Протоколы: `results/2026-10-19-gui-text-edit.md`, `results/2026-10-19-first-screen.md`, `results/2026-10-19-pages-popups.md`. Build — штатное действие пользователя внутри GUI Designer, не функция экспортёра.

## Контракт пакета, этап 5

- [x] Вручную подготовить `.exui/1` для 1025M и 300M, зафиксировать JSON Schema и версии.
- [x] Проверить ZIP/JSON/PNG, ссылки, ID и ошибки без Extron.
- [x] Сгенерировать оба GDL через неизменённый x86-хост, независимо проверить данные.
- [x] Сравнить с экспериментальным путём побайтово, повторить генерацию, сохранить ID после изменений.
- [x] Подтвердить неизменность доноров/исходников и отсутствие новых конечных файлов при отказах.
- [ ] Выполнить отдельный ручной GUI-цикл новых пакетных результатов; историческая проверка эквивалентного экрана этапа 4 остаётся отдельной (Verify counts неизвестны).
- [ ] Проверить работу на устройстве при появлении оборудования.

Протокол: `results/2026-10-19-exui-v1.md`. Последние два пункта не считаются автоматическими проверками.

---

<a id="english"></a>

# Checking a real project

[Русский](#russian) · **English**

- [x] Check the SHA-256 of the copy of the source sample.
- [x] Read the KP container, check sizes and CRC.
- [x] Decode NRBF without loading Extron objects.
- [x] Rebuild the container and prove that the payload is unchanged.
- [x] Check the standard GLTs for NRBF reading and container rebuilding.
- [x] Open the rebuilt GDL in GUI Designer 1.28.0.7.
- [x] Check that the chosen button is editable and matches.
- [x] Run Verify: 0 errors, 0 warnings.
- [x] Run the standard Save and Build in GUI Designer: saving completed, no errors were seen in the UI.
- [x] Close and reopen the saved copy.
- [x] Repeat with the caption «Музыка» (Music), ID 8000, both states.
- [x] Create new objects from a description (page, Button, Label, Level, PNG) for TLP Pro 1025M and 300M; independent data check 61/61 — `results/2026-10-19-first-screen.md`.
- [x] Repeat with a new object in the GUI: open `output/first-screen/*.gdl`, check elements, IDs, Cyrillic text and the icon, edit, Verify, Save and Build, close, open again (`tests/fixtures/first-screen/README.md`).
- [x] Confirm the TLP Pro 1025M profile in the GUI: the generated project opened as TLP Pro 1025M and built (the donor itself was not opened).
- [x] Create several pages, ordinary and modal popups, a group and popup links (`exui/2`) for both panels; independent check 271/271 — `results/2026-10-19-pages-popups.md`.
- [x] Open copies of `output/exui-v2/pages-popups-*.gdl` in the GUI: popup links are not "Unassigned", the «Источники» (Sources) group, the modal popup; Verify, Save and Build, reopen; then run `--gui-built-pages` (result and limits below).

  Result on 19 Oct 2026: the user confirmed the GUI checks, intentional manual edits and reopening of both current copies in `output/exui-v2/gui-work/` ("All fine, no problems"); Build is confirmed by the data. Last strict run: 129 passed / 2 failed — only the geometry of the manual edits compared with the source packages. Additional check of IDs, links, groups, Modal and images: 18/18. This is a completed manual cycle and a data run with explained deviations, not a claim of a fully green strict test. The exact Verify numbers were not recorded.

  - [x] Record the user's reports on opening, bindings, the group, Modal, IDs, Cyrillic text, three states and the icon for both panels.
  - [x] Confirm Build of both current copies from the file data, record the SHA-256 and check that IDs and links survived the manual edits.
  - [x] Extract the current layouts and PNGs without fonts; confirm that the state PNGs of all 13 buttons of each panel differ.
  - [x] Record the user's confirmation of reopening both current copies after the last edits and Build.
  - [ ] Record the exact errors/warnings of a separate Verify: the user reported "All fine, no problems" without numbers; the report leaves them unknown.

- [ ] Check control and feedback on a real panel.

Do not tick later items based on earlier ones. Work on copies and never overwrite the sources.

Reports: `results/2026-10-19-gui-text-edit.md`, `results/2026-10-19-first-screen.md`, `results/2026-10-19-pages-popups.md` (in Russian). Build is a standard user action inside GUI Designer, not a feature of the exporter.

## Package contract, stage 5

- [x] Prepare `.exui/1` for 1025M and 300M by hand, record the JSON Schema and versions.
- [x] Check ZIP/JSON/PNG, links, IDs and errors without Extron.
- [x] Generate both GDLs through the unchanged x86 host and verify the data independently.
- [x] Compare byte for byte with the experimental path, repeat generation, keep IDs after changes.
- [x] Confirm that donors/sources are unchanged and that no new output files remain after refusals.
- [ ] Run a separate manual GUI cycle of the new package results; the historical check of the equivalent stage 4 screen stays separate (Verify counts unknown).
- [ ] Check operation on a device once hardware is available.

Report: `results/2026-10-19-exui-v1.md` (in Russian). The last two items are not counted as automated checks.

# GUI Designer и изменение подписи — 19 октября 2026

## Результат

На GUI Designer 1.28.0.7, профиль TLP Pro 300M, проверены два варианта Full-Test-Project: пересборка с неизменным payload и программное изменение подписи кнопки Start на «Музыка». Оба открываются, позволяют редактировать кнопку, проходят Verify, штатный Save and Build и повторное открытие.

Build выполнялся только внутри GUI Designer для проверки совместимости. Результат экспортёра — редактируемый GDL; сборка панели остаётся действием пользователя в редакторе.

## Доказательства

| id | Проверка | Статус | Источник |
|---|---|---|---|
| repack-open | Открытие исходного результата repack | passed | Через Проводник; заголовок Full-Test-Project-repacked.gdl, страница Start |
| repack-edit | Редактируемость | passed | Выбрана Start, ID 8000, Text изменён на Press to begin TEST; пробные изменения отброшены |
| repack-verify | Verify | passed | [repacked-verify.png](2026-10-19-gui/repacked-verify.png): 0 error(s), 0 warning(s) |
| repack-save-build | Штатный Save and Build | passed | Build Manager, затем возврат редактора без ошибки; исчезла звёздочка, файл сохранён, появились дополнительные записи |
| repack-reopen | Закрытие и повторное открытие | passed | [repacked-reopened.png](2026-10-19-gui/repacked-reopened.png) |
| music-open | Открытие программного результата | passed | [music-properties.png](2026-10-19-gui/music-properties.png): Музыка в макете и обоих состояниях, Start, ID 8000 |
| music-verify | Verify | passed | [music-verify.png](2026-10-19-gui/music-verify.png): 0 error(s), 0 warning(s) |
| music-save-build | Штатный Save and Build | passed | [music-after-save-build.png](2026-10-19-gui/music-after-save-build.png), сохранённый файл 2 562 619 байт |
| music-reopen | Закрытие и повторное открытие | passed | [music-reopened.png](2026-10-19-gui/music-reopened.png): подпись сохранена |
| music-edit | Редактирование после reopen | passed | [music-editability.png](2026-10-19-gui/music-editability.png): Музыка TEST; закрыто с No, пробная правка не сохранена |
| integrity | Исходники неизменны | passed | [file-hashes.json](2026-10-19-gui/file-hashes.json), до/после совпадает с samples/manifest.json |
| automated | Проверки формата и редактора | passed | 78/78: [полный лог](2026-10-19-text-edit-tests.txt); 34/34 без GLT: [focused log](2026-10-19-text-edit-focused-tests.txt) |
| build-code | Сборка solution | passed | dotnet build ExtronExporter.slnx --no-restore: 0 warnings/errors |
| cli-errors | Отказ перезаписи и неподдержанного входа | passed | Existing-output: exit 1, SHA прежний; built multi-entry GDL: exit 1 с ERROR, без unhandled exception |
| reproduction | Повторное создание | passed | [music-edit.json](2026-10-19-gui/music-edit.json), SHA полностью совпал с music-generated.gdl |
| review | Self-review изменения | passed | ButtonTextEditor, CLI, контейнер и тесты; проверены границы, владение общими строками/состояниями, точность изменения и отказ перезаписи; независимый reviewer не использован |
| hardware | Проверка на панели | unavailable | Оборудование не проверялось |

Для Save and Build окно результата закрылось автоматически. Отдельный финальный счётчик ошибок этой операции не сохранён; 0/0 зафиксировано непосредственно для Verify каждого варианта. Сохранение, новые записи контейнера и повторное открытие проверены отдельно.

## Воспроизведение

1. Использовать исходный single-entry GDL из samples/original, сверив SHA с манифестом. Не использовать собранный GUI Designer файл как вход текущего reader.
2. `dotnet run --project src/cli --no-build -- repack samples/original/Full-Test-Project.gdl output/new-repacked.gdl`.
3. Открыть результат двойным щелчком в Проводнике. Диалог Open не пригоден для автоматизации текущим Computer Use: ввод активирует главное окно. Щелчки по снимку дочернего диалога работают; имя файла не вводится. Это ограничение канала автоматизации.
4. Выбрать кнопку Start на странице Start: Text Press to begin, ID 8000, Left 65, Top 159, Width 190, Height 66. Проверить редактирование на копии, не сохранять пробную подпись.
5. Verify → Build Complete, 0 errors, 0 warnings. Штатный Save and Build → сохранение; закрыть проект и открыть сохранённый файл через Проводник.
6. Создать новый вариант: `dotnet run --project src/cli --no-build -- set-button-text samples/original/Full-Test-Project.gdl output/new-music.gdl 8000 "Press to begin" "Музыка"`.
7. Повторить открытие, свойства кнопки и обоих состояний, Verify, штатное сохранение/сборку и reopen. Проверить возможность редактирования, отбросить пробную правку.

SDK в этой среде: `.tools/dotnet/dotnet.exe`. Каталог output должен существовать; все команды создают только новые файлы.

## Что именно изменено

В обоих PBState кнопки Start textField ссылается на BinaryObjectString 8597. Заменены длина и UTF-8 значение записи по смещению 2540980: 15 → 13 байт. Остальной NRBF побайтово сохранён. Размер payload: 2 652 133 → 2 652 131 байт, SHA после изменения `7F673C896CBD22248AA9455B0BA54B1D8DB076F92C57E9F3C7B67B243D029DD1`.

Проверки до записи: уникальная кнопка 8000; согласие унаследованных UInt16 ID; одинаковая ожидаемая подпись состояний; отсутствие formatted text и внешних владельцев строк/состояний. Проверки после: полный NRBF decode, прежние record IDs и все поля классов, кроме выбранных textField. Обратная замена полностью восстанавливает исходный payload. Отдельный синтетический граф проверяет две разные строковые записи, общую строку с другим объектом, общую коллекцию и общие состояния.

## Файлы и границы

- `output/Full-Test-Project-repacked-before-gui.gdl` — точный repack до штатного сохранения: 1 612 654 байта.
- `output/Full-Test-Project-repacked.gdl` — после Save and Build: 2 562 606 байт.
- `output/Full-Test-Project-music-generated.gdl` — программный результат до GUI-сохранения: 1 612 656 байт, SHA `548FB94E4971C2530AB3992C2D3B64CFD0BFEE48161FEA8439B66D3E1CC060C1`.
- `output/Full-Test-Project-music.gdl` — после Save and Build: 2 562 619 байт, SHA `22439A46458F3274D7297E6E10BAFE2BCDF8373DD495BB3FF4E62FBB7F9E614B`.
- Родительский Full-Test-Project.gdl и samples/original/Full-Test-Project.gdl: SHA `BA092E45129E08A1A8E2EC601F0EA95B7F07C7670AB7693FA9F3C956AF6752E1`, без изменений.

Save and Build добавляет записи в контейнер: [built-directories.json](2026-10-19-gui/built-directories.json). Текущий single-entry reader такой результат отклоняет. Экспортёр не меняет уже собранные GDL, не создаёт новые объекты и не реализует Build. Проверена только версия 1.28.0.7 и один профиль. Ненулевой checksum не поддержан. Этап 4 (собственный экран с новыми объектами) ещё не выполнен.

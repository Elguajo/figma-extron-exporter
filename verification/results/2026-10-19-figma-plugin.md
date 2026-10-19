# MVP плагина Figma 0.1.0 — 19 октября 2026

## Результат и изоляция

Создан отдельный producer `.exui/1`: подготовленный Figma Frame → явные метаданные/оформление/PNG → ZIP → существующий CLI → редактируемый GDL. Исходники и установка: [плагин](../../src/figma-plugin/README.md); [происхождение и разрешение](../../src/figma-plugin/THIRD_PARTY_NOTICES.md).

Работа выполнена в отдельном managed worktree `C:/Users/Khusan Turaev/.codex/worktrees/figma-plugin/figma-extron-exporter`, ветка `codex/figma-plugin`, от опубликованного `6a006f5`. Основная папка уже содержала параллельные правки C#/PowerShell; они не изменялись нами. Новых изменений схем `.exui`, C#-ядра, адаптера и tracked образцов в ветке плагина нет.

При первом интеграционном прогоне выяснилось, что основной реестр уже расширен, а файлы доноров пересозданы параллельной работой. Старый reader правильно отказал по неизвестному полю, затем по несовпадающему SHA. Для изоляции в worktree скопирован неизменяемый исходник и штатным `prepare-donor` восстановлены собственные копии прежних закреплённых доноров. Никакие SHA/проверки не ослаблялись; реестр основной папки и её доноры не переписывались. Это не ошибка плагина и не повод менять работающий контракт под параллельную ветку.

По сообщению пользователя у него есть лицензия Baolv/figma-export и разрешено использовать проект как основу. Закреплена ревизия `6312d15ea52470ab14600c49506f7f9e3c9aec91`. Адаптированы чтение оформления/PNG, ZIP/download, а по дополнительному пожеланию пользователя — UI/UX (fieldset, legends, поля, нижняя основная кнопка, progress/status). Delta, AI-интеграция и localhost bridge не включены. Исходник лицензии не придумывался; provenance сохранён.

## Реализовано

- Frame страницы 1280×800 или 320×480; Button Frame с тремя State Frame, Label Text, Level Frame, необязательные icon Frame.
- Назначения хранятся в private `pluginData`, схема `exui-node/1`: semantic key, objectId/controlId; у состояния явные role/stateId/stateName. Имена и порядок слоёв их не назначают. Owner node ID обнаруживает копии до явного переназначения.
- Caption, цвета, Arial и геометрия читаются из Figma. Явное преобразование px→pt 72/96. Label ограничен LEFT/CENTER по имеющемуся layout донора; кнопка CENTER/CENTER или CENTER/BOTTOM.
- normal/feedback/pressed не смешиваются. Preview меняет видимость одного состояния; экспорт содержит все три. Никакой AV-логики.
- PNG Native 1×, совпадение размеров с Frame, SHA-256, безопасные пути, конфликты ключей/байтов, лимиты `.exui`.
- Последовательное выполнение операций, отказ обязательного рендера, обнаружение изменения дизайна во время экспорта, новые файлы без перезаписи.
- Демо обоих профилей по существующим first-screen JSON; установка из готового ZIP или npm ci/build. Сеть отключена manifest-ом.

## Проверки и доказательства

| id | Статус | Проверка и источник |
|---|---|---|
| plugin-types-build | passed | Оба tsconfig, сборка sandbox и UI; [plugin-checks.txt](2026-10-19-figma-plugin/plugin-checks.txt) |
| plugin-unit-vm | passed | 32 теста: fixture API, семантика обоих примеров, SHA/determinism, IDs, roles/order, copies, bounds, transforms/styles, PNG failure/conflict, concurrent export, apply/preview; тот же лог |
| core-regression | passed | 90 проверок прежнего ядра; [core-tests.txt](2026-10-19-figma-plugin/core-tests.txt) |
| native | passed | Настоящий .NET CLI и x86 writer: два профиля, 61/61, IDs после сдвига и перестановки; [native-tests.txt](2026-10-19-figma-plugin/native-tests.txt), [integration.json](2026-10-19-figma-plugin/integration.json), [1025M report](2026-10-19-figma-plugin/plugin-1025m.gdl.report.json), [300M report](2026-10-19-figma-plugin/plugin-300m.gdl.report.json) |
| chromium-ui | passed | Настоящий Chromium: пустой выбор, клавиатура, оба downloads, ZIP, форма, ошибка и восстановление, защита textContent; [browser.json](2026-10-19-figma-plugin/browser.json), [лог](2026-10-19-figma-plugin/browser-tests.txt), [снимок](2026-10-19-figma-plugin/ui.png). Родитель Figma смоделирован |
| browser-to-cli | passed | Пакеты, скачанные реальным UI в Chromium, преобразованы CLI: [1025M](2026-10-19-figma-plugin/browser-convert-1025m.json), [300M](2026-10-19-figma-plugin/browser-convert-300m.json). Оба по 61/61; GDL SHA совпадают с этапом 4 |
| package | passed | Установочный ZIP содержит manifest, dist, README, provenance и runtime licenses; повторная упаковка побайтово равна. [SHA/размеры](2026-10-19-figma-plugin/file-hashes.json) |
| runtime-dependencies | passed | npm audit --omit=dev: 0 известных advisory на дату запуска; [npm-audit-runtime.json](2026-10-19-figma-plugin/npm-audit-runtime.json). Это не полная оценка безопасности зависимостей |
| focused-reviews | passed with limitations | Проверены source→metadata→capture→PNG→package→CLI, границы сообщений и UI textContent, локальный download, native labels/focus. Исправлены выравнивание Label, align-only различимость состояний, Native размеры PNG, сохранение busy при selectionchange, повторные команды и ошибочное назначение Label внутри кнопки и пропуск унаследованного поворота. Полная screen-reader/реальная Figma-проверка не проводилась |

Примерные исходные PNG в fake API возвращаются как реальные локальные байты, поэтому возможна побайтовая эквивалентность GDL этапу 4. Это доказывает адаптацию данных и существующий writer, **не** рендер Figma. В Chromium используется настоящая панель и код пакета с моделируемыми сообщениями родителя. Не смешивать эти границы.

## Не выполнено и следующий реальный шаг

| id | Статус | Что проверить |
|---|---|---|
| figma-desktop | not_performed | Импорт manifest и запуск classic plugin в настоящем Figma Desktop |
| real-fonts-metadata-render | not_performed | Arial, private metadata после перезапуска, копии, PNG из скрытых State Frame, изменение дизайна и повторный экспорт |
| new-gui-cycle | not_performed | Именно реальный экспорт Figma → новый GDL: открыть, отредактировать, Verify с фактическими counts, Save and Build вручную, закрыть/открыть |
| hardware | unavailable | Панель/процессор и фактический feedback не проверены |

Исторический GUI-рубеж этапа 4 остаётся в прежнем протоколе. Числа Verify пользователь не передавал; 0/0 для него не заявляется. Build в экспортёр не добавлялся и не автоматизировался.

## Воспроизведение и решение

Команды: [README плагина](../../src/figma-plugin/README.md). Реальный surface proof и ограничения: [HARNESS](../../.agents-devkits/verification/HARNESS.md).

Готов локальный MVP для импорта и следующего ручного прогона. Публичный/production релиз не заявляется: классический Figma runtime пока не проверен. Полный этап 7 остаётся частично выполненным; instances/variants библиотека, исторический реестр ID, desktop UI, merge ручных правок GDL и AV-логика не реализованы.

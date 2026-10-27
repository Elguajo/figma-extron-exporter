# Настройки запуска проекта без выделения — 26.10.2026

## Поведение

- «Запуск проекта» расположен после «Макет и панель» и отображается только при пустом выделении Figma.
- Единственный проект открывается автоматически. При нескольких проектах требуется выбор в списке «Проект».
- Выбор проекта настроек не меняет режим и состав экспорта. Запомненный набор Frame имеет приоритет над всеми экранами страницы для того же корня проекта.
- «Сохранить стартовую страницу» появляется только после изменения стартового экрана. Выбор в списке сам ничего не записывает.
- Сохранение проверяет актуальный проект и отсутствие выделения. Чужие экраны и команды со старой страницы отклоняются.
- Поддерживаются Section, project_ Frame, отдельные экраны страницы и профиль 300M.

## Проверки

- `npm run typecheck --prefix src/figma-plugin` — успешно.
- `node --test src/figma-plugin/test/project-settings.test.ts src/figma-plugin/test/authoring-links.test.ts src/figma-plugin/test/performance-budget.test.ts` — 32/32.
- `npm run test:browser --prefix src/figma-plugin` — сборка и Chromium успешно; сохранение по Enter, отмена изменения, несколько проектов, пустое состояние, скрытие при выделении, ширина 320/420 px. Ошибок страницы нет.
- `git diff --check` — успешно.

Браузерный стенд использует настоящий собранный UI и имитацию сообщений Figma. Сам Figma Desktop в этой проверке не управлялся.

Локальные скриншоты и браузерный отчёт: `output/figma-plugin/browser-1793010970855/`.

## Существующие сбои общего набора

При запуске полного набора до добавления последних двух профильных тестов: 700/703. Три сбоя воспроизведены в контрольной копии исходников с удалёнными изменениями этой задачи и сохранёнными ранее существовавшими правками:

- `button-preview.test.ts`: Saved state roles take priority over renamed layers when repairing preview.
- `button-state-pair.test.ts`: Override converts assigned Off/On to Normal/Pressed and back, preserving nodes, button identity and selection.
- `manual-ids.test.ts`: Page buttons keep manual IDs 1/2 through invalid placement, popup moves, state errors, restart and export.

Локальные журналы: `output/project-settings-tests.log` и `output/project-settings-baseline-tests.log`. Существующая логика состояний кнопок в рамках этой задачи не менялась.

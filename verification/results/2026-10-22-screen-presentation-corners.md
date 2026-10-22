# Скругление Frame экрана как оформление Figma — 0.4.3

22.10.2026. По запросу пользователя Corner radius внешнего Frame экрана игнорируется при экспорте. Страница Extron остаётся прямоугольной, Figma Frame и его Clip content не изменяются. Исключение действует для page отдельно и внутри проекта; popup и другие элементы сохраняют прежние правила.

## Изменение

captureSingleContent() после определения metadata разрешает пропуск только проверки cornerRadius у page. Остальные проверки plain(), включая strokes, effects, opacity, transforms, masks и prototype reactions, сохранены. Радиус не записывается в описание страницы EXUI и не используется при подготовке GDL. Скругления нативных фигур и растровых состояний кнопок по-прежнему экспортируются своими прежними путями.

## Проверки

- До изменения три новых теста воспроизвели ошибку appearance у скруглённого экрана: оба профиля отдельно и страницы проекта.
- После изменения **222 теста passed**, основной и UI TypeScript passed, dist собран (`npm run verify`).
- Для обоих профилей итоговый EXUI ZIP со скруглением 10 и разными радиусами углов побайтно совпадает с ZIP прямоугольного экрана. Проверены неизменность source signature, исходного radius и Clip content.
- Страницы проекта дают тот же screen contract; native Shape сохраняет radius=10. Обводка экрана и скругление popup остаются ошибками.
- Окончательный архив 0.4.3 выполнен через main bundle с моделируемыми Figma API/PNG: скруглённый screen Frame, дробные детали иконки/подписи, ручной Pressed → настоящие CLI 0.4.0, Extron writer и reader. **53/53** проверки на каждой из двух панелей.
- `git diff --check` passed. Ручное управление Figma Desktop, GUI Designer Verify/Build и оборудование не выполнялись; Chromium для изменения backend validation и номера версии отдельно не запускался.

## Артефакты

- [Плагин 0.4.3](../../output/releases/0.4.3/figma-extron-plugin-0.4.3.zip).
- [Native evidence](../../output/releases/0.4.3/native-check/integration.json).
- [Инструкция обновления](../../releases/figma-plugin/0.4.3/README.md).
- SHA-256: `53F59FA4FBC7CFEAB9A18D015846D2CAAADCD8F94E33B626C1281E6FD0CF7345`.

Предыдущие локальные изменения 0.4.2 сохранены и включены в эту сборку. Ветка main, новые branch/worktree не создавались. CLI, EXUI/5, plugin ID и назначения не менялись.

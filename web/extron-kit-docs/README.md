# Extron Kit — визуальная документация

Русский статический сайт: 30 семейств компонентов, состояния, интерактивный Slider, 28 форматов DateTime, настоящие рендеры pen.dev, установка и экспорт. Структура вдохновлена документацией Obra shadcn/ui; оформление и контракты принадлежат Extron Kit.

[Открыть документацию](https://extron-kit-docs-trilliant.still-coin-7045.chatgpt.site) — приватный сайт, вход через ChatGPT владельца.

## Локальная сборка

Нужен Node.js с поддержкой TypeScript strip-types, как для проверок плагина. Зависимостей npm у сайта нет.

1. Выполнить `npm run verify --prefix src/figma-plugin`.
2. Подготовить архив `output/apple-kit-2026-10-24/figma-extron-plugin-0.7.3-apple-light-2026-10-24.zip` с текущими dist, manifest и документацией плагина. Старые архивы выпуска не перезаписывать.
3. Выполнить `npm run build --prefix web/extron-kit-docs`.
4. Выполнить `npm test --prefix web/extron-kit-docs` и `npm run preview --prefix web/extron-kit-docs`.
5. Открыть `http://127.0.0.1:4318`.

`build.mjs` берёт каталог и палитру из `design/extron-kit/kit.json`, форматы из `datetime-format.ts`, изображения из сохранённых рендеров кита. Шрифты Inter Regular/Bold в WOFF2 преобразованы из закреплённого Inter 4.1 в `src/adapter/fonts/Inter/Inter.ttc`; лицензия OFL лежит рядом.

## Публикация

`.openai/hosting.json` хранит постоянный project_id приватного сайта Sites. Сборка создаёт отдельный игнорируемый checkout `output/sites/extron-kit-docs` с `dist` и манифестом; он используется официальным `site-workflow.mjs` для commit/push и упаковки. Учётные данные передаются только через скрытый stdin, в репозитории их нет. Повторно создавать сайт не нужно; аудитория остаётся приватной.

Исходники поддерживаются в основном репозитории в main. Генерируемый checkout Sites служит зеркалом готового статического сайта. Проверки браузера и границы проверки кита описаны в [протоколе](../../verification/results/2026-10-24-extron-kit-apple-light.md).

# Figma → Extron Exporter 0.1.0

[Готовый ZIP](figma-extron-plugin-0.1.0.zip) сохранён в Git вместе с исходниками и инструкциями; для установки Node.js не нужен.

1. Скачать и распаковать ZIP в постоянную папку.
2. В Figma Desktop открыть Design-файл: Plugins → Development → Import plugin from manifest…; выбрать распакованный `manifest.json`.
3. Запустить плагин, выбрать профиль, создать демо, проверить экран и скачать `.exui`.

[Подробная инструкция](../../../src/figma-plugin/README.md) · [Исходники](../../../src/figma-plugin/) · [Протокол проверок](../../../verification/results/2026-10-19-figma-plugin.md).

SHA-256 ZIP: `A933B5C740A44660A98F666AACB358025DFE3276ED9ADE949215F916876D7A82` (44 612 байт). Архив содержит manifest, собранные code.js/ui.html, инструкцию, сведения о происхождении кода и лицензии runtime-зависимостей. Проверка в настоящем Figma Desktop ещё не выполнена; ограничения в инструкции остаются в силе.

Сборка воспроизводится из `src/figma-plugin` по закреплённому package-lock.json; новый ZIP по умолчанию создаётся в `output/figma-plugin/`. Локальные SDK, node_modules, доноры, DLL Extron и временные результаты не входят в поставку.

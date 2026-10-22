# Figma → Extron Exporter 0.5.0 preview

Inter и Inter Display сохраняются редактируемым нативным текстом в GUI Designer: 18 начертаний, девять выравниваний Label/Value/DateTime, текст состояний Button. Одинаковые подписи Inter в отдельной области состояний кнопки становятся самостоятельным редактируемым Label в исходном положении. Сложное оформление сохраняет PNG fallback. [Полные условия](../../../src/figma-plugin/NATIVE_TEXT.md).

Нужны **плагин 0.5.0 и CLI 0.5.0**. Коллекция Inter встроена в CLI и GDL, установка шрифта в Windows не требуется. Сохраняются plugin ID, назначения и старые EXUI/5; прежние архивы не заменяются.

[Плагин](../../../output/releases/0.5.0/figma-extron-plugin-0.5.0.zip) · [CLI Windows](../../../output/releases/0.5.0/figma-extron-cli-0.5.0-windows.zip) · [Инструкция CLI](../../cli/0.5.0/README.md).

Для development-плагина из src/figma-plugin/manifest.json закрыть и снова открыть плагин. Заголовок — **0.5.0**. Оставить обычный Text `txt_Title` с Inter → выбрать экран → «Проверить макет» → «Скачать .exui» → конвертировать новым CLI.

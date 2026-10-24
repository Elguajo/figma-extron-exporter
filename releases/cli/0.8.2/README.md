# CLI 0.8.2 preview

CLI для плагина **0.8.2**, контракт **EXUI/5**. Конвертер и команды не менялись по сравнению с 0.8.1: пакеты EXUI/5 от плагинов 0.8.1 и 0.8.2 дают тот же проект.

- **Обновление проекта с ручными страницами.** Если программист добавлял страницы, popup или кнопки прямо в GUI Designer, не импортируйте в GCP GDL из Figma целиком. Перенесите оформление выбранных кнопок в рабочий GDL: `plan-layout-update <working.gdl> <figma-new.gdl>` → `selection.json` → `update-layout <working.gdl> <figma-new.gdl> <selection.json> <new-output.gdl>`. Невыбранные элементы, страницы и popup остаются без изменений; команды, Text и Visual Feedback обновлённых кнопок сохраняются при импорте с сохранением конфигурации. Пошаговые команды PowerShell — в `docs/updating-configured-projects.md`.
- **Текст кнопок.** Плагин 0.8.2 добавляет режим «Автоматически из Figma» для текста Button; формат EXUI/5 не изменился, отдельная поддержка в CLI не нужна.
- Остальное — как в 0.8.1: профили совместимости Extron (`--compatibility`), `doctor`, `compare-packages`, `set-button-text`, переменные `EXUI_HOST_TIMEOUT` и `EXUI_HOST_TRACE`.

Распакуйте `figma-extron-cli-0.8.2-windows.zip`. Комплект для плагина 0.8.2: заголовок плагина должен показывать **0.8.2**. Перед первой конвертацией выполните `.\ExtronExporter.ps1 doctor`.

Для `convert-package` нужны .NET 10 Runtime x64, GUI Designer 1.28.0.7 и собственные закреплённые доноры. Доноры и DLL Extron в архив не входят. `validate-package`, `id-map` и `compare-packages` работают без Extron.

[Обновление настроенного проекта GCP](../../../docs/updating-configured-projects.md) · [Проверки выпуска](../../../verification/results/2026-10-25-release-0.8.2.md).

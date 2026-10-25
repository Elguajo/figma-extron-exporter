# CLI 0.8.3 preview

CLI для плагина **0.8.3**, контракт **EXUI/5**. Сопровождающий выпуск: конвертер, команды и утилита обновления не менялись по сравнению с 0.8.2; пакеты EXUI/5 от плагинов 0.8.1–0.8.3 дают тот же проект.

- **Обновление проекта с ручными страницами.** Как в 0.8.2: перенос оформления выбранных кнопок в рабочий GDL через `plan-layout-update` → `selection.json` → `update-layout`. Пошаговые команды PowerShell — в `docs/updating-configured-projects.md`; рабочий GDL должен быть сохранён GUI Designer.
- Остальное — как в 0.8.2: профили совместимости Extron (`--compatibility`), `doctor`, `compare-packages`, `set-button-text`, переменные `EXUI_HOST_TIMEOUT` и `EXUI_HOST_TRACE`.

Распакуйте `figma-extron-cli-0.8.3-windows.zip`. Комплект для плагина 0.8.3: заголовок плагина должен показывать **0.8.3**. Перед первой конвертацией выполните `.\ExtronExporter.ps1 doctor`.

Для `convert-package` нужны .NET 10 Runtime x64, GUI Designer 1.28.0.7 и собственные закреплённые доноры. Доноры и DLL Extron в архив не входят. `validate-package`, `id-map` и `compare-packages` работают без Extron.

[Обновление настроенного проекта GCP](../../../docs/updating-configured-projects.md) · [Проверки выпуска](../../../verification/results/2026-10-25-release-0.8.3.md).

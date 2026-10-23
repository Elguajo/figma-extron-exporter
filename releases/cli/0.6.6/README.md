# Figma → Extron CLI 0.6.6 preview

Совместим с плагином **0.6.8**, контракт **EXUI/5**. Переустанавливать плагин для сравнения не требуется.

Новая команда показывает последствия изменения дизайна для существующих назначений: добавленные/удалённые элементы, сохранённые и изменённые ID, типы, состояния, диапазоны, переходы и связи popup. Результат — Markdown либо JSON с SHA-256 обоих пакетов. Пакеты и проект GCP не изменяются.

```powershell
.\ExtronExporter.ps1 compare-packages .\interface-v1.exui .\interface-v2.exui | Out-File -Encoding utf8 .\changes-v1-v2.md
```

```powershell
.\ExtronExporter.ps1 compare-packages .\interface-v1.exui .\interface-v2.exui --json | Out-File -Encoding utf8 .\changes-v1-v2.json
```

Сравнение работает с .NET 10 Runtime x64 без Extron и доноров. Для прежней команды `convert-package` по-прежнему нужны GUI Designer 1.28.0.7 и собственные закреплённые доноры; в архив они не включены. Конвертация и EXUI/5 не изменены.

Уровни `review`/`breaking` требуют проверки программистом. Код выхода `0` означает успешное сравнение и не доказывает совместимость назначений GCP. Используйте `requiresReview` в JSON. 23.10.2026 отдельный GUI-тест подтвердил сохранение действия/feedback кнопки для пары 1025M после обновления и повторного открытия GCP; связь уровня, 300M и оборудование ещё не проверены. [Протокол](../../../verification/results/2026-10-23-gcp-layout-update.md).

[Обновление уже настроенного проекта и контрольный сценарий GCP](../../../docs/updating-configured-projects.md).

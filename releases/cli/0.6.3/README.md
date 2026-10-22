# Figma → Extron CLI 0.6.3 preview — Windows

Комплект для плагина **0.6.3**. Принимает EXUI/5 прежних плагинов. Назначенная стартовая страница всегда первая в GDL независимо от её позиции в пакете; относительный порядок остальных страниц, popup и элементов сохраняется. ID, ключи, ссылки и экран по умолчанию сохраняются.

Нужны Windows, .NET 10 Runtime x64, GUI Designer 1.28.0.7 и закреплённые доноры. Обычный CLI ZIP не содержит доноры: скопируйте свои `samples/donors/` или укажите существующий `samples/donors.json` через `--registry`. Inter встроен в CLI и GDL.

В PowerShell из распакованного комплекта:

```powershell
.\ExtronExporter.ps1 validate-package C:\path\interface.exui
.\ExtronExporter.ps1 convert-package C:\path\interface.exui C:\path\new-project.gdl
```

Каждой конвертации нужно новое имя результата. После независимой проверки откройте GDL в GUI Designer: Verify → Save and Build → закрыть и открыть снова. Переключение страниц, popup и остальная AV-логика задаются программой управления Extron.

Сборка из текущей рабочей папки помечается `sourceDirty` в `version.json`. [Проверки сборки](../../../verification/results/2026-10-22-release-0.6.3.md).

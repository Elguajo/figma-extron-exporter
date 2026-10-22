# Figma → Extron CLI 0.6.4 preview

CLI для плагина **0.6.7**. Поддерживает `line.fillColor` в формате `#RRGGBB` и `#AARRGGBB`, записывает альфа-канал в нативную PBLine. Принимает прежние EXUI/5 без миграции; стартовая страница по-прежнему первая, ID и связи сохраняются.

Нужны Windows, .NET 10 Runtime x64, GUI Designer 1.28.0.7 и закреплённые доноры. Архив CLI не содержит доноры: скопируйте свои `samples/donors/` или укажите существующий `samples/donors.json` через `--registry`.

В PowerShell из распакованного комплекта:

```powershell
.\ExtronExporter.ps1 validate-package C:\path\interface.exui
.\ExtronExporter.ps1 convert-package C:\path\interface.exui C:\path\new-project.gdl
```

Каждой конвертации нужно новое имя результата. После независимой проверки откройте GDL в GUI Designer: Verify → Save and Build → закрыть и открыть снова.

[Протокол проверок](../../../verification/results/2026-10-22-line-opacity.md).

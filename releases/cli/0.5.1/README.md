# Figma → Extron CLI 0.5.1 preview — Windows

Комплект для плагина 0.5.1. CLI пересобран с номером 0.5.1; поведение конвертации сохранено. Поддерживается EXUI/5, включая прежние пакеты 0.5.0. Ключи и ID из Figma не сбрасываются. Сохранены нативный Inter / Inter Display и выравнивания текста из 0.5.0.

[CLI Windows](../../../output/releases/0.5.1/figma-extron-cli-0.5.1-windows.zip) · [Плагин](../../../output/releases/0.5.1/figma-extron-plugin-0.5.1.zip).

Нужны Windows, .NET 10 Runtime x64, GUI Designer 1.28.0.7 и закреплённые доноры. Обычный CLI ZIP не содержит донорские GDL: скопировать проверенные samples/donors/ или указать существующий samples/donors.json через --registry. Локальный комплект figma-extron-complete-0.5.1-local.zip содержит доноры для этой рабочей папки; это частный архив.

Inter встроен в CLI и GDL; установка шрифта в Windows не требуется. Лицензия SIL OFL находится в cli/licenses/Inter-LICENSE.txt.

В PowerShell из распакованного комплекта:

```powershell
.\ExtronExporter.ps1 validate-package .\interface.exui
.\ExtronExporter.ps1 id-map .\interface.exui
New-Item -ItemType Directory -Force .\converted | Out-Null
.\ExtronExporter.ps1 convert-package .\interface.exui .\converted\home.gdl
```

Каждой конвертации нужно новое имя результата. GDL создаётся после независимой проверки. В GUI Designer выполнить Verify → Save and Build → закрыть и открыть снова. Повторная конвертация не переносит ручные правки из прежнего GDL. Команды, переходы, feedback и работа на панели проверяются отдельно.

Проверки 0.5.1: Release build без предупреждений, 166 .NET-проверок и 8 native-сценариев через CLI готового комплекта на двух панелях прошли. [Протокол выпуска](../../../verification/results/2026-10-22-release-0.5.1.md).

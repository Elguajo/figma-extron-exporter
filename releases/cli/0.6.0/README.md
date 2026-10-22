# Figma → Extron CLI 0.6.0 preview — Windows

Комплект для плагина 0.6.0. CLI пересобран с номером 0.6.0, чтобы плагин и CLI снова имели общую версию; поведение конвертации не изменилось с 0.5.2. Поддерживается EXUI/5, включая пакеты плагинов 0.5.0–0.5.5. Порядок страниц и popup в GDL, как и раньше, повторяет порядок в пакете; начиная с плагина 0.6.0 он задаётся именами фреймов.

[CLI Windows](../../../output/releases/0.6.0/figma-extron-cli-0.6.0-windows.zip) · [Плагин](../../../output/releases/0.6.0/figma-extron-plugin-0.6.0.zip).

Нужны Windows, .NET 10 Runtime x64, GUI Designer 1.28.0.7 и закреплённые доноры. Обычный CLI ZIP не содержит донорские GDL: скопируйте проверенные samples/donors/ или укажите существующий samples/donors.json через --registry. Локальный комплект figma-extron-complete-0.6.0-local.zip содержит доноры для этой рабочей папки; это частный архив.

Inter встроен в CLI и GDL; установка шрифта в Windows не требуется. Лицензия SIL OFL — cli/licenses/Inter-LICENSE.txt. PDF-шпаргалка — docs/figma-extron-prefix-cheatsheet.pdf.

В PowerShell из распакованного комплекта:

```powershell
.\ExtronExporter.ps1 validate-package .\examples\home-1025m\home.exui
.\ExtronExporter.ps1 id-map .\examples\home-1025m\home.exui
New-Item -ItemType Directory -Force .\converted | Out-Null
.\ExtronExporter.ps1 convert-package .\examples\home-1025m\home.exui .\converted\home.gdl
```

Каждой конвертации нужно новое имя результата. GDL создаётся после независимой проверки. В GUI Designer выполните Verify → Save and Build → закройте и откройте снова. Повторная конвертация не переносит ручные правки из прежнего GDL. Команды, переходы, feedback и работа на панели проверяются отдельно.

[Протокол сборки и проверок](../../../verification/results/2026-10-22-release-0.6.0.md). Готовый комплект собран из текущей рабочей папки с несохранёнными в коммите изменениями; `sourceDirty` в version.json отмечает это явно.

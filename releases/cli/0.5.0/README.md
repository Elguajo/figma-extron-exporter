# Figma → Extron CLI 0.5.0 preview — Windows

Комплект для плагина 0.5.0. Поддерживается EXUI/5, включая прежние пакеты. Сохранённые в Figma ключи и ID не сбрасываются. Для нативного Inter и новых выравниваний обновить **и плагин, и CLI**.

Нужны Windows, .NET 10 Runtime x64, GUI Designer 1.28.0.7 и закреплённые доноры. Обычный CLI ZIP не содержит донорские GDL: скопировать проверенные samples/donors/ или указать существующий samples/donors.json через --registry. Локальный комплект figma-extron-complete-0.5.0-local.zip уже содержит доноры для этой рабочей папки; это частный архив.

Inter и Inter Display встроены в CLI и добавляются в GDL при использовании, без установки в Windows и без обращения к сети. Лицензия SIL OFL находится в cli/licenses/Inter-LICENSE.txt. Поддержаны 18 начертаний каждого семейства; формат font.style и условия описаны в docs/exui-v5.md.

В PowerShell из распакованного комплекта:

```powershell
.\ExtronExporter.ps1 validate-package .\interface.exui
.\ExtronExporter.ps1 id-map .\interface.exui
New-Item -ItemType Directory -Force .\converted | Out-Null
.\ExtronExporter.ps1 convert-package .\interface.exui .\converted\home.gdl
```

Каждой конвертации нужно новое имя результата. Полученный GDL и отчёт создаются только после независимой проверки. В GUI Designer можно менять Text, Font и Font Size, затем выполнить Verify → Save and Build → закрыть и открыть снова. Повторная конвертация не переносит ручные правки из прежнего GDL. Команды, переходы, feedback и работа на панели проверяются отдельно.

Ограничения ZIP/PNG и доноры не меняются. Пакет не может передать свой файл шрифта, DLL или путь к донору; CLI использует закреплённую коллекцию Inter из собственной сборки.

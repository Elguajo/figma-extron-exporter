# Figma → Extron CLI 0.3.0 preview — Windows

Комплект для плагина 0.3.0 preview, включая экраны с более чем 16 PNG. В exui/5 отдельный предел количества ресурсов снят. До 4 MiB на PNG, до 16 MiB распакованный пакет, ZIP до 20 MiB; manifest.json до 64 KiB и screen.json до 256 KiB. Прежние форматы exui/1–4 и существующие ID сохраняются.

Нужны Windows, .NET 10 Runtime x64, GUI Designer 1.28.0.7 и закреплённые доноры. Обычный CLI ZIP не содержит донорские GDL. Скопировать оба проверенных файла из основной рабочей папки samples/donors/ в одноимённую папку распакованного CLI либо использовать полный локальный комплект с донорами. Для сборки из исходников нужен SDK из global.json.

В PowerShell из папки распакованного комплекта:

```powershell
.\ExtronExporter.ps1 validate-package .\interface.exui
.\ExtronExporter.ps1 id-map .\interface.exui
New-Item -ItemType Directory -Force .\converted | Out-Null
.\ExtronExporter.ps1 convert-package .\interface.exui .\converted\home.gdl
```

Каждая конвертация требует нового имени результата. Открыть копию нового GDL в GUI Designer: проверить вид, состояния и ID, выполнить Verify → Save and Build → закрыть и открыть снова. Команды, взаимное переключение зон, громкость и feedback задаёт программа управления. Повторный экспорт не переносит ручные изменения прежнего GDL.

Для Figma распаковать архив плагина в постоянную папку и обновить путь существующего development-плагина к manifest.json, сохранив прежний plugin ID. Два состояния экспортируются как два; отсутствующий Pressed не создаётся. Поддержаны Passive / Active, Normal / Pressed и Off / On. У feedback-кнопки Pressed необязателен.

Точки в именах слоёв сохраняются: `button_side.hall` получает ключ `home.side.hall`, а имя объекта остаётся `button_side.hall`. SideHall необязателен. Старые сохранённые ключи и ID не меняются при переименовании.

Это preview. Автоматическая проверка CLI/native writer не подтверждает новый GUI Designer Build или работу на физической панели.

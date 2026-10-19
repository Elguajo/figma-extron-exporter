# Реальный экспорт демо из Figma

[figma-demo-300m.exui](figma-demo-300m.exui) — файл, переданный пользователем 19.10.2026 после исправления PNG-экспорта в плагине 0.1.2. Это реальный пользовательский экспорт 300M, не результат тестового Figma API. Версия Figma Desktop не сообщена; версия producer в `.exui/1` не записывается.

320×480, одна страница, четыре элемента и две иконки 64×64. Данные экрана совпали с исходным демо; тексты, состояния, geometry, шрифты и ID сохранены. Figma переупаковала PNG: они отличаются байтами, но максимальная разница канала при декодировании — 1 из 255, размеры и рисунок сохранены. Конвертация настоящим CLI/x86 writer: 65/65.

```powershell
$dotnet = './.tools/dotnet/dotnet.exe'
& $dotnet src/cli/bin/Debug/net10.0/Extron.Cli.dll validate-package examples/figma-plugin/figma-demo-300m.exui
& $dotnet src/cli/bin/Debug/net10.0/Extron.Cli.dll convert-package examples/figma-plugin/figma-demo-300m.exui output/new-real-figma-300m.gdl --registry samples/donors.json
```

CLI должен быть собран, закреплённые доноры доступны. Выходное имя должно быть новым. GUI Designer/Verify/Build именно этого файла и устройство ещё не проверены; реальный экспорт 1025M пока не передан. [Полный протокол](../../verification/results/2026-10-19-figma-real-export.md).

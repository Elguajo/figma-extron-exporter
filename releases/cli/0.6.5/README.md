# Figma → Extron CLI 0.6.5 preview

Комплект для плагина **0.6.8**, контракт **EXUI/5**.

Прозрачные popup больше не получают серую заливку донора: при создании контейнеров очищаются BorderFillColor, BorderColor и ресурс обводки, сбрасывается общая прозрачность донора. Заданный в EXUI фон сохраняется; независимая проверка GDL проверяет оба слоя заливки. Offline popup не изменяется.

Схема принимает `states[].fill` в формате `#RRGGBB` или `#AARRGGBB`, включая прозрачную заливку кнопок внутри popup. Сохраняется поддержка прозрачных линий из CLI 0.6.4. Прежние EXUI/5 принимаются без миграции, ключи и ID сохраняются.

Нужны Windows, .NET 10 Runtime x64, GUI Designer 1.28.0.7 и закреплённые доноры. Доноры и DLL Extron не включены в архив. Скопируйте собственные `samples/donors/` или укажите существующий реестр через `--registry`.

```powershell
.\ExtronExporter.ps1 validate-package C:\path\interface.exui
.\ExtronExporter.ps1 convert-package C:\path\interface.exui C:\path\new-project.gdl
```

Каждой конвертации нужно новое имя результата. После конвертации: GUI Designer → Verify → Save and Build → закрыть и открыть снова.

[Протокол выпуска](../../../docs/verification/results/2026-10-22-release-0.6.8.md).

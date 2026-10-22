# Figma → Extron CLI 0.6.1 preview — Windows

Комплект для плагина 0.6.2. Принимает EXUI/5 прежних плагинов и добавляет `#AARRGGBB` для фона popup и заливки/обводки фигур. Фоны обычных страниц и остальные цвета сохраняют прежнюю строгую валидацию. CLI 0.6.0 прозрачные цвета отклоняет; для новых пакетов обновите CLI.

Нужны Windows, .NET 10 Runtime x64, GUI Designer 1.28.0.7 и закреплённые доноры. Обычный CLI ZIP не содержит доноры: скопируйте свои `samples/donors/` или укажите существующий `samples/donors.json` через `--registry`. Inter встроен в CLI и GDL, установка шрифта не требуется.

В PowerShell из распакованного комплекта:

```powershell
.\ExtronExporter.ps1 validate-package C:\path\interface.exui
.\ExtronExporter.ps1 convert-package C:\path\interface.exui C:\path\new-project.gdl
```

Каждой конвертации нужно новое имя результата. После независимой проверки GDL откройте его в GUI Designer: Verify → Save and Build → закрыть и открыть снова. AV-логика и переключение popup настраиваются программой управления Extron.

Локальный комплект `figma-extron-complete-0.6.2-local.zip` содержит частные доноры, не предназначен для публикации. Сборка из текущей рабочей папки помечается `sourceDirty` в `version.json`.

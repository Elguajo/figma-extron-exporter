# Figma → Extron CLI 0.4.0 preview — Windows

Комплект для плагина 0.4.0. Поддерживается только **EXUI/5**. EXUI/1–4 отклоняются с предложением повторно экспортировать исходный макет текущим плагином. Сохранённые в Figma ключи и ID не сбрасываются.

Нужны Windows, .NET 10 Runtime x64, GUI Designer 1.28.0.7 и закреплённые доноры. Обычный CLI ZIP не содержит донорские GDL. Скопируйте проверенные файлы из основной рабочей папки `samples/donors/` в такую же папку распакованного CLI или используйте текущий реестр через `--registry`.

В PowerShell из папки распакованного комплекта:

```powershell
.\ExtronExporter.ps1 validate-package .\interface.exui
.\ExtronExporter.ps1 id-map .\interface.exui
New-Item -ItemType Directory -Force .\converted | Out-Null
.\ExtronExporter.ps1 convert-package .\interface.exui .\converted\home.gdl
```

Каждой конвертации нужно новое имя результата. Для проверки комплекта можно использовать `examples/home-1025m/home.exui` из архива. Результат — редактируемый GDL и отчёт независимой проверки. Далее проверьте копию в GUI Designer: Verify → Save and Build → закрыть и открыть снова. Команды, переходы, громкость и feedback задаёт программа управления Extron.

Лимиты сохранены: 4 MiB на PNG, 4096 px на сторону, 16 MiB распакованный пакет, ZIP до 20 MiB, manifest.json до 64 KiB и screen.json до 256 KiB. Отдельного предела количества PNG нет.

Повторная конвертация не переносит ручные правки прежнего GDL. Это preview; автоматические проверки не подтверждают новый GUI Designer Build или работу на физической панели.

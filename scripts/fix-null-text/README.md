# Починка пустых страниц в GCP (Text = null)

Нужна только для GDL, экспортированных **до `f21bd48`**. У картинок, фигур, линий и регуляторов там `Text = null`. Global Configurator Plus 3.34.1.4 при отрисовке вызывает `Text.Length`, и пустой остаётся вся страница или popup. Новые экспорты уже пишут `""`.

```powershell
powershell -ExecutionPolicy Bypass -File scripts/fix-null-text/Repair-NullText.ps1 "D:\путь\к\project.gdl"
```

- Рядом появится `project text-fix.gdl`. Оригинал не меняется, существующий файл не перезаписывается.
- Скрипт выводит, какие элементы исправлены.
- В результате нет собранной части `.tgz4`. Откройте файл в GUI Designer, сделайте **Save and Build** и только потом импортируйте его в GCP.
- Сообщение «The system cannot find the file specified» во время сериализации появляется и при прогоне без изменений, на данные оно не влияет.
- Также сбрасываются кэшированные номера картинок (`TLPImageID = -1`), GUI Designer пересчитывает их при Build.

Нужны GUI Designer 1.28.0.7, 32-битный Windows PowerShell 5.1 и Python 3.

| Файл | Что делает |
|---|---|
| `Repair-NullText.ps1` | Обёртка: извлекает, исправляет и упаковывает |
| `gdl_container.py` | Извлекает и упаковывает `ProjectGCP` в контейнере GDL (сигнатуры `KP` меняются только в заголовках внешнего архива) |
| `Fix-NullTextPayload.ps1` | Загружает `ProjectGCP` через типы GUI Designer и ставит `textField = ""`. С `FIX_NOOP=1` — контрольный прогон без изменений |

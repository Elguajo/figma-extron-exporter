# Первый собственный экран (эксперимент)

Описание одной страницы в экспериментальном JSON (`exui-screen-experiment/0`) и команда, которая создаёт из него **новый** редактируемый `.gdl` для GUI Designer 1.28.0.7. Это не контракт `.exui`. Минимальная версия `.exui/1` теперь описана [отдельно](../../../docs/exui-v1.md), ручные пакеты на основе этих примеров — [exui-v1](../exui-v1/README.md).

| Файл | Назначение |
|---|---|
| `screen-1025m.json` | TLP Pro 1025M, 1280×800 |
| `screen-300m.json` | TLP Pro 300M, портрет 320×480; те же ключи и ID, своя геометрия |
| `assets/note-light.png`, `assets/note-dark.png` | Собственные иконки 64×64; нарисованы `assets/New-NoteIcons.ps1` |

## Элементы и ID

| key | Тип Extron | objectId (idField) | controlId (ID Extron) | Состояния |
|---|---|---:|---:|---|
| `page.home` | PBPage «Главная» | 100 | — | — |
| `source.music` | PBButton «Музыка» с иконкой | 1 | 8101 | Off (normal), On (feedback), Pressed (pressed) |
| `volume.caption` | PBLabel «Громкость» | 2 | 0 (не адресуется) | — |
| `volume.level` | PBLevel, display Slider, 0..100 | 3 | 8103 | — |
| `volume.mute` | PBButton «Без звука» | 4 | 8104 | Off, On (feedback), Pressed |

`objectId` — внутренний ID объекта на странице, `controlId` — ID, который адресует программа управления. Оба берутся только из описания и не зависят от порядка, текста или координат. Ключ хранится в поле Comments объекта: `exui-key=<key>`.

Состояния: `normal` — состояние 0 при загрузке; `pressed` — назначено press feedback и показывается, пока кнопку держат; `feedback` — включает программа управления (выбранный источник, mute). Генератор не назначает AV-логику, команды или маршруты.

## Воспроизведение

Нужны Windows, установленный GUI Designer 1.28.0.7 и локальный `samples/original/Full-Test-Project.gdl` (SHA-256 в `samples/manifest.json`). Из корня репозитория в PowerShell:

```powershell
$dotnet = '.\.tools\dotnet\dotnet.exe'
& $dotnet build ExtronExporter.slnx --no-restore
& $dotnet run --project src/cli --no-build -- prepare-donor tlp-pro-1025m
& $dotnet run --project src/cli --no-build -- prepare-donor tlp-pro-300m-portrait
New-Item -ItemType Directory -Force output\first-screen | Out-Null
& $dotnet run --project src/cli --no-build -- generate-screen tests/fixtures/first-screen/screen-1025m.json tlp-pro-1025m output/first-screen/first-screen-1025m.gdl
& $dotnet run --project src/cli --no-build -- generate-screen tests/fixtures/first-screen/screen-300m.json tlp-pro-300m-portrait output/first-screen/first-screen-300m.gdl
```

`prepare-donor` нужен один раз; повторная подготовка даёт тот же SHA-256, что записан в `samples/donors.json`. Существующие файлы не перезаписываются. Рядом с результатом пишется `<имя>.report.json` со всеми проверками.

## Ручная проверка в GUI Designer

Build выполняет только пользователь. Для каждого файла `output/first-screen/first-screen-1025m.gdl` и `first-screen-300m.gdl`, работая с копией:

1. **Открытие.** Открыть двойным щелчком в Проводнике. Заголовок: `TLP Pro 1025M` или `TLP Pro 300M`. Одна страница «Главная», холст 1280×800 или 320×480.
2. **Элементы.** Проверить тип, ID, текст и положение:
   - «Музыка» — Button, ID 8101.
   - «Громкость» — Label.
   - Level/Slider — ID 8103.
   - «Без звука» — Button, ID 8104.
   Кириллица должна отображаться без подмены символов. Переключить состояния кнопок: Off, On и Pressed выглядят по-разному. У «Музыка» есть иконка ноты; в On она тёмная.
3. **Редактирование.** Переместить элемент и изменить текст или цвет; убедиться, что свойства редактируются. Пробную правку можно сохранить только в копии.
4. **Verify** (Ctrl+B). Записать фактические числа ошибок/предупреждений и сделать снимок; при ошибках зафиксировать диагностику. Для проверки 19.10.2026 числа пользователь не передал.
5. **Save and Build** (Ctrl+Shift+B). Убедиться, что ошибок нет. Элементы не должны сместиться в 0,0.
6. **Закрыть и открыть снова.** Проверить сохранность элементов, ID, текста и иконки.
7. После сохранения можно сверить ID без GUI:

   ```powershell
   & $dotnet run --project src/cli --no-build -- list-controls <сохранённый.gdl>
   ```

   Многозаписный файл после Build читается.

19.10.2026 эта проверка выполнена для обоих файлов (протокол `docs/verification/results/2026-10-19-first-screen.md`). Собранные файлы проверяются без GUI так:

```powershell
& $dotnet run --project tests/format --no-build -- --registry samples/donors.json --gui-built-screens output/first-screen
```

При Save and Build можно выбрать удаление неиспользуемых ресурсов (Remove); ресурсы донора, не нужные экрану, тогда удаляются, это ожидаемо.

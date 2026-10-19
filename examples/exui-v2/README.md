# Пакеты `.exui/2`: страницы и popup

Два пакета с одинаковыми ключами и ID и своей геометрией. Контракт — [docs/exui-v2.md](../../docs/exui-v2.md).

| Пакет | Редактируемый исходник | Профиль |
|---|---|---|
| `pages-popups-1025m.exui` | `1025m/` | TLP Pro 1025M, 1280×800 |
| `pages-popups-300m.exui` | `300m/` | TLP Pro 300M портрет, 320×480 |

## Состав

| Ключ | Что это | ID | Как показывается |
|---|---|---:|---|
| `page.home` «Главная» | страница | 100 | стартовая |
| `page.sources` «Источники» | страница | 101 | кнопка `nav.sources` (8111) |
| `popup.volume` «Громкость» | обычный popup, прямая ссылка `home.volume-ref` | 201 | кнопка `nav.volume` (8112) |
| `popup.sources-1` «Источники 1» | popup в группе «Источники» (1) | 202 | кнопка `nav.list-1` (8114) |
| `popup.sources-2` «Источники 2» | popup в группе «Источники» (1) | 203 | кнопка `nav.list-2` (8115) |
| `popup.confirm` «Выключение» | модальный popup | 204 | кнопка `nav.power` (8113) |

Группу на странице «Источники» размещает `sources.group-ref`.

Элементы:
- «Музыка» (8101) с иконкой нотки, «Радио» (8102), «ТВ» (8105), «Микрофон» (8106);
- регулятор громкости (8103), «Без звука» (8104);
- «Да» (8121) и «Нет» (8122);
- кнопка «Назад» (8116).

Переходы — указание для программы управления: в GDL они не хранятся (см. `id-map`). AV-логика, команды и маршруты не назначаются.

## Воспроизведение из корня репозитория

```powershell
$dotnet = './.tools/dotnet/dotnet.exe'
& $dotnet build ExtronExporter.slnx --no-restore
& ./examples/exui-v2/New-ExamplePackages.ps1 -OutputDirectory output/exui-v2/packages-new
& $dotnet run --project src/cli --no-build -- validate-package examples/exui-v2/pages-popups-1025m.exui
& $dotnet run --project src/cli --no-build -- id-map examples/exui-v2/pages-popups-1025m.exui
New-Item -ItemType Directory -Force output/exui-v2 | Out-Null
& $dotnet run --project src/cli --no-build -- convert-package examples/exui-v2/pages-popups-1025m.exui output/exui-v2/new-1025m.gdl
& $dotnet run --project src/cli --no-build -- convert-package examples/exui-v2/pages-popups-300m.exui output/exui-v2/new-300m.gdl
```

SHA-256 упаковки повторяются на том же .NET runtime. Для конвертации нужны GUI Designer 1.28.0.7 и доноры v2 (`prepare-donor tlp-pro-1025m`, `prepare-donor tlp-pro-300m-portrait`; SHA в `samples/donors.json`).

## Ручная проверка в GUI Designer

Работать с копией каждого `output/exui-v2/pages-popups-*.gdl`:

1. Открыть файл. Заголовок: `TLP Pro 1025M` или `TLP Pro 300M`. В дереве две страницы и пять popup: четыре наших и Offline Page.
2. На «Главной» выбрать ссылку «Место popup громкости»: она должна показывать popup «Громкость», а не «Unassigned».
3. На «Источниках» выбрать «Место группы источников»: она привязана к группе «Источники», в группе «Источники 1» и «Источники 2».
4. У «Выключение» проверить, что popup модальный.
5. Проверить ID и кириллицу. Переключить состояния кнопок; у «Музыка» должна быть иконка.
6. Отредактировать элемент, затем Verify (записать числа), Save and Build, закрыть и открыть снова.
7. После этого проверить данные без GUI:

   ```powershell
   & $dotnet run --project tests/format --no-build -- --registry samples/donors.json --gui-built-pages output/exui-v2
   ```

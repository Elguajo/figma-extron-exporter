# Прозрачность нативных линий — плагин 0.6.7 / CLI 0.6.4

22.10.2026. Работа выполнена в основной папке на main. До начала изменений рабочая папка была чистой. Ветки и worktree не создавались.

## Причина и реализация

На скриншоте пользователя Stroke `#D2AE6D` имеет непрозрачность 10%. `readStrokeLine()` запрещал любое значение, отличное от 100%, хотя writer Extron уже записывает альфа-канал PBColor. В установленной официальной справке GUI Designer 1.28.0.7, `Help/Content/HTML_Files/Window_Modules/Properties/Appearance.htm`, раздел Line, свойство Transparency описывает alpha blending для линии (0% — полностью непрозрачно).

Теперь непрозрачность SOLID Stroke и Opacity слоя перемножаются до округления альфа-канала до 8 бит. Для прямоугольных линий используются Fill и Opacity. Например: 10% → `#1AD2AE6D`, 10% × 50% → `#0DD2AE6D`. Полностью прозрачные линии сохраняют ключи и ID. Результат — редактируемая PBLine, без PNG. Общая Opacity других нативных типов не входит в это изменение.

EXUI/5 расширяет только `line.fillColor`: `#RRGGBB` или `#AARRGGBB`. Пакеты с альфа-цветом линии требуют CLI 0.6.4; прежние EXUI/5 с непрозрачными линиями продолжают приниматься. Исторические схемы не менялись.

## Выполненные проверки

| Проверка | Результат | Источник |
|---|---|---|
| Плагин: typecheck, unit tests, build | passed; 463 tests, 0 failures | `output/line-opacity-plugin-verify.log` |
| .NET build | passed; 0 warnings / errors | `output/line-opacity-dotnet-build.log` |
| .NET unit + native integration | passed; 202 tests, 0 failures | `output/line-opacity-native-regression.log` |
| Финальные ZIP → main bundle → EXUI → упакованный CLI → Extron DLL → независимый NRBF reader | passed; 62/62 на каждой панели | `output/releases/0.6.7-verified/alpha-lines-check/archive-smoke.json` |
| Регрессия непрозрачных Pen/Vector и Line Tool из финальных ZIP | passed; 55/55 на каждой панели | `output/releases/0.6.7-verified/opaque-lines-check/archive-smoke.json` |
| Проверка diff на whitespace errors | passed | `git diff --check` |

Alpha-сценарий проверяет горизонтальную линию шириной 1280 / 320 с Stroke `#D2AE6D` 10%, вертикальную линию с 50% × 50%, полностью прозрачную линию, Line Tool с Opacity 10% и прямоугольную линию с Fill 10% × Opacity 50%. Для 1025M первая линия расположена по Y=716, толщина 2, как на скриншоте. Прочитаны реальные значения ARGB нативных объектов. PNG отсутствуют. Unit-тесты отдельно проверяют неизменность геометрии, source signature, назначений/ID и отказ на некорректные значения цвета/непрозрачности.

Граница доказательства: Figma API моделируется fixture. Живой документ пользователя, Figma Desktop, визуальное смешивание цветов в GUI Designer, Verify → Save and Build и физическая панель в этой работе не проверялись. Изменение проверено автоматическими средствами; для конкретного рабочего проекта остаётся штатная проверка GUI Designer.

## Финальные архивы

- [Плагин 0.6.7](../../output/releases/0.6.7-verified/figma-extron-plugin-0.6.7.zip), SHA-256 `1E8E5B5EE2AB2FBDFDCD92AAA894C622B32DA0C0A73D55A6BCB8462E261EA72F`.
- [CLI 0.6.4](../../output/releases/0.6.7-verified/figma-extron-cli-0.6.4-windows.zip), SHA-256 `B6E032B0D975B1E685A7FF89D0FCD142D7BDF705BCDD17C79CEA1EA643FCEA52`.

Сборка помечена sourceDirty. Промежуточные кандидаты в `output/releases/0.6.7` и `0.6.7-final` не являются финальными архивами. Публикация на GitHub и push не выполнялись.

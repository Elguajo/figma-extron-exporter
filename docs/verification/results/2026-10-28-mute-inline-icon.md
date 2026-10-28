# Mute: иконка рядом с нативным текстом Button

Пользователь выбрал сохранение Text внутри Button и сдвиг иконки в экспортной графике. Произвольное смещение текстовой области Button не поддерживается установленной моделью GUI Designer: reflection PBButton/PBState содержит TextAlignment, но не TextRect/Offset/Padding. Точное центрирование связки как в Figma при этом не обещается: нативная подпись остаётся по центру всей кнопки.

## Изменение

- `button-inline-artwork.ts` рассчитывает перенос соседних компактных иконок относительно нативного центра подписи, отдельно для каждого состояния. Зазор сохраняется; Inter получает запас под GDI. Иконка вне границ вызывает адресную ошибку до экспорта.
- `read-node.ts` сохраняет Text с нулевой непрозрачностью во временной PNG-копии вместо Visible=false. Это сохраняет место в Auto Layout. Перенесённая иконка рисуется отдельной копией внутри того же экспортного PNG; прежний слот также прозрачен. Это не отдельный контрол GDL.
- Нет изменения исходных слоёв, controlId, objectId, EXUI/5 или CLI. `imagebutton_` / `ibtn_` не получают переносов.

## Проверки

- `npm run verify --prefix src/figma-plugin`: typecheck, 749 тестов, build — passed. `output/mute-text-overlap/verify.log`.
- Шесть новых проверок: Mute 288×52, иконки слева/справа, сохранение Auto Layout slots и исходной геометрии/ID, уборка копий после ошибки рендера, imagebutton, вложенная группа иконки, неподвижный отдалённый декор, ошибка нехватки места.
- `button-inline-integration.ts`: фактический bundle плагина → EXUI → CLI → GDL; оба профиля. Один PBButton, редактируемый Text обоих состояний, FlattenText=false, PressFeedbackState=1, исходные ID и прямоугольник, замена текста без смены ID — passed. `output/mute-text-overlap/integration/integration.json`.
- `button-native-text-browser.ts`: реальный Chromium с UI/plugin bridge — passed. `output/mute-text-overlap/browser/browser.json`.

Figma API/PNG в тестах моделируются; текущий пользовательский Figma-файл, его GDL и физическая панель не изменялись. Живой Figwright не подключён. Для пользовательского макета нужен перезапуск обновлённого development-плагина и новый экспорт EXUI → GDL. Иконка после экспорта фиксирована; изменение подписи на существенно более длинную в GUI Designer/GCP требует проверки компоновки.

## Сборка

`output/figma-plugin/figma-extron-plugin-0.8.8-inline-icon-fix-dev.zip`. Также обновлены файлы существующего распакованного development-плагина `output/figma-plugin/figma-extron-plugin-0.8.8-native-button-text-dev/`, зарегистрированного ранее. Опубликованные ZIP предыдущих выпусков не заменены.

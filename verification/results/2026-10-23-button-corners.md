# Белые углы закруглённых кнопок — 23.10.2026

Вошло в плагин 0.7.0. Проверка выполнялась на рабочей сборке (номер 0.6.9) и Debug CLI, EXUI/5.

## Причина

Состояние кнопки с PNG получало `states[].fill` = сплошной цвет Frame страницы (`page.background`). GUI Designer рисует `BorderFillColor` состояния прямоугольником на всю кнопку под изображением Native. Если видимый фон страницы — отдельный PBImage, а Frame залит белым, в прозрачных углах PNG виден белый прямоугольник.

## Исправление

`src/figma-plugin/src/export.ts`: для состояний с PNG `fill` = `#00000000`. Схема EXUI/5 и адаптер принимают `#AARRGGBB` для `states[].fill` с CLI 0.6.5; так же уже экспортировались кнопки в прозрачных popup.

## Доказательства

| id | kind | status | source |
|---|---|---|---|
| plugin | typecheck/unit/build | passed | `npm run verify --prefix src/figma-plugin`: **499/499**; `button-preparation.test.ts` ожидает `#00000000`. |
| core | build/format | passed | `dotnet build ExtronExporter.slnx`: 0 errors. `tests/format`: **203/203**. |
| native | source → CLI → GDL/NRBF | passed | `button-preparation-integration.ts`, `native-integration.ts`, `transformed-artwork-integration.ts`: оба профиля PASS. |
| gui | GUI Designer 1.28.0.7, только просмотр | passed | Собранный вручную EXUI: фон-PNG 1280×800 на всю страницу, Frame `#FFFFFF`, две кнопки 340×106 с PNG радиусом 20. CLI 66/66. В GUI Designer у кнопки с `#00000000` углы показывают фон, у контрольной с `#FFFFFF` — белые углы. Проект закрыт без сохранения. |
| gcp | GCP preview | unavailable | Не проверялось. |
| device | панель | unavailable | Не проверялось. |

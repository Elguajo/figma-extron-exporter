# Контракт `.exui`, версия 2

Принят 19.10.2026 по запросу пользователя: несколько страниц, popup, группы popup и указание навигации. Версия 1 ([exui-v1.md](exui-v1.md)) не меняется и по-прежнему принимается. Выбор версии — только по маркеру `manifest.schema`, автоматического перехода между версиями нет.

Все правила v1 для ZIP, безопасных путей, JSON, ресурсов, PNG, профилей, шрифта, кнопок, подписей, регуляторов и трёх состояний кнопки действуют без изменений. Ниже — только отличия.

## Состав

```text
pages-popups-1025m.exui
├── manifest.json   schema "exui/2", profile, screen, resources
├── screen.json     schema "exui-screen/2"
└── assets/…png
```

Схемы JSON 2020-12: [manifest](../src/screen/schemas/exui-v2/manifest.schema.json), [screen](../src/screen/schemas/exui-v2/screen.schema.json). Определения элементов взяты из v1.

## screen.json

| Поле | Содержание |
|---|---|
| `project.name` | Имя проекта |
| `groups[]` (0..16) | `{key, groupId 1..65535, name}` — группы popup |
| `pages[]` (1..16) | `{key, objectId, name, background, shownBy, elements}` |
| `popups[]` (0..32) | `{key, objectId, name, background, modal, size?, group?, shownBy, elements}` |
| `assets[]` | Как в v1 |

**Страница.** У `shownBy` три значения:
- `start` — ровно одна страница; она становится стартовой;
- `navigation` — на неё ведёт хотя бы одна кнопка;
- `program` — её показывает программа управления.

Элементы страницы: `button`, `label`, `level`, `popup-ref`.

**Popup.** `modal` обязателен.
- Модальный popup занимает весь холст и не входит в группу; `size` и `group` у него запрещены. Ссылки на модальные popup Build создаёт сам, на каждой странице (проверено на нашем проекте).
- Обычный popup обязательно имеет `size` в пределах холста и, при желании, `group`.

`shownBy` у popup: `navigation` или `program`. Элементы popup: `button`, `label`, `level`; `popup-ref` внутри popup не поддерживается.

**`popup-ref`** — место, где показывается обычный popup. Поля: `{key, objectId, controlId: null, name, rect, kind: "popup-ref"}` и ровно одно из `popup` (ключ popup) или `group` (ключ группы).
- Прямая ссылка допустима только на обычный popup вне группы.
- Popup из группы размещается ссылкой на группу.
- Размер `rect` должен совпадать с размером popup (у группы — с общим размером участников): popup показывается в авторском размере.
- Каждый обычный popup должен размещаться хотя бы одной ссылкой.

**`navigate`** у кнопки — ключ страницы или popup, к которому она ведёт. **В GDL это не записывается**: формат GUI Designer 1.28 не хранит действий кнопок. Действия `PBActionShowPage` и подобные остались в сборке как типы, но в проектах не встречаются. Переход выполняет программа управления по имени страницы или popup. `navigate` нужен для карты ID и для проверки, что каждая страница и popup с `shownBy: "navigation"` достижимы.

## Идентификаторы и имена

- `objectId` страниц и popup — 1..65534; одно общее пространство ID. 65535 — Offline popup донора.
- Имена страниц и popup уникальны в одном пространстве вместе с `Offline Page`; иначе Build выдаёт ошибку (по данным toolkit).
- `objectId` элементов уникален внутри своей страницы или popup.
- `controlId` уникален во всём пакете. У `label` и `popup-ref` он `null` и записывается как 0.
- `key` уникален во всём пакете (страницы, popup, группы, элементы, ресурсы).

Порядок массивов задаёт порядок страниц, popup и элементов в проекте, но не ID.

## Что пишется в GDL

- Страницы — клоны страницы-донора, popup — клоны обычного или модального popup донора, `popup-ref` — клон ссылки донора.
- Связь popup хранится в четырёх местах, и все четыре пишутся из одного плана:
  1. `PBPopupPageID` ссылки: `popupID` и `groupID`, имена;
  2. `groupID` и `groupName` popup;
  3. обратные ссылки popup (`PBPopupReference`: страница, объект, тип Control) и `hasReferences`;
  4. реестр групп проекта.
- Реестр групп строится заново. В эталоне нет экземпляра `PBControlGroup`, поэтому он создаётся конструктором `(name, id)` — простой объект данных. `referenceCount` равен числу ссылок на группу; смысл поля Extron не документирован.
- Из донора остаётся только Offline popup. Его страницы и прочие popup удаляются.

Независимый верификатор (NRBF, без Extron) проверяет каждую страницу и popup: ID, имя, ключ, размер, фон, тип и группу, точный набор обратных ссылок, привязку каждой ссылки, реестр групп и все элементы.

## CLI

```powershell
& $dotnet run --project src/cli --no-build -- validate-package tests/fixtures/exui-v2/pages-popups-1025m.exui
& $dotnet run --project src/cli --no-build -- id-map tests/fixtures/exui-v2/pages-popups-1025m.exui
& $dotnet run --project src/cli --no-build -- convert-package tests/fixtures/exui-v2/pages-popups-1025m.exui output/new-1025m.gdl
```

`id-map` выводит Markdown для программиста:
- страницы и popup, как каждый показывается и где размещён;
- все ID с состояниями и целью перехода;
- группы.

Коды отказа — как в v1; новые семантические ошибки приходят с кодом `spec`.

## Ограничения

- Popup внутри popup, ссылки на popup из popup и таймауты popup не поддерживаются.
- Включение Offline-страницы не управляется; динамическая видимость не описывается.
- `referenceCount` группы — наше значение (число ссылок); Build может его пересчитать.
- Состав и поведение — только GUI Designer 1.28.0.7 и два профиля.
- GUI-проверка сгенерированных файлов `exui/2` выполняется вручную: протокол [2026-10-19-pages-popups](verification/results/2026-10-19-pages-popups.md).

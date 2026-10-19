# Карта ID: exui страницы и popup TLP Pro 1025M

Панель: TLP Pro 1025M. Стартовая страница: «Главная».

Страницы и popup программа управления показывает по имени. Элемент адресуется по ID Extron (controlId). Поле «Ведёт к» — указание для программы: в GDL переходы не хранятся.

| Контейнер | Тип | Имя | Как показывается |
|---|---|---|---|
| `page.home` | страница | Главная | стартовая |
| `page.sources` | страница | Источники | по кнопке: `nav.sources` (8111) |
| `popup.volume` | popup | Громкость | по кнопке: `nav.volume` (8112); место задаёт `home.volume-ref` на «Главная» |
| `popup.sources-1` | popup, группа «Источники» | Источники 1 | по кнопке: `nav.list-1` (8114); место задаёт `sources.group-ref` на «Источники» |
| `popup.sources-2` | popup, группа «Источники» | Источники 2 | по кнопке: `nav.list-2` (8115); место задаёт `sources.group-ref` на «Источники» |
| `popup.confirm` | модальный popup | Выключение | по кнопке: `nav.power` (8113) |

| ID | Ключ | Тип | Имя | Где | Состояния | Ведёт к |
|---:|---|---|---|---|---|---|
| 8101 | `source.music` | button | Источник Музыка | «Источники 1» | 0 Off (normal); 1 On (feedback); 2 Pressed (pressed) |  |
| 8102 | `source.radio` | button | Источник Радио | «Источники 1» | 0 Off (normal); 1 On (feedback); 2 Pressed (pressed) |  |
| 8103 | `volume.level` | level | Громкость | «Громкость» |  |  |
| 8104 | `volume.mute` | button | Mute | «Громкость» | 0 Off (normal); 1 On (feedback); 2 Pressed (pressed) |  |
| 8105 | `source.tv` | button | Источник ТВ | «Источники 2» | 0 Off (normal); 1 On (feedback); 2 Pressed (pressed) |  |
| 8106 | `source.mic` | button | Источник Микрофон | «Источники 2» | 0 Off (normal); 1 On (feedback); 2 Pressed (pressed) |  |
| 8111 | `nav.sources` | button | К источникам | «Главная» | 0 Off (normal); 1 On (feedback); 2 Pressed (pressed) | страница «Источники» |
| 8112 | `nav.volume` | button | Открыть громкость | «Главная» | 0 Off (normal); 1 On (feedback); 2 Pressed (pressed) | popup «Громкость» |
| 8113 | `nav.power` | button | Выключение | «Главная» | 0 Off (normal); 1 On (feedback); 2 Pressed (pressed) | popup «Выключение» |
| 8114 | `nav.list-1` | button | Список 1 | «Источники» | 0 Off (normal); 1 On (feedback); 2 Pressed (pressed) | popup «Источники 1» |
| 8115 | `nav.list-2` | button | Список 2 | «Источники» | 0 Off (normal); 1 On (feedback); 2 Pressed (pressed) | popup «Источники 2» |
| 8116 | `nav.back` | button | Назад | «Источники» | 0 Off (normal); 1 On (feedback); 2 Pressed (pressed) | страница «Главная» |
| 8121 | `confirm.yes` | button | Подтвердить выключение | «Выключение» | 0 Off (normal); 1 On (feedback); 2 Pressed (pressed) |  |
| 8122 | `confirm.no` | button | Отменить выключение | «Выключение» | 0 Off (normal); 1 On (feedback); 2 Pressed (pressed) |  |

| Группа popup | ID | Участники |
|---|---:|---|
| Источники | 1 | «Источники 1», «Источники 2» |

# Карта ID: Home

Панель: TLP Pro 1025M. Стартовая страница: «Home».

Страницы и popup программа управления показывает по имени. Элемент адресуется по ID Extron (controlId). Поле «Ведёт к» — указание для программы: в GDL переходы не хранятся.

| Контейнер | Тип | Имя | Как показывается |
|---|---|---|---|
| `page.home` | страница | Home | стартовая |

| ID | Ключ | Тип | Имя | Где | Состояния | Ведёт к |
|---:|---|---|---|---|---|---|
| 8101 | `home.volume` | slider | slider_Volume | «Home» |  |  |
| 8102 | `home.volumevalue` | value | value_VolumeValue | «Home» |  |  |
| 8103 | `home.signal` | level | gauge_Signal | «Home» |  |  |
| 8104 | `home.output` | level | volumeled_Output | «Home» |  |  |
| 8105 | `home.status` | level | multilevel_Status | «Home» | 0 Normal (normal); 1 state_Ready (feedback); 2 state_Error (feedback) |  |
| 8106 | `home.connection` | button | button_Connection | «Home» | 0 Normal (normal); 1 state_Ready (feedback); 2 state_Error (feedback); 3 Pressed (pressed) |  |

## Поведение для программы управления

Эти указания не исполняются самим GDL. Программа применяет доступность/видимость при запуске и обновляет группу выбора по обратной связи оборудования.

| ID | Ключ | Группа выбора | Доступен при запуске | Виден при запуске |
|---:|---|---|---|---|
| 8106 | `home.connection` | sources.hall | True | True |

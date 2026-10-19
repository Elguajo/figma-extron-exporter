# Первый собственный экран через локальный адаптер — 19 октября 2026

## Итог

Из собственного JSON-описания созданы два новых GDL с новыми объектами Extron:
- `output/first-screen/first-screen-1025m.gdl` — TLP Pro 1025M, 1280×800;
- `output/first-screen/first-screen-300m.gdl` — TLP Pro 300M, портрет 320×480.

Каждый файл содержит одну страницу «Главная» с четырьмя элементами:
- кнопкой «Музыка» с собственной иконкой;
- подписью «Громкость»;
- регулятором Level в режиме Slider;
- кнопкой «Без звука».

У кнопок по три различимых состояния. ID заданы явно.

Генерация выполнена через установленный GUI Designer 1.28.0.7 в отдельном 32-битном процессе Windows PowerShell 5.1. Каждый результат независимо проверен Microsoft NRBF reader без DLL Extron: **61/61** проверка для каждой панели.

**GUI Designer эти файлы не открывал.** Ручная проверка не выполнялась. Открытие, редактирование, Verify, Save and Build и повторное открытие не подтверждены. Поэтому GUI-совместимость **не заявляется**. Успешная упаковка и декодирование не доказывают корректность интерфейса.

## Среда и версии

| Компонент | Версия |
|---|---|
| Windows | 11 Pro 10.0.26300 |
| GUI Designer | 1.28.0.7, `C:\Program Files (x86)\Extron\GUI Designer`; загружено 40 сборок |
| Хост адаптера | `C:\Windows\SysWOW64\WindowsPowerShell\v1.0\powershell.exe`, PowerShell 5.1.26100.9711, x86 (`IntPtr.Size = 4`), CLR 4.0.30319.42000 |
| .NET SDK | 10.0.402 (`.tools/dotnet`), System.Formats.Nrbf 10.0.11 |
| Источник приёмов | rob-paprocki/extron-gdl-toolkit @ `4390741bd9acc6df7e9bbb4e5a9d9246ac7abdb4`. Код toolkit не копировался. Пользователь сообщил о наличии лицензии; текст лицензии в репозиторий не передан. |

## Команды

```powershell
$dotnet = '.\.tools\dotnet\dotnet.exe'
& $dotnet restore ExtronExporter.slnx --locked-mode
& $dotnet build ExtronExporter.slnx --no-restore
& $dotnet run --project src/cli --no-build -- prepare-donor tlp-pro-300m-portrait
& $dotnet run --project src/cli --no-build -- prepare-donor tlp-pro-1025m
& $dotnet run --project src/cli --no-build -- generate-screen examples/first-screen/screen-1025m.json tlp-pro-1025m output/first-screen/first-screen-1025m.gdl
& $dotnet run --project src/cli --no-build -- generate-screen examples/first-screen/screen-300m.json tlp-pro-300m-portrait output/first-screen/first-screen-300m.gdl
& $dotnet run --project tests/format --no-build -- samples/original/Full-Test-Project.gdl 'C:\Users\Public\Documents\Extron\GUI Designer Templates\TouchLink Templates' --built output/Full-Test-Project-music.gdl --registry samples/donors.json --integration
```

## Доказательства

| id | Проверка | Статус | Источник |
|---|---|---|---|
| build | Сборка solution, locked restore | passed | 0 warnings, 0 errors |
| tests-full | Синтетические, реальный GDL, 44 GLT, built GDL, реестр, интеграция | passed, 122/122 | [2026-10-19-first-screen-tests.txt](2026-10-19-first-screen-tests.txt) |
| tests-plain | Без аргументов, без Extron | passed, 50/50 | `dotnet run --project tests/format --no-build` |
| host-x86 | Загрузка сборок Extron в отдельном x86 PS 5.1 | passed | 40 сборок, BinaryFormatter Deserialize корня PBProject |
| donor-300m | Донор 300M: копия эталона, страница Main и Offline popup | passed | PBTLP300MPlatform, enum 44, 60-1667-02, 320×480 |
| donor-1025m | Донор 1025M: тот же эталон, `PBPlatformPro.CreatePlatform(TLP1025M)` | passed (данные) | PBTLP1025MPlatform, enum 30, 60-1566-02, 1280×800; все элементы внутри холста |
| donor-repro | Повторная подготовка обоих доноров в отдельной копии | passed | SHA-256 совпали с `samples/donors.json` |
| generate | Генерация обеих панелей | passed | [first-screen-1025m.gdl.report.json](2026-10-19-first-screen/first-screen-1025m.gdl.report.json), [first-screen-300m.gdl.report.json](2026-10-19-first-screen/first-screen-300m.gdl.report.json): 61/61 |
| determinism | Повторная генерация из того же входа | passed | Одинаковый SHA-256; интеграционный тест и повтор 300M |
| ids | Сохранность ID при обратном порядке, новых текстах и сдвиге | passed | Интеграционный тест: key → objectId, controlId и тип совпадают |
| integrity | Исходники, доноры и эталоны не изменены | passed | [file-hashes.json](2026-10-19-first-screen/file-hashes.json); тест «donors and local references unchanged» |
| cli-errors | Понятная диагностика | passed | [2026-10-19-first-screen-cli-errors.txt](2026-10-19-first-screen-cli-errors.txt) |
| gui-open | Открытие в GUI Designer | **not run** | Ручная проверка не выполнялась |
| gui-edit | Редактирование элементов | **not run** | — |
| gui-verify | Verify | **not run** | — |
| gui-build | Save and Build | **not run** | Только вручную пользователем |
| gui-reopen | Закрытие и повторное открытие | **not run** | — |
| hardware | Панель | unavailable | Оборудование не проверялось |

## Что проверяет независимый верификатор

Проверки выполняются чтением NRBF, без Extron:

- профиль: класс платформы, числовое значение PlatformProTypeEnum, part number, размер экрана и платформы, версия 1.28.0.7, checksum 0;
- одна страница: ID 100, start page, имя, ключ, размер, фон;
- каждый элемент, найденный по objectId:
  - тип и controlId;
  - ключ в Comments, имя и прямоугольник;
  - текст подписи и цвет;
  - Level: display, orientation, min, max, fill;
  - у кнопок: число, имена, ID и индексы состояний; текст, заливка, цвет текста и иконка каждого состояния; индекс press feedback; различимость состояний;
- два новых PBImageResource 64×64, отсутствующие у донора; ссылки состояний на них;
- ресурсы донора сохранены, popup донора не изменены;
- все элементы внутри холста, неизменность payload после упаковки и неизменность файла донора.

Числовые значения enum хост получает от типов Extron. До приёма результата они сравниваются с ожидаемыми:
- Slider = 1;
- LeftToRight = 0;
- TLP300M = 44;
- TLP1025M = 30.

Кириллица сравнивается точными строками. Байты UTF-8 «Громкость» дополнительно просмотрены в выводе `list-controls`.

## Заявления toolkit и наши результаты

| Заявление toolkit | У нас |
|---|---|
| Запись требует x86 Windows PowerShell 5.1 и сборок GUI Designer | Воспроизведено: x86-хост загружает 40 сборок и десериализует проект |
| Объекты клонируются, а backing fields записываются reflection; конструкторы и setters без UI падают | Клонирование и запись полей воспроизведены. Падение конструкторов не проверялось: их не вызывали |
| `PBPlatformPro.CreatePlatform` даёт правильный part number при смене панели | Воспроизведено на уровне данных: 60-1566-02, 1280×800. В GUI не проверено |
| Сохранение печатает «The system cannot find the file specified», это безвредно | То же сообщение есть при каждом сохранении. Результат декодируется и проходит проверки |
| Повторная сериализация стабильна | Подготовка и генерация у нас побайтово детерминированы |
| Результат открывается, проходит Save and Build и редактируется | **Не воспроизведено**, ручная проверка не выполнена |
| Контейнер распаковывается глобальной заменой KP→PK | Не используется. Наш reader разбирает центральный каталог и проверяет порядок, размеры и CRC каждой записи |

## Обнаруженная и исправленная ошибка

В первой подготовке донора 1025M масштаб был 2 вместо 1,667: в PowerShell `1280/320` даёт Int32, а `[Math]::Min(int, double)` округлил второе значение. Из-за этого Offline popup выходил за холст: −20 по вертикали.

Ошибочный донор удалён и пересоздан. Добавлены два уровня проверки:
- приведение к double;
- независимая проверка «все элементы внутри холста» при подготовке донора, загрузке реестра и генерации.

## Ограничения

- Донор 1025M получен сменой платформы в копии проекта 300M, а не через Create Wizard. Его профиль подтверждён только чтением данных, в GUI он не открывался.
- Сгенерированный проект содержит только новую страницу. Остаются ресурсы и палитра донора, Offline popup и устаревшее preview донора. Номер версии и даты не меняются; Build обновит их.
- Регулятор громкости — PBLevel с DisplayType Slider. В доноре нет экземпляра класса PBSlider, поэтому создать его клонированием нельзя.
- Шрифт Arial из ресурсов донора. Отображение кириллицы в GUI не проверено.
- Поддержаны только button, label, level. Ресурсы — только PNG. Одна страница; popup и навигация не создаются.
- Адаптер привязан к 1.28.0.7 и к донорам из `samples/donors.json`. Произвольный GDL в него не передаётся.
- Build не автоматизирован и не запускался.

## Ручная проверка

Инструкция: [examples/first-screen/README.md](../../examples/first-screen/README.md#ручная-проверка-в-gui-designer). Порядок: открытие → редактирование элементов → Verify → Save and Build → закрытие → повторное открытие. После сохранения ID сверяются командой `list-controls`.

# Профили совместимости Extron — 24.10.2026

Проверка локальных рабочих исходников в основной папке `main`, после 0.7.3. Версии выпуска не повышались; публикации и установки обновлений Extron не выполнялись. Существующие изменения других работ сохранены.

## Что реализовано

- Внешний строгий каталог точных версий `compatibility/extron.json`, выбор через `--compatibility`; отдельная версия доноров, SHA-256 и независимая проверка результата.
- `doctor`: инвентаризация GUI Designer/GCP, проверка общего контракта x86-адаптера без десериализации проекта, отпечаток структуры и SHA-256 основных DLL.
- Проверка типов и полей перед каждой генерацией; профиль, статус, реально загруженные версии и отпечаток попадают в отчёт генерации. Изменившиеся поддерживаемые enum отвергаются.
- EXUI/5 плагина сохраняет независимость от версии Extron; поставка CLI включает каталог и инструкцию квалификации обновлений.

## Результаты

| Проверка | Результат | Свидетельство |
|---|---|---|
| Сборка .NET SDK 10.0.402 | 0 warnings / 0 errors | [build.txt](2026-10-24-extron-compatibility/build.txt) |
| Unit, доноры и настоящие интеграции Extron | **253 passed / 0 failed** | [dotnet-tests.txt](2026-10-24-extron-compatibility/dotnet-tests.txt) |
| Плагин: typecheck, tests, build | **616 passed / 0 failed** | [plugin-verify.txt](2026-10-24-extron-compatibility/plugin-verify.txt) |
| `doctor` из упакованной поставки | Ready; GUI Designer **1.28.0.7**, GCP **3.34.1.4**; флаги GUI/GCP false | [doctor.json](2026-10-24-extron-compatibility/doctor.json) |
| Архив плагина → EXUI → упакованный native CLI, expanded обеих панелей | **116/116** на каждую | [archive-smoke.txt](2026-10-24-extron-compatibility/archive-smoke.txt) |
| Внешний experimental-профиль `local-candidate` без пересборки плагина | **116/116** на каждую; профиль отражён в `.gdl.report.json` | [candidate-smoke.json](2026-10-24-extron-compatibility/candidate-smoke.json) |
| Каталог без профиля установленной версии | Ready false, `extron-version`, exit 1 | [unknown-doctor.json](2026-10-24-extron-compatibility/unknown-doctor.json) |
| Профиль не принимает версию донора | `donor-version`, exit 1; GDL и report не созданы | [donor-refusal.txt](2026-10-24-extron-compatibility/donor-refusal.txt) |

Основной тестовый прогон проверяет точный выбор версий, ошибочные схемы/адаптеры/диапазоны, null и неоднозначные профили, отсутствие fallback, изменившиеся enum, реальное соответствие версии закреплённого донора и независимость verifier от единственной версии. Интеграции проверяют повторяемость GDL, постоянство ID, неизменность доноров и источников, отказы до публикации результата. Два реальных `doctor` дают одинаковый отпечаток; внешний профиль не изменяет штатный каталог.

Команды воспроизведения из корня:

```powershell
& ./.tools/dotnet/dotnet.exe build ExtronExporter.slnx --no-restore
& ./.tools/dotnet/dotnet.exe run --project tests/format --no-build -- --registry samples/donors.json --integration
npm run verify --prefix src/figma-plugin
& ./.tools/dotnet/dotnet.exe run --project src/cli --no-build -- doctor
```

Локальная preview-поставка: `output/releases/compatibility-20261024-a4dcf6ca/`, с `sourceDirty: true`. Штатная публичная поставка содержит CLI и каталог; отдельный локальный ZIP с частными донорами не публиковался. Smoke использовал `archive-smoke.ts ... expanded`: Figma API/PNG моделируются, writer и verifier — настоящие. Соседние изменения оформления Extron Kit не являются предметом этого протокола.

## Review и границы

Рассмотрены diff CLI, каталога, реестра, хоста, генератора, verifier и упаковки. Проверены вызовы от команды до публикации файлов, точный выбор версии в обоих процессах, отсутствие выбора DLL из EXUI, сохранение SHA-256 allow-list и независимой проверки. В ходе проверки исправлены недоступность `Get-FileHash` в x86-хосте и перезапись переменной отпечатка при подсчёте хешей DLL. После исправления проверки выше пройдены; известных блокирующих дефектов в этом изменении не осталось.

Будущая версия GUI Designer не устанавливалась и не квалифицировалась. Версия `1.29.0.1` используется только в unit-тесте маршрутизации каталога; настоящий experimental-прогон использует установленную `1.28.0.7`. Новый GUI Verify/Build/reopen, импорт в GCP и оборудование не проверялись. `Ready` не подтверждает наличие донора или прохождение GUI/GCP-цикла. Низкоуровневый `set-button-text` остаётся ограничен исследованной версией.

Новая версия с прежним контрактом может подключаться JSON-профилем. При изменении сериализации/runtime, полей или смыслов контролов требуется локализованное изменение адаптера и verifier, затем квалификация по [инструкции](../../docs/extron-compatibility.md).

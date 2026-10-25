<a id="russian"></a>

# Совместимость с обновлениями Extron

**Русский** · [English](#english)

Продукт разделяет три независимо развивающихся контракта:

| Граница | Кто отвечает за обновление |
|---|---|
| Figma → EXUI | Плагин экспортирует семантику, постоянные ID и PNG; версия GUI Designer в пакет не зашита |
| EXUI → GDL | CLI выбирает локальный профиль GUI Designer, запускает соответствующий адаптер и независимо проверяет результат |
| GDL после Save and Build → GCP | Отдельный ручной импорт и проверка сохранности команд, feedback и ID |

Обновление GUI Designer при сохранении его структуры данных может потребовать только нового JSON-профиля. Изменение сериализации, полей, enum, архитектуры процесса или модели контролов потребует обновления адаптера и независимого verifier. Неизвестную структуру нельзя сделать поддерживаемой одной заменой номера версии.

## Диагностика установленной среды

В новой локальной сборке CLI:

```powershell
.\ExtronExporter.ps1 doctor
.\ExtronExporter.ps1 doctor --extron-dir 'C:\Program Files (x86)\Extron\GUI Designer' --gcp-dir 'C:\Program Files (x86)\Extron\GCP'
```

Команда возвращает JSON и код завершения 0, если установленный GUI Designer подходит для проверки адаптером; 1 при несовместимости. `Ready` означает готовность среды и общего контракта адаптера, не наличие всех доноров или успешный Build/импорт. Команда не читает проекты и не десериализует донора.

Отчёт содержит версии GUI Designer и GCP, выбранный профиль, доступность x86-хоста, проверку основных сериализуемых типов/полей и фабрики платформ, значения enum, SHA-256 двух основных сборок и отпечаток проверяемой структуры. Отпечаток служит для сравнения прогонов; он не заменяет тестирование. Специфичные поля контролов дополнительно проверяются во время генерации и независимым NRBF-verifier до публикации GDL.

GCP не является зависимостью конвертации. Его отсутствие не блокирует `doctor` или генерацию; наличие не означает подтверждённой совместимости импорта. `GuiDesignerVerified` и `GcpVerified` остаются `false` до отдельного ручного протокола. Переменные `EXTRON_GUI_DESIGNER_DIR` и `EXTRON_GCP_DIR` задают альтернативные каталоги; явные параметры имеют приоритет.

## Профили версий

Штатный каталог — `cli/compatibility/extron.json` в поставке; при запуске из исходников — `src/adapter/compatibility/extron.json` рядом со сборкой CLI. Единственный исходный профиль — GUI Designer **1.28.0.7**, адаптер `gui-designer-nrbf-x86/1`. Это исходная проверенная база, а не обещание поддержки всех элементов, GCP или оборудования.

Для пробной квалификации новой версии создайте отдельный файл (пример ниже использует условную будущую версию):

```json
{
  "schemaVersion": 1,
  "profiles": [
    {
      "id": "candidate-1.29.0.1",
      "adapter": "gui-designer-nrbf-x86/1",
      "guiDesignerVersion": "1.29.0.1",
      "donorVersions": ["1.28.0.7"],
      "status": "experimental"
    }
  ]
}
```

```powershell
.\ExtronExporter.ps1 doctor --compatibility .\candidate.json
.\ExtronExporter.ps1 convert-package .\interface.exui .\candidate.gdl --compatibility .\candidate.json
```

Файл полностью заменяет штатный каталог для этого вызова. Версия сопоставляется точно, включая build; диапазонов, wildcard и автоматического fallback нет. Дубликаты версий/ID, неизвестные адаптеры, схемы и поля отвергаются. Список `donorVersions` явно разрешает версии исходных доноров; он не ослабляет SHA-256, allow-list, проверку профиля панели или независимую проверку результата. Поле `applicationBuildVersionInfoField` сохраняет версию донора до штатного сохранения в редакторе; версия реально использованных DLL и профиль записываются отдельно в `Generation.AdapterResult` отчёта.

Реестр `donors.json` по-прежнему имеет собственную версию схемы 1. Его `guiDesignerVersion` описывает фактическую версию проектов-доноров, а не установленной программы. Для новой версии доноров нужен отдельный реестр и новые закреплённые SHA-256; старый реестр и исходники не перезаписываются. Все команды адаптера принимают `--compatibility`, `--extron-dir` и `--registry`. Пакет EXUI не может задавать эти пути или выбирать DLL.

`status` (`baseline` / `experimental`) — метка сопровождающего профиля, а не результат автоматической сертификации. Даже профиль с `baseline` не выставляет флаги GUI/GCP-проверки. Неизвестная версия без явно заданного профиля останавливается с `extron-version`; изменение основного контракта — с `adapter-contract` либо точной ошибкой недоступного типа/поля.

## Как принять обновление

1. Сохранить прежнюю рабочую поставку, доноры и настроенный проект GCP. Получить новую версию Extron штатным способом; CLI не обновляет программы Extron.
2. Снять `doctor` и сравнить версии, контрольные суммы и отпечаток с предыдущим прогоном. Для неизвестной версии подготовить отдельный `experimental`-профиль.
3. Прогнать автоматические тесты, преобразования обеих панелей, полный набор поддержанных контролов, страниц и popup. Проверить постоянство ID, состояния, шрифты и повторяемость результата. Если контракт изменился, изменить адаптер и verifier согласованно; новый JSON не заменяет эти работы.
4. На копиях выполнить GUI Designer Verify, Save and Build, закрыть и повторно открыть. Зафиксировать точные версии и числа ошибок/предупреждений.
5. Если используется GCP, импортировать результат в копию настроенного проекта, проверить команды, feedback, переходы и уровни, сохранить и повторно открыть. Использовать `compare-packages` перед обновлением макета и [инструкцию обновления проекта](updating-configured-projects.md).
6. Только после протокола квалификации переводить профиль в `baseline` и выпускать каталог. Если менялся только профиль, плагин и EXUI обновлять не требуется. При изменении семантики или новых возможностях расширять версионируемый EXUI отдельно, сохраняя обработку старых пакетов.

При смене x86 .NET Framework/NRBF на иной runtime или формат потребуется новый реализованный адаптер с новым ID. Текущий каталог намеренно не принимает неизвестные ID. Экспериментальная низкоуровневая команда `set-button-text` остаётся ограничена исследованной версией 1.28.0.7; её правила байтовой правки не распространяются на новые версии автоматически.

Основания: Extron описывает независимое развитие программ и четырёхчастную нумерацию в [Software Product Lifecycle](https://www.extron.com/software/productlifecycle). Порядок «GUI Designer: save/build → GCP: назначение функций» описан в [руководстве TLP Pro 300M, стр. 24](https://www.extron.com/download/files/userman/68-3146-01_E_TLP_Pro_TLS_300M_UG.pdf). Внутренний NRBF-контракт — локально исследованная структура, не официальный API Extron.

---

<a id="english"></a>

# Compatibility with Extron updates

[Русский](#russian) · **English**

The product separates three contracts that evolve independently:

| Boundary | Who handles updates |
|---|---|
| Figma → EXUI | The plugin exports semantics, persistent IDs and PNGs; the GUI Designer version is not baked into the package |
| EXUI → GDL | The CLI picks a local GUI Designer profile, runs the matching adapter and verifies the result independently |
| GDL after Save and Build → GCP | A separate manual import and a check that commands, feedback and IDs are kept |

A GUI Designer update that keeps its data structure may only need a new JSON profile. A change of serialization, fields, enums, process architecture or the control model needs an adapter update and an independent verifier. An unknown structure cannot be made supported by just changing the version number.

## Diagnosing the installed environment

In a new local CLI build:

```powershell
.\ExtronExporter.ps1 doctor
.\ExtronExporter.ps1 doctor --extron-dir 'C:\Program Files (x86)\Extron\GUI Designer' --gcp-dir 'C:\Program Files (x86)\Extron\GCP'
```

The command returns JSON and exit code 0 if the installed GUI Designer is suitable for an adapter check; 1 if it is incompatible. `Ready` means the environment and the common adapter contract are ready, not that all donors exist or that Build/import succeed. The command does not read projects and does not deserialize a donor.

The report contains the GUI Designer and GCP versions, the selected profile, availability of the x86 host, a check of the main serializable types/fields and the platform factory, enum values, the SHA-256 of the two main assemblies and a fingerprint of the checked structure. The fingerprint is for comparing runs; it does not replace testing. Control-specific fields are additionally checked during generation and by the independent NRBF verifier before the GDL is published.

GCP is not a dependency of the conversion. Its absence does not block `doctor` or generation; its presence does not mean that import compatibility is confirmed. `GuiDesignerVerified` and `GcpVerified` stay `false` until a separate manual report exists. The `EXTRON_GUI_DESIGNER_DIR` and `EXTRON_GCP_DIR` variables set alternative folders; explicit parameters take precedence.

## Version profiles

The default catalog is `cli/compatibility/extron.json` in the release; when running from source it is `src/adapter/compatibility/extron.json`, copied next to the CLI build. The only built-in profile is GUI Designer **1.28.0.7** with the `gui-designer-nrbf-x86/1` adapter. It is the verified baseline, not a promise to support every element, GCP or hardware.

To trial a new version, create a separate file (the example uses a hypothetical future version):

```json
{
  "schemaVersion": 1,
  "profiles": [
    {
      "id": "candidate-1.29.0.1",
      "adapter": "gui-designer-nrbf-x86/1",
      "guiDesignerVersion": "1.29.0.1",
      "donorVersions": ["1.28.0.7"],
      "status": "experimental"
    }
  ]
}
```

```powershell
.\ExtronExporter.ps1 doctor --compatibility .\candidate.json
.\ExtronExporter.ps1 convert-package .\interface.exui .\candidate.gdl --compatibility .\candidate.json
```

The file fully replaces the default catalog for that call. Versions are matched exactly, including the build number; there are no ranges, wildcards or automatic fallback. Duplicate versions/IDs, unknown adapters, schemas and fields are refused. `donorVersions` explicitly allows the versions of the source donors; it does not weaken the SHA-256 check, the allow-list, the panel profile check or the independent verification of the result. The `applicationBuildVersionInfoField` keeps the donor version until the project is saved normally in the editor; the version of the DLLs actually used and the profile are recorded separately in the report's `Generation.AdapterResult`.

The `donors.json` registry still has its own schema version 1. Its `guiDesignerVersion` describes the actual version of the donor projects, not of the installed program. A new donor version needs a separate registry and newly pinned SHA-256 values; the old registry and sources are not overwritten. All adapter commands accept `--compatibility`, `--extron-dir` and `--registry`. An EXUI package cannot set these paths or choose DLLs.

`status` (`baseline` / `experimental`) is a label set by the maintainer, not the result of automatic certification. Even a `baseline` profile does not set the GUI/GCP verification flags. An unknown version without an explicit profile stops with `extron-version`; a change of the main contract stops with `adapter-contract` or with the exact error for the missing type/field.

## How to accept an update

1. Keep the previous working release, the donors and the configured GCP project. Get the new Extron version the normal way; the CLI does not update Extron programs.
2. Run `doctor` and compare the versions, checksums and fingerprint with the previous run. For an unknown version, prepare a separate `experimental` profile.
3. Run the automated tests, conversions for both panels, the full set of supported controls, pages and popups. Check that IDs, states and fonts are stable and that the result is repeatable. If the contract changed, update the adapter and the verifier together; a new JSON does not replace this work.
4. On copies, run GUI Designer Verify, Save and Build, close and reopen. Record the exact versions and the number of errors/warnings.
5. If GCP is used, import the result into a copy of the configured project, check commands, feedback, navigation and levels, save and reopen. Use `compare-packages` before updating the layout and follow the [project update guide](updating-configured-projects.md#english).
6. Only after a qualification report, switch the profile to `baseline` and release the catalog. If only the profile changed, the plugin and EXUI do not need updating. If the semantics change or new features are added, extend the versioned EXUI separately and keep handling old packages.

Moving from x86 .NET Framework/NRBF to another runtime or format needs a newly implemented adapter with a new ID. The current catalog deliberately refuses unknown IDs. The experimental low-level `set-button-text` command remains limited to the studied version 1.28.0.7; its byte-level editing rules do not extend to new versions automatically.

Sources: Extron describes the independent development of its programs and the four-part version numbers in the [Software Product Lifecycle](https://www.extron.com/software/productlifecycle). The order "GUI Designer: save/build → GCP: assign functions" is described in the [TLP Pro 300M user guide, p. 24](https://www.extron.com/download/files/userman/68-3146-01_E_TLP_Pro_TLS_300M_UG.pdf). The internal NRBF contract is a locally studied structure, not an official Extron API.

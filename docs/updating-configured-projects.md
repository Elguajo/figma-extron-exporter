<a id="russian"></a>

# Обновление дизайна после настройки GCP

**Русский** · [English](#english)

CLI **0.8.3**, плагин **0.8.3**, EXUI/5. Сравнение пакетов и выборочное обновление GDL работают без Figma и доноров.

Главное правило: настройки кнопок GCP (Press, Release, Visual и Text Feedback) привязаны к **ID кнопки**. Они сохраняются, пока кнопка в новом GDL имеет тот же ID, а импорт выполняется с сохранением конфигурации. Если программист добавлял страницы или кнопки прямо в GUI Designer, импортируйте не GDL из Figma, а **рабочий GDL с перенесённым оформлением** — см. [выборочное обновление](#выборочное-обновление-рабочего-gdl).

## Сохранить рабочую версию

После первого согласованного экспорта сохраните вместе исходный Figma-макет с назначениями, `.exui`, GDL после Save and Build, карту `id-map` и проект GCP (`.gcplus`/`.gcpro`). Рабочий EXUI — база сравнения с тем интерфейсом, для которого действительно настроена логика. Один GDL не заменяет эту базу: команда сравнивает именно EXUI/5.

Для истории храните отдельные версии, например `interface-v1.exui`, `interface-v2.exui`. Отчёт включает SHA-256 обоих пакетов. Автоматической базы всей истории назначений и чтения проекта GCP эта команда не создаёт. Чтобы увидеть последствия для установленной системы, сравнивайте новый экспорт с её рабочей версией, даже если между ними были промежуточные экспорты.

## Внести изменения в Figma

- Меняйте оформление существующего слоя кнопки: размеры, положение, подпись, цвет и иконку. Его objectId, controlId и сохранённые ID состояний не назначаются заново из-за косметических правок.
- Новые и скопированные кнопки получают отдельные ID. Счётчики резервируют удалённые автоматически выданные номера в исходном проекте Figma. Полной истории ручных ID у счётчиков нет.
- Удаление слоя и создание похожего заново не сохраняет его идентичность. Не подставляйте прежний ID новой функции только ради устранения предупреждения.
- Переименование меняет автоматический смысловой ключ, сохраняя числовые ID. Переименование страницы/popup может затронуть команды, обращающиеся по имени.
- Изменение типа, состояний, press feedback, диапазона регулятора или цели перехода требует проверки программистом независимо от сохранения controlId.
- Сохраняйте ID плагина в manifest: под ним Figma хранит назначения.

## Сравнить старый и новый экспорт

В PowerShell из папки распакованного CLI:

```powershell
.\ExtronExporter.ps1 compare-packages .\interface-v1.exui .\interface-v2.exui | Out-File -Encoding utf8 .\changes-v1-v2.md
```

Машиночитаемый отчёт:

```powershell
.\ExtronExporter.ps1 compare-packages .\interface-v1.exui .\interface-v2.exui --json | Out-File -Encoding utf8 .\changes-v1-v2.json
```

Не указывайте существующие исходники как файл перенаправления: `Out-File` принадлежит PowerShell и может перезаписать выбранный файл. Сама команда только читает пакеты; проверяет ZIP, схемы, ID, ссылки и PNG до сравнения. При повреждении любого пакета отчёт не выдаётся.

В отчёт входят страницы, popup, группы, управляющие и пассивные элементы. Неизменённые элементы посчитаны в Markdown и полностью перечислены в JSON.

| Уровень | Что означает | Что делать |
|---|---|---|
| `info` | Изменены оформление, подпись, геометрия или ключ; в этом изменении не обнаружена смена адресации | Проверить внешний вид и фактическое назначение кнопки |
| `review` | Новый элемент, имя, objectId, контейнер, порядок перекрытия, диапазон, переход, поведение или связь popup | Сверить с существующими настройками GCP; новым управляющим элементам назначить функции |
| `breaking` | Удаление элемента, смена controlId/типа, структуры состояний/press feedback, профиля либо возможное переиспользование ID | Проверить и исправить затронутые назначения до обновления рабочей системы |

Сопоставление идёт сначала по ключу, затем по ID объекта в контейнере, затем по controlId. Последний вариант помечается как возможная замена/подмена ID и всегда требует проверки. Совпадение идентификаторов не доказывает, что дизайнер сохранил смысл кнопки.

Поля отчёта: `schema: exui-comparison/1`, снимки `before`/`after` с SHA-256 и профилем, `projectChanges`, `items`, `requiresReview`, `gcpVerified: false`. У элемента указаны старые/новые имена, ключи, контейнеры, objectId/controlId, способ сопоставления и изменения. Порядок состояний сравнивается по явным stateId, а PNG — по содержимому, без временных файловых путей. Значения `changes[].before/after` представлены строками; для обычных полей это JSON-представление значения, для поясняющих событий — текст.

Код выхода `0` означает, что сравнение успешно выполнено, в том числе при `breaking`. Код `1` — ошибка чтения/проверки; `2` — неверные аргументы. Для автоматизации читайте `requiresReview` и уровни изменений, а не трактуйте код `0` как разрешение обновления.

## Выборочное обновление рабочего GDL

Основной путь, если в проекте есть страницы, popup или кнопки, созданные в GUI Designer вручную. Полный GDL из Figma их не содержит: при импорте они пропадут вместе с логикой, а команды, ссылающиеся на них, останутся без цели.

**Рабочий GDL** — тот, что сейчас импортирован в проект GCP, включая ручные правки программиста, в виде файла, **сохранённого GUI Designer** (Save and Build). Храните его рядом с проектом; после каждого обновления рабочим становится новый файл. Если CLI сообщает `Missing KP end record or invalid archive comment length`, файл записан не GUI Designer (у GDL из GUI Designer переставлена сигнатура архива: `KP` вместо обычной `PK`): возьмите исходный GDL программиста.

Команды ниже выполняются в PowerShell из папки распакованного CLI. Строки `if ($LASTEXITCODE) { throw … }` останавливают выполнение при ошибке CLI: без них PowerShell продолжит со следующей команды.

1. Экспортируйте `.exui` из Figma и создайте из него GDL обычным `convert-package`, например `figma-new.gdl`.
2. Постройте план. В нём перечислены все кнопки рабочего GDL; `canUpdate: true` — кнопка с тем же ID найдена в новом экспорте и её оформление можно перенести без смены ID, имени и поведения. Для остальных в `reason` указана причина.

   ```powershell
   .\ExtronExporter.ps1 plan-layout-update .\working.gdl .\figma-new.gdl | Out-File -Encoding utf8 .\plan.json
   if ($LASTEXITCODE) { throw 'plan-layout-update failed, see ERROR above' }
   $plan = Get-Content -Raw .\plan.json | ConvertFrom-Json
   $plan.items | Where-Object canUpdate | Format-Table controlId, page, name, beforeCaption, afterCaption
   ```

3. Сохраните выбор. Все доступные кнопки:

   ```powershell
   $ids = @($plan.items | Where-Object canUpdate | ForEach-Object controlId)
   ```

   или только нужные: `$ids = @(9166, 9140, 9153)`. Затем:

   ```powershell
   @{ schema = 'exui-layout-selection/1'; baseSha256 = $plan.baseSha256; sourceSha256 = $plan.sourceSha256; controlIds = $ids; includeGeometry = $false } | ConvertTo-Json | Out-File -Encoding utf8 .\selection.json
   ```

   `includeGeometry = $true` переносит также положение и размеры выбранных кнопок; по умолчанию меняется только оформление.
4. Примените выбор в **новый** файл (существующий файл не перезаписывается):

   ```powershell
   .\ExtronExporter.ps1 update-layout .\working.gdl .\figma-new.gdl .\selection.json .\working-v2.gdl
   if ($LASTEXITCODE) { throw 'update-layout failed, see ERROR above' }
   ```

   Команда проверяет, что все невыбранные элементы, страницы и popup остались без изменений, и останавливается при несовпадении хеша рабочего GDL или экспорта с планом.
5. Откройте `working-v2.gdl` в GUI Designer → Verify → Save and Build. Затем импортируйте его в копию проекта GCP по шагам [следующего раздела](#обновить-копию-проекта-gcp).

Кнопки, которых нет в плане как `canUpdate`, этим путём не обновляются: новые кнопки из Figma, кнопки с изменённым ID и с несовместимыми состояниями. Чтобы не терять ID, в Figma редактируйте существующие слои кнопок, а не создавайте их заново.

При сборке из исходников то же доступно в окне `src/updater` («Figma → Extron — обновление оформления GDL») с превью «сейчас / новое». В архивы выпуска эта утилита не входит.

Проверка на реальном проекте: [выборочное обновление в копии GCP](verification/results/2026-10-25-gcp-selected-update.md) — команды, Text и Visual Feedback обновлённых кнопок сохранились, ручные страницы остались на месте.

## Обновить копию проекта GCP

1. Создайте новый GDL из нового EXUI либо выборочно обновите рабочий GDL (см. выше). В GUI Designer проверьте его, выполните Verify → Save and Build → повторное открытие. Build остаётся штатным действием пользователя.
2. Откройте **копию существующего проекта GCP**. Выберите нужную сенсорную панель → **User Interfaces** → **Import layout** и укажите новый GDL.
3. В **Layout Reconciliation** выберите вариант сохранения существующей конфигурации (`Import new layout and keep existing…`; точная подпись зависит от контекста). Проверьте соответствующие и отсутствующие объекты; при необходимости включите **Show only conflicts**. При неожиданных соответствиях отмените импорт и исправьте причину.
4. Проверьте действия и visual feedback существующих кнопок. Добавленным управляющим элементам назначьте логику; ссылки на удалённые элементы исправьте. Проверьте команды показа страниц/popup, особенно после переименования.
5. Сохраните тестовую конфигурацию отдельной версией. Работу кнопок, удержаний, уровней и feedback подтвердите на системе перед обновлением рабочей установки.

Процедура импорта и Layout Reconciliation описана в установленной справке **GCP → Configuration Palette → User Interfaces → Importing a layout / Layout Reconciliation**. 23.10.2026 она также проверена на паре экспортированных GDL для TLP Pro 1025M в GCP Plus 3.34.1.4: действие и visual feedback Music сохранились, Mute показан как Missing, новая Extra не получила его действие. Сохранение и повторное открытие GCP прошли. [Фактический протокол и границы](verification/results/2026-10-23-gcp-layout-update.md). Не переносите настройки удалением панели и добавлением её заново.

## Контрольный сценарий и оставшееся покрытие

Подготовлены пары `tlp-pro-1025m-v1.gdl` / `tlp-pro-1025m-v2.gdl` и соответствующая пара 300M в `output/update-workflow/` после запуска интеграционного сценария. Для каждой панели:

1. Выполнить Verify и Save and Build на обеих версиях в GUI Designer, записать результат.
2. Импортировать v1 в отдельный локальный проект GCP. Настроить действие и visual feedback кнопки Music, действие кнопки Mute и связь уровня. Сохранить проект.
3. Импортировать v2 в копию этого проекта через Layout Reconciliation с сохранением конфигурации.
4. Подтвердить: Music с ID 8101 сохранил действие и feedback при новом оформлении; уровень 8102 сохранил настройку; удалённый Mute 8103 не привязался к Extra 8104; Extra требует отдельной настройки. Проверить сохранение и повторное открытие проекта GCP.

Автоматически подтверждены назначение ID, два EXUI, два GDL и независимое чтение NRBF для обеих панелей. Figma API/рендер в этом сценарии моделируются. Для 1025M обе версии прошли новый GUI Designer Build с 0 ошибок/0 предупреждений; выполнены назначения кнопок → импорт v2 с сохранением конфигурации → сохранение и повторное открытие GCP. Остались связь уровня, GUI/GCP-цикл 300M и оборудование. Ручные правки старого GDL экспортёр не объединяет с новым дизайном.

---

<a id="english"></a>

# Updating the design after GCP is configured

[Русский](#russian) · **English**

CLI **0.8.3**, plugin **0.8.3**, EXUI/5. Package comparison and the selective GDL update work without Figma and without donors.

The main rule: GCP button settings (Press, Release, Visual and Text Feedback) are tied to the **button ID**. They are kept as long as the button in the new GDL has the same ID and the import keeps the existing configuration. If the programmer added pages or buttons directly in GUI Designer, do not import the GDL from Figma; import the **working GDL with the new artwork transferred** — see the [selective update](#selective-update-of-the-working-gdl).

## Save the working version

After the first agreed export, keep together the source Figma layout with its assignments, the `.exui`, the GDL after Save and Build, the `id-map` and the GCP project (`.gcplus`/`.gcpro`). The working EXUI is the baseline for comparison with the interface the logic is actually configured for. A GDL alone does not replace this baseline: the command compares EXUI/5 packages.

For history, keep separate versions such as `interface-v1.exui`, `interface-v2.exui`. The report includes the SHA-256 of both packages. The command does not build an automatic history of all assignments and does not read the GCP project. To see the effect on the installed system, compare the new export with its working version, even if there were intermediate exports in between.

## Make changes in Figma

- Change the artwork of an existing button layer: size, position, caption, color and icon. Its objectId, controlId and saved state IDs are not reassigned because of cosmetic edits.
- New and copied buttons get their own IDs. The counters reserve automatically issued numbers that were deleted in the source Figma project. The counters have no full history of manual IDs.
- Deleting a layer and recreating a similar one does not keep its identity. Do not give the old ID to a new function just to silence a warning.
- Renaming changes the automatic semantic key and keeps the numeric IDs. Renaming a page or popup may affect commands that refer to it by name.
- Changing the type, states, press feedback, slider range or navigation target needs a check by the programmer, even if the controlId is kept.
- Keep the plugin ID in the manifest: Figma stores the assignments under it.

## Compare the old and new export

In PowerShell in the unpacked CLI folder:

```powershell
.\ExtronExporter.ps1 compare-packages .\interface-v1.exui .\interface-v2.exui | Out-File -Encoding utf8 .\changes-v1-v2.md
```

Machine-readable report:

```powershell
.\ExtronExporter.ps1 compare-packages .\interface-v1.exui .\interface-v2.exui --json | Out-File -Encoding utf8 .\changes-v1-v2.json
```

Do not give one of the source packages as the redirect target: `Out-File` belongs to PowerShell and may overwrite the chosen file. The command itself only reads the packages; it checks the ZIP, schemas, IDs, links and PNGs before comparing. If either package is damaged, no report is produced.

The report covers pages, popups, groups, control and passive elements. Unchanged elements are counted in Markdown and listed in full in JSON.

| Level | Meaning | What to do |
|---|---|---|
| `info` | Artwork, caption, geometry or key changed; no change of addressing was found in this change | Check the look and the actual assignment of the button |
| `review` | New element, name, objectId, container, stacking order, range, navigation, behavior or popup link | Compare with the existing GCP settings; assign functions to new control elements |
| `breaking` | Element removed, controlId/type changed, state structure/press feedback or profile changed, or a possible ID reuse | Check and fix the affected assignments before updating the working system |

Matching goes by key first, then by object ID within the container, then by controlId. The last case is marked as a possible ID replacement or swap and always needs a check. Matching identifiers do not prove that the designer kept the meaning of the button.

Report fields: `schema: exui-comparison/1`, `before`/`after` snapshots with SHA-256 and profile, `projectChanges`, `items`, `requiresReview`, `gcpVerified: false`. Each element lists old/new names, keys, containers, objectId/controlId, the matching method and the changes. The order of states is compared by explicit stateId, and PNGs by content, without temporary file paths. `changes[].before/after` values are strings; for ordinary fields this is the JSON form of the value, for explanatory events it is text.

Exit code `0` means the comparison succeeded, including when there are `breaking` changes. Code `1` is a read/validation error; `2` means invalid arguments. For automation, read `requiresReview` and the change levels instead of treating code `0` as permission to update.

## Selective update of the working GDL

This is the main path if the project has pages, popups or buttons created manually in GUI Designer. A full GDL from Figma does not contain them: on import they would disappear together with their logic, and commands that refer to them would lose their target.

The **working GDL** is the one currently imported into the GCP project, including the programmer's manual edits, as a file **saved by GUI Designer** (Save and Build). Keep it next to the project; after every update the new file becomes the working one. If the CLI reports `Missing KP end record or invalid archive comment length`, the file was not written by GUI Designer (GUI Designer swaps the archive signature: `KP` instead of the usual `PK`): take the programmer's original GDL.

Run the commands below in PowerShell in the unpacked CLI folder. The `if ($LASTEXITCODE) { throw … }` lines stop on a CLI error: without them PowerShell would continue with the next command.

1. Export the `.exui` from Figma and create a GDL from it with the usual `convert-package`, for example `figma-new.gdl`.
2. Build the plan. It lists all buttons of the working GDL; `canUpdate: true` means a button with the same ID was found in the new export and its artwork can be transferred without changing the ID, name or behavior. For the others, `reason` gives the cause.

   ```powershell
   .\ExtronExporter.ps1 plan-layout-update .\working.gdl .\figma-new.gdl | Out-File -Encoding utf8 .\plan.json
   if ($LASTEXITCODE) { throw 'plan-layout-update failed, see ERROR above' }
   $plan = Get-Content -Raw .\plan.json | ConvertFrom-Json
   $plan.items | Where-Object canUpdate | Format-Table controlId, page, name, beforeCaption, afterCaption
   ```

3. Save the selection. All available buttons:

   ```powershell
   $ids = @($plan.items | Where-Object canUpdate | ForEach-Object controlId)
   ```

   or only the ones you need: `$ids = @(9166, 9140, 9153)`. Then:

   ```powershell
   @{ schema = 'exui-layout-selection/1'; baseSha256 = $plan.baseSha256; sourceSha256 = $plan.sourceSha256; controlIds = $ids; includeGeometry = $false } | ConvertTo-Json | Out-File -Encoding utf8 .\selection.json
   ```

   `includeGeometry = $true` also transfers the position and size of the selected buttons; by default only the artwork changes.
4. Apply the selection to a **new** file (an existing file is never overwritten):

   ```powershell
   .\ExtronExporter.ps1 update-layout .\working.gdl .\figma-new.gdl .\selection.json .\working-v2.gdl
   if ($LASTEXITCODE) { throw 'update-layout failed, see ERROR above' }
   ```

   The command checks that all unselected elements, pages and popups stayed unchanged, and stops if the hash of the working GDL or of the export does not match the plan.
5. Open `working-v2.gdl` in GUI Designer → Verify → Save and Build. Then import it into a copy of the GCP project following the [next section](#update-a-copy-of-the-gcp-project).

Buttons that are not `canUpdate` in the plan are not updated this way: new buttons from Figma, buttons with a changed ID and buttons with incompatible states. To keep IDs, edit the existing button layers in Figma instead of recreating them.

When building from source, the same is available in the `src/updater` window ("Figma → Extron — обновление оформления GDL", GDL artwork update) with a "current / new" preview. This tool is not part of the release archives.

Checked on a real project: [selective update in a GCP copy](verification/results/2026-10-25-gcp-selected-update.md) (in Russian) — the commands, Text and Visual Feedback of the updated buttons were kept, and the manual pages stayed in place.

## Update a copy of the GCP project

1. Create a new GDL from the new EXUI or update the working GDL selectively (see above). Check it in GUI Designer: Verify → Save and Build → reopen. Build remains a regular user action.
2. Open a **copy of the existing GCP project**. Select the touch panel → **User Interfaces** → **Import layout** and choose the new GDL.
3. In **Layout Reconciliation**, choose the option that keeps the existing configuration (`Import new layout and keep existing…`; the exact wording depends on the context). Review matched and missing objects; turn on **Show only conflicts** if needed. If you see unexpected matches, cancel the import and fix the cause.
4. Check the actions and visual feedback of existing buttons. Assign logic to added control elements; fix references to removed elements. Check commands that show pages/popups, especially after renaming.
5. Save the test configuration as a separate version. Confirm buttons, holds, levels and feedback on the system before updating the working installation.

Import and Layout Reconciliation are described in the installed help: **GCP → Configuration Palette → User Interfaces → Importing a layout / Layout Reconciliation**. On 23 Oct 2026 this was also checked on a pair of exported GDLs for TLP Pro 1025M in GCP Plus 3.34.1.4: the Music action and visual feedback were kept, Mute was shown as Missing, and the new Extra did not get its action. Saving and reopening GCP worked. [Actual report and limits](verification/results/2026-10-23-gcp-layout-update.md) (in Russian). Do not transfer settings by deleting the panel and adding it again.

## Control scenario and remaining coverage

The pairs `tlp-pro-1025m-v1.gdl` / `tlp-pro-1025m-v2.gdl` and the matching 300M pair are prepared in `output/update-workflow/` after running the integration scenario. For each panel:

1. Run Verify and Save and Build on both versions in GUI Designer and record the result.
2. Import v1 into a separate local GCP project. Configure the action and visual feedback of the Music button, the action of the Mute button and the level link. Save the project.
3. Import v2 into a copy of this project through Layout Reconciliation, keeping the configuration.
4. Confirm: Music with ID 8101 kept its action and feedback with the new artwork; level 8102 kept its setting; the removed Mute 8103 did not attach to Extra 8104; Extra needs its own setup. Check saving and reopening the GCP project.

Automatically confirmed: ID assignment, two EXUIs, two GDLs and an independent NRBF read for both panels. The Figma API and rendering are simulated in this scenario. For 1025M, both versions passed a new GUI Designer Build with 0 errors/0 warnings; button assignments → v2 import keeping the configuration → saving and reopening GCP were done. Still open: the level link, the GUI/GCP cycle for 300M, and hardware. The exporter does not merge manual edits of the old GDL with the new design.

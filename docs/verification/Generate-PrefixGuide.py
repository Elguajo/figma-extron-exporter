"""Build the four-page Russian prefix map with practical usage examples.

Run with Python + ReportLab. Optional first argument: output PDF.
Reviewed against PREFIXES.md, BUTTON_STATES.md, NATIVE_TEXT.md, AUTHORING_STANDARD.md, recognize.ts.
"""
from pathlib import Path
import html
import json
import re
import sys
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import SimpleDocTemplate, Paragraph, Table, TableStyle, Spacer, PageBreak

ROOT = Path(__file__).resolve().parents[1]
TARGET = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'output/pdf/figma-extron-prefix-cheatsheet.pdf'
PACKAGE = json.loads((ROOT / 'src/figma-plugin/package.json').read_text(encoding='utf-8'))
VERSION, CLI_VERSION, DATE = PACKAGE['version'], PACKAGE['compatibleCliVersion'], '22.10.2026'
PAGE_W, PAGE_H = landscape(A4)
MARGIN = 32
WIDTH = PAGE_W - 2 * MARGIN
INK, MUTED = colors.HexColor('#182025'), colors.HexColor('#566169')
ACCENT, PALE, LINE = colors.HexColor('#D65A08'), colors.HexColor('#F3F5F6'), colors.HexColor('#DCE1E4')
for name, filename in [('Guide', 'arial.ttf'), ('GuideBold', 'arialbd.ttf'), ('GuideCode', 'consola.ttf')]:
    pdfmetrics.registerFont(TTFont(name, str(Path('C:/Windows/Fonts') / filename)))
pdfmetrics.registerFontFamily('Guide', normal='Guide', bold='GuideBold')
STYLES = {
    'section': ParagraphStyle('section', fontName='GuideBold', fontSize=11, leading=14, textColor=INK, spaceBefore=10, spaceAfter=6),
    'cell': ParagraphStyle('cell', fontName='Guide', fontSize=9.1, leading=12, textColor=INK),
    'head': ParagraphStyle('head', fontName='GuideBold', fontSize=8.2, leading=10.5, textColor=colors.white),
    'note': ParagraphStyle('note', fontName='Guide', fontSize=8.5, leading=11.5, textColor=MUTED),
    'card': ParagraphStyle('card', fontName='Guide', fontSize=9, leading=12, textColor=INK),
}

def rich(value):
    value = html.escape(re.sub('[\u2010-\u2015\u2212]', '-', value))
    value = re.sub(r'`([^`]+)`', r'<font name="GuideCode" size="8.6">\1</font>', value)
    value = re.sub(r'\*\*([^*]+)\*\*', r'<b>\1</b>', value)
    return value.replace('\n', '<br/>')

def p(value, style='cell'):
    return Paragraph(rich(value), STYLES[style])

def table(headers, rows, widths):
    data = [[p(s, 'head') for s in headers]] + [[p(s) for s in row] for row in rows]
    result = Table(data, colWidths=widths, repeatRows=1, hAlign='LEFT')
    result.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), INK), ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 8), ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 4), ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [PALE, colors.white]),
        ('LINEBELOW', (0, 1), (-1, -1), 0.35, LINE),
    ]))
    return result

STRUCTURE = [
    ('Проект', '`prj_` / `project_`', '`project_Trilliant`: внешний Frame; внутри экраны и popup. Секция проекта может иметь любое имя.'),
    ('Экран', '`scr_` / `screen_`\nили `Home`', '`screen_Main`: Frame 1280x800 (1025M) или 320x480 (300M portrait).'),
    ('Popup', '`pop_` / `popup_`', '`popup_Sources`: Frame своего размера с элементами. На странице нужен popupref такого же размера.'),
    ('Модальный popup', '`mdl_` / `modalpopup_`', '`modalpopup_Confirm`: Frame размером с панель, вне группы popup.'),
    ('Группа popup', '`pgrp_` / `popupgroup_`', '`popupgroup_Zones`: Frame с обычными popup одинакового размера.'),
    ('Место popup', '`pr_` / `popupref_`', '`popupref_Sources`: пустой Frame внутри экрана; цель popup или группы выбирается по имени и сохраняется явно.'),
]
CONTROLS = [
    ('Кнопка', '`btn_` / `button_`', '`button_Power`: **Off / On**. Для нажатия и удержания: **Normal / Pressed**.'),
    ('Кнопка с feedback', '`fbtn_` / `feedbackbutton_`', '`feedbackbutton_Mute`: **Normal / Active / Pressed**. Group или Frame.'),
    ('Кастомный Slider', '`sld_` / `slider_`', '`slider_Volume`: Frame без фона; внутри **Track, Fill, Thumb**.'),
    ('Простой регулятор', '`lvl_` / `level_`', '`level_Volume`: пустой Frame с SOLID-заливкой; PBLevel Slider.'),
    ('Уровень сигнала', '`gau_` / `gauge_`', '`gauge_Signal`: пустой Frame с SOLID-заливкой; PBLevel Gauge.'),
    ('Индикатор', '`ind_` / `indicator_`', '`indicator_Status`: тот же числовой Gauge; отдельную лампу не создаёт.'),
    ('LED-шкала', '`led_` / `volumeled_`', '`volumeled_Audio`: пустой Frame с заливкой; PBLevel VolumeLED.'),
    ('Несколько видов', '`mlvl_` / `multilevel_`', '`multilevel_Status`: Frame без фона, внутри 2-8 состояний; normal первым, без Pressed.'),
]
GRAPHICS = [
    ('Статичный текст', '`txt_` / `text_`', '`text_Title`: Text Arial Regular/Bold, Inter / Inter Display; Label или PNG.'),
    ('Обновляемый текст', '`val_` / `value_`', '`value_VolumeValue`: Text с начальным «42%»; собственный controlId, обновляет программа.'),
    ('Дата / время', '`dt_` / `datetime_`', '`datetime_Clock`: компонент из Extron Kit, формат - свойство **Format** (28 форматов GUI Designer). Или Text-пример **September 28, 12:00 AM**, или Text с форматом `HH:mm`. Свой формат: Text-слой `Pattern: dddd, d MMMM`.'),
    ('Логотип', '`logo_`', '`logo_Company`: Frame с графикой; PNG / PBImage, без controlId и нажатий.'),
    ('Картинка', '`img_` / `image_`', '`image_Photo`: Frame с графикой; PNG / PBImage. Фон `image_Background`: Clip content у экрана обрезает выступы.'),
    ('Иконка состояния', '`Icon`, `ico_` / `icon_`', '`icon_Music`: Frame внутри состояния; часть его PNG, а не отдельная кнопка.'),
    ('Фигура', '`shp_` / `shape_`', '`shape_Card`: пустой Frame, Rectangle или Ellipse; SOLID, единое скругление, Stroke INSIDE.'),
    ('Линия', '`ln_` / `line_`', '`line_Divider`: Line / Vector: горизонталь/вертикаль, SOLID Stroke CENTER, Uniform.'),
]
STATES = [
    ('Включение или выбор', '**Off / On**', '`button_Power`, `button_Zone`: On задаёт программа управления.'),
    ('Нажатие и удержание', '**Normal / Pressed**', '`button_VolumeUp`, `button_VolumeDown`: Pressed виден во время удержания.'),
    ('Выбор с видом нажатия', '**Normal / Active / Pressed**', '`feedbackbutton_Mute`: Active от программы; Pressed во время удержания.'),
]

USAGE = {
    'project_Trilliant': 'Весь AV-интерфейс с экранами залов.',
    'screen_Main': 'Главный экран выбора Hall / Terrace.',
    'popup_Sources': 'Меню источников HDMI / Bluetooth.',
    'modalpopup_Confirm': 'Подтверждение «Выключить систему?»',
    'popupgroup_Zones': 'Панели Hall / Terrace в одной области.',
    'popupref_Sources': 'Область показа меню источников.',
    'button_Power': 'Включить / выключить питание.',
    'feedbackbutton_Mute': 'Mute с отдельным видом нажатия.',
    'slider_Volume': 'Менять громкость бегунком.',
    'level_Volume': 'Простой регулятор громкости.',
    'gauge_Signal': 'Показывать уровень аудиосигнала.',
    'indicator_Status': 'Показ числового уровня без ввода.',
    'volumeled_Audio': 'Сегментная шкала аудиоуровня.',
    'multilevel_Status': 'Виды «Нет связи» / «Готов» / «Ошибка».',
    'text_Title': 'Заголовок «Hall», подпись «Громкость».',
    'value_VolumeValue': 'Обновлять текущие «42%» громкости.',
    'datetime_Clock': 'Часы в шапке главного экрана.',
    'logo_Company': 'Логотип Trilliant в шапке экрана.',
    'image_Photo': 'Фото зала или статичная обложка.',
    'icon_Music': 'Нота внутри кнопки выбора Music.',
    'shape_Card': 'Фоновая плашка аудиоблока.',
    'line_Divider': 'Разделитель блоков Hall / Terrace.',
}

def chrome(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(ACCENT)
    canvas.rect(MARGIN, PAGE_H - 34, 26, 3, fill=1, stroke=0)
    canvas.setFillColor(INK)
    canvas.setFont('GuideBold', 20)
    canvas.drawString(MARGIN, PAGE_H - 59, 'Figma > Extron / Prefix Map Cheat Sheet')
    canvas.setFont('Guide', 8.4)
    canvas.setFillColor(MUTED)
    canvas.drawRightString(PAGE_W - MARGIN, PAGE_H - 36, f'Плагин {VERSION} + CLI {CLI_VERSION}  |  EXUI/5')
    canvas.drawRightString(PAGE_W - MARGIN, PAGE_H - 49, DATE)
    canvas.setStrokeColor(LINE)
    canvas.line(MARGIN, 30, PAGE_W - MARGIN, 30)
    canvas.setFont('Guide', 7.5)
    canvas.drawString(MARGIN, 18, 'TRILLIANT  /  Короткие и полные префиксы равнозначны. Регистр букв не важен.')
    canvas.drawRightString(PAGE_W - MARGIN, 18, f'{doc.page} / 4')
    canvas.restoreState()

story = []
headers = ['ЭЛЕМЕНТ', 'КОРОТКОЕ / ПОЛНОЕ ИМЯ', 'ПРИМЕР ПРИМЕНЕНИЯ', 'КАК ПОДГОТОВИТЬ']
widths = [108, 163, 224, WIDTH - 495]

def prefix_table(rows):
    # Keep an explicit example column, separate from the preparation rule.
    expanded = []
    for entity, prefix, description in rows:
        example, preparation = description.split(': ', 1)
        usage = USAGE[example.strip('`')]
        expanded.append((entity, prefix, example + '\n' + usage, preparation))
    return table(headers, expanded, widths)

story.append(p('01 / Структура проекта', 'section'))
story.append(prefix_table(STRUCTURE))
story.append(Spacer(1, 7))
story.append(p('Элементы размещайте непосредственно в Frame экрана / popup. Несколько экранов можно выделить вместе и экспортировать одним проектом; project_ или секция для этого не обязательны.', 'note'))
story.append(p('Фон и обводка самих Frame popup / modalpopup / popupref по умолчанию не переносятся (прозрачные); радиусы и Opacity Frame игнорируются. Красные рамки-ориентиры можно оставить. Нужен фон или обводка - флажки «Экспортировать фон / обводку Frame» в форме.', 'note'))
story.append(p('02 / Как устроены popup', 'section'))
story.append(table(['СЦЕНАРИЙ', 'ГДЕ РАСПОЛОЖИТЬ', 'ЧТО СВЯЗАТЬ'], [
    ('Одно меню источников', '`popup_Sources` - рядом с экраном в проекте; `popupref_Sources` - внутри экрана.', 'Выберите popupref > «Содержимое места popup» > popup по имени > «Сохранить связь popup».'),
    ('Панели Hall / Terrace в одном месте', '`popup_Hall` и `popup_Terrace` внутри `popupgroup_Zones`. Оба размера совпадают с popupref.', 'У popupref выберите готовую группу. Для новой группы выделите все popup > «Размещение popup» > место > «Связать с местом popup».'),
    ('Полноэкранное подтверждение', '`modalpopup_Confirm` - в проекте, вне popupgroup, размером с панель.', 'Отдельный popupref не нужен: ссылки создаёт Build. Показ вызывает программа Extron.'),
], [145, 285, WIDTH - 430]))
story.append(Spacer(1, 7))
story.append(p('Место popup можно сохранить без цели как черновик, но до экспорта его нужно связать. «Без связи» > «Сохранить связь popup» снимает привязку; исходные Frame остаются на месте. Popupref внутри popup не поддержан.', 'note'))
story.append(p('Имена: `button_Power`, `button_side.hall`, `screen_01-Main`. После префикса - латинская буква; далее латиница, цифры, точки и дефисы между непустыми частями. Без пробелов, второго `_` и русских букв. Видимый текст может быть русским.', 'note'))
cards = [
    '**Button Styles / подготовка**\n'
    '1. Вне экранов: Group или Frame **Button Styles**, внутри Rectangle **Off** и **On** с разным оформлением.\n'
    '2. Дизайн кнопки: Group / Frame `button_Power`. Выберите экран > «Применить оформление». Для готовых кнопок явно выберите пропуск или обновление.\n'
    '3. `button_` > Off / On; `feedbackbutton_` > Normal / Active. **Pressed добавьте вручную**; Normal / Pressed подготовьте вручную.\n'
    'Переносятся заливка и обводка фона; скругление - по настройке. Иконки, подписи, Pressed и ID сохраняются.',
    '**Имена / экспорт**\n'
    'После префикса: латинская буква, затем латиница, цифры, точки и дефисы между непустыми частями. Без пробелов и второго `_`. Пример: `button_side.hall`. **Русские буквы в именах слоёв - ошибка**; видимый текст может быть русским.\n'
    'Ключи следуют именам слоёв, ID не меняются. Стартовая страница всегда первая в GDL; остальные идут по именам: `screen_01-Main`, `screen_02-Audio`.\n'
    'Экран > профиль панели > «Проверить макет» > «Скачать .exui». Ключи и ID назначаются автоматически.\n'
    'Нативные координаты и размеры округляются: 218.21 > 218, 218.7 > 219. Исходный макет не меняется.\n'
    '**AV-команды, feedback и переходы выполняет программа Extron.**\n'
    'На 1025M / 300M недоступны: `vid_` / `video_`, `dimg_` / `dynamicimage_`.',
]
card_table = Table([[p(s, 'card') for s in cards]], colWidths=[WIDTH / 2, WIDTH / 2])
card_table.setStyle(TableStyle([
    ('BACKGROUND', (0, 0), (-1, -1), PALE), ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ('LEFTPADDING', (0, 0), (-1, -1), 10), ('RIGHTPADDING', (0, 0), (-1, -1), 10),
    ('TOPPADDING', (0, 0), (-1, -1), 8), ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
    ('LINEBEFORE', (1, 0), (1, 0), 6, colors.white),
]))
story.append(PageBreak())
story.append(p('03 / Кнопки, регуляторы и индикаторы', 'section'))
story.append(prefix_table(CONTROLS))
story.append(p('04 / Три схемы кнопок для новых макетов', 'section'))
story.append(table(['ПОВЕДЕНИЕ', 'СОСТОЯНИЯ', 'ПРИМЕР'], STATES, [145, 190, WIDTH - 335]))
story.append(Spacer(1, 7))
story.append(p('Совместимость: Passive / Active, Normal / Active без Pressed и прежние поддержанные синонимы сохраняются. Off / Normal / Passive - одна роль; On / Active / Feedback - другая. Одну роль внутри кнопки не дублировать. `st_` / `state_` - префиксы состояний; например, `state_Pressed`.', 'note'))
story.append(PageBreak())
story.append(p('05 / Текст и графика', 'section'))
story.append(prefix_table(GRAPHICS))
story.append(p('06 / Пример: блок громкости Hall', 'section'))
story.append(table(['СЛОЙ ВНУТРИ ЭКРАНА', 'ЧТО ВИДИТ ПОЛЬЗОВАТЕЛЬ', 'КАК СВЯЗАТЬ'], [
    ('`button_HallVolumeDown`\n`button_HallVolumeUp`', 'Кнопки «-» / «+» со схемой Normal / Pressed.', 'Шаг изменения и повтор при удержании задаёт программа Extron.'),
    ('`slider_HallVolume`\n`value_HallVolumeValue`', 'Ползунок и отдельный текущий процент «42%».', 'Программа обновляет и позицию Slider, и текст Value. Связь по имени не создаётся.'),
    ('`button_HallMute`', 'Off / On: видно, включено ли заглушение.', 'Программа отправляет команду Mute и возвращает feedback для On.'),
], [215, 250, WIDTH - 465]))
story.append(PageBreak())
story.append(p('07 / Подготовка кнопок и правила экспорта', 'section'))
story.append(card_table)
story.append(p('08 / Назначения по именам в плагине 0.6.5', 'section'))
story.append(table(['ЗАДАЧА', 'ДЕЙСТВИЯ В ПЛАГИНЕ', 'РЕЗУЛЬТАТ'], [
    ('Стартовый экран', 'Выберите проект / экран > «Запуск проекта» > «При запуске открыть» > экран по имени > «Сохранить стартовую страницу».', 'Одна стартовая страница; прежняя становится обычной. В GDL стартовая всегда первая.'),
    ('Группа выбора источников', 'Выделите 2+ кнопки одного экрана или popup > «Группа выбора кнопок» > «Создать группу из выделенных кнопок» > «Сохранить группу выбора».', 'Группа - указание в карте ID для программы Extron; ключ создаётся сам. Выберите готовую группу для добавления, «Без группы» - для снятия назначения.'),
    ('Переход с кнопки', 'В назначении кнопки выберите «Открыть страницу или popup» > цель по имени > «Сохранить назначение». «Показать цель в Figma» помогает найти цель.', 'Указание попадает в карту ID. Переход и feedback реализует программа Extron; Prototype interactions Figma не экспортируются.'),
], [145, 355, WIDTH - 500]))
story.append(Spacer(1, 6))
story.append(p('**Выбор в списке сам по себе ничего не сохраняет.** Нажимайте соответствующую кнопку сохранения. Назначения и связи восстанавливаются после перезапуска плагина.', 'note'))
story.append(p('09 / Перед передачей', 'section'))
story.append(p('Профиль и размеры > состояния кнопок > связи popup > одна стартовая страница > «Проверить макет» > «Скачать .exui» > CLI: `validate-package`, `convert-package`, `id-map` > проверка нового GDL в GUI Designer и на панели.', 'card'))
story.append(Spacer(1, 6))
story.append(p('Основа: AUTHORING_STANDARD.md, PREFIXES.md, BUTTON_STATES.md, NATIVE_TEXT.md; правила распознавания - recognize.ts. Актуальные связи - выпуск плагина 0.6.5. Справочники находятся в src/figma-plugin/ репозитория.', 'note'))
TARGET.parent.mkdir(parents=True, exist_ok=True)
doc = SimpleDocTemplate(str(TARGET), pagesize=(PAGE_W, PAGE_H), leftMargin=MARGIN,
                        rightMargin=MARGIN, topMargin=70, bottomMargin=39,
                        title=f'Figma > Extron / Prefix Map Cheat Sheet {VERSION}',
                        author='Trilliant / Figma > Extron Exporter',
                        subject='Префиксы Figma, состояния кнопок и подготовка к экспорту EXUI/5')
doc.build(story, onFirstPage=chrome, onLaterPages=chrome)
print(str(TARGET.resolve()).encode('ascii', errors='backslashreplace').decode('ascii'))

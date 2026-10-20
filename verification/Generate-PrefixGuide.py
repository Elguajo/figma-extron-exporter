"""Render the reviewed three-column designer reference as a Russian PDF.

Run with Python + reportlab from the repository root. Source content remains in
docs/figma-prefix-reference.md. Fonts are embedded from the local Windows install.
"""
from pathlib import Path
import html
import re
import sys
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import SimpleDocTemplate, Paragraph, Table, TableStyle, Spacer, PageBreak, KeepTogether

ROOT = Path(__file__).resolve().parents[1]
target = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'output/pdf/figma-extron-prefixes-0.2.0.pdf'
target.parent.mkdir(parents=True, exist_ok=True)
source = (ROOT / 'docs/figma-prefix-reference.md').read_text(encoding='utf-8')
for name, filename in [('Guide', 'arial.ttf'), ('GuideBold', 'arialbd.ttf'), ('GuideCode', 'consola.ttf')]:
    pdfmetrics.registerFont(TTFont(name, str(Path('C:/Windows/Fonts') / filename)))
pdfmetrics.registerFontFamily('Guide', normal='Guide', bold='GuideBold')

ink, muted, blue = colors.HexColor('#172330'), colors.HexColor('#52616F'), colors.HexColor('#146B98')
styles = {
    'title': ParagraphStyle('title', fontName='GuideBold', fontSize=21, leading=26, textColor=ink, spaceAfter=8),
    'intro': ParagraphStyle('intro', fontName='Guide', fontSize=9.6, leading=13, textColor=muted),
    'cell': ParagraphStyle('cell', fontName='Guide', fontSize=9.3, leading=12.6, textColor=ink),
    'entity': ParagraphStyle('entity', fontName='Guide', fontSize=9.3, leading=13, textColor=ink),
    'head': ParagraphStyle('head', fontName='GuideBold', fontSize=9.6, leading=12.8, textColor=colors.white),
    'note': ParagraphStyle('note', fontName='Guide', fontSize=8.7, leading=11.8, textColor=muted),
}

def clean(value):
    return value.replace('\u2011', '-').replace('\u2013', '-').replace('\u2014', '-')

def rich(value):
    value = html.escape(clean(value))
    return re.sub(r'`([^`]+)`', r'<font name="GuideCode" size="8.7">\1</font>', value)

sections = []
for block in re.split(r'^## ', source, flags=re.M)[1:]:
    title = block.splitlines()[0]
    rows = []
    for line in block.splitlines()[1:]:
        if not line.startswith('|') or line.startswith('|---'):
            continue
        cells = [part.strip() for part in line.strip('|').split('|')]
        if cells[0] == 'Сущность':
            continue
        assert len(cells) == 3
        rows.append(cells)
    sections.append((title, rows))
assert len(sections) == 4 and sum(len(rows) for _, rows in sections) == 30

page_w, page_h = landscape(A4)
doc = SimpleDocTemplate(str(target), pagesize=(page_w,page_h), leftMargin=36, rightMargin=36,
                        topMargin=32, bottomMargin=36, title='Figma > Extron - таблица префиксов 0.2.0',
                        author='Trilliant / Figma > Extron Exporter')
headers = ['Сущность', 'Для чего нужна в твоём проекте', 'Что у нас сейчас / что добавить']
story = []
for index, (title, rows) in enumerate(sections):
    if index:
        story.append(PageBreak())
    story.append(Paragraph('Figma &gt; Extron: таблица префиксов', styles['title']))
    story.append(Paragraph(f'<b>{html.escape(title)}</b> &nbsp; | &nbsp; Плагин 0.2.0 &nbsp; | &nbsp; 20.10.2026', styles['intro']))
    story.append(Spacer(1, 12))
    table_rows = [[Paragraph(h, styles['head']) for h in headers]]
    for cells in rows:
        table_rows.append([Paragraph(rich(cell), styles['entity' if col == 0 else 'cell']) for col,cell in enumerate(cells)])
    table = Table(table_rows, colWidths=[215, 229, page_w-72-215-229], repeatRows=1, hAlign='LEFT')
    table.setStyle(TableStyle([
        ('BACKGROUND',(0,0),(-1,0),blue), ('VALIGN',(0,0),(-1,-1),'TOP'),
        ('LEFTPADDING',(0,0),(-1,-1),9), ('RIGHTPADDING',(0,0),(-1,-1),9),
        ('TOPPADDING',(0,0),(-1,-1),8), ('BOTTOMPADDING',(0,0),(-1,-1),8),
        ('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.HexColor('#F1F5F8'),colors.white]),
        ('LINEBELOW',(0,0),(-1,0),0.8,blue), ('LINEBELOW',(0,1),(-1,-1),0.35,colors.HexColor('#DCE4EA')),
    ]))
    story.append(table)
    story.append(Spacer(1,10))
    notes = [
        'Один Frame страницы - один экран. Для общего экспорта выбрать project_Name. Страницы и popup сохраняют собственные ключи и ID. Переходы исполняет программа управления.',
        'Track/Fill/Thumb описывают внешний вид Slider. Положение бегунка в Figma - preview; начальное значение, шаг кнопок и обратную связь задаёт программа Extron.',
        'После префикса - уникальное имя на экране: slider_Volume и value_VolumeValue. Регистр не важен. Графика внутри logo_/image_/icon_ растрируется; нативные элементы остаются отдельными объектами.',
        'Новые функции требуют плагин 0.2.0 и текущий CLI с exui/5. Команды, feedback, доступность и видимость подключает программист. Наличие состояния Disabled само по себе не запрещает нажатия.',
    ]
    story.append(Paragraph(notes[index], styles['note']))

def footer(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(colors.HexColor('#DCE4EA'));canvas.setLineWidth(.5);canvas.line(36,28,page_w-36,28)
    canvas.setFont('Guide',7.6);canvas.setFillColor(muted)
    canvas.drawString(36,17,'Проверено автоматически. Настоящий Figma, GUI Designer/Build и оборудование версии 0.2.0 ещё не проверены.')
    canvas.drawRightString(page_w-36,17,f'{doc.page} / 4')
    canvas.restoreState()

doc.build(story,onFirstPage=footer,onLaterPages=footer)
print(target.resolve())

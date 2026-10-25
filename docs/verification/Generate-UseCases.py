"""Build the Russian task guide from the same data as the offline website.

Python + ReportLab. Optional first argument: output PDF.
"""
from pathlib import Path
import html
import json
import re
import sys
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Table, TableStyle, Spacer, PageBreak, KeepTogether,
)
from GuideVisuals import ButtonComposition

ROOT = Path(__file__).resolve().parents[2]
TARGET = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'docs/prefix_map/figma-extron-use-cases.pdf'
DATA = json.loads((ROOT / 'docs/prefix_map/guide-data.json').read_text(encoding='utf-8'))
PACKAGE = json.loads((ROOT / 'src/figma-plugin/package.json').read_text(encoding='utf-8'))
WIDTH = A4[0] - 84
PAGES = 2 + sum(len(case['pages']) for case in DATA['cases'])
INK, MUTED, BLUE = [colors.HexColor(s) for s in ('#182025', '#566169', '#0071E3')]
for name, filename in [('Guide', 'arial.ttf'), ('GuideBold', 'arialbd.ttf'), ('GuideCode', 'consola.ttf')]:
    pdfmetrics.registerFont(TTFont(name, str(Path('C:/Windows/Fonts') / filename)))
pdfmetrics.registerFontFamily('Guide', normal='Guide', bold='GuideBold')
STYLES = {
    'title': ParagraphStyle('title', fontName='GuideBold', fontSize=24, leading=28, textColor=INK, spaceAfter=12),
    'lead': ParagraphStyle('lead', fontName='Guide', fontSize=11, leading=15.5, textColor=MUTED, spaceAfter=12),
    'h2': ParagraphStyle('h2', fontName='GuideBold', fontSize=13, leading=17, textColor=INK, spaceBefore=12, spaceAfter=8),
    'body': ParagraphStyle('body', fontName='Guide', fontSize=10, leading=14, textColor=INK, spaceAfter=7),
    'step': ParagraphStyle('step', fontName='GuideBold', fontSize=10, leading=14, textColor=INK, spaceBefore=7, spaceAfter=3),
    'small': ParagraphStyle('small', fontName='Guide', fontSize=8.5, leading=11.5, textColor=MUTED, spaceAfter=6),
    'code': ParagraphStyle('code', fontName='GuideCode', fontSize=7.5, leading=10.5, textColor=INK),
    'toc': ParagraphStyle('toc', fontName='GuideBold', fontSize=10, leading=14, textColor=BLUE),
}


def clean(text):
    return re.sub('[\u2010-\u2015\u2212]', '-', text)


def p(text, style='body'):
    return Paragraph(html.escape(clean(text)).replace('\n', '<br/>'), STYLES[style])


def code(text):
    lines = text.splitlines()
    # Wrap long PowerShell commands with valid continuation characters.
    wrapped = []
    for line in lines:
        while len(line) > 93:
            cut = line.rfind(' ', 0, 91)
            if cut < 1:
                break
            wrapped.append(line[:cut] + ' `')
            line = '  ' + line[cut + 1:]
        wrapped.append(line)
    content = '<br/>'.join(html.escape(line).replace(' ', '&nbsp;') for line in wrapped)
    block = Table([[Paragraph(content, STYLES['code'])]], colWidths=[WIDTH])
    block.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#F3F5F7')),
        ('BOX', (0, 0), (-1, -1), .4, colors.HexColor('#DCE1E4')),
        ('LEFTPADDING', (0, 0), (-1, -1), 10), ('RIGHTPADDING', (0, 0), (-1, -1), 10),
        ('TOPPADDING', (0, 0), (-1, -1), 8), ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
    ]))
    return block


def note(text):
    block = Table([[p(text, 'small')]], colWidths=[WIDTH])
    block.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#EDF5FF')),
        ('LEFTPADDING', (0, 0), (-1, -1), 12), ('RIGHTPADDING', (0, 0), (-1, -1), 12),
        ('TOPPADDING', (0, 0), (-1, -1), 9), ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]))
    return block


def chrome(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(BLUE)
    canvas.rect(42, A4[1] - 34, 22, 3, fill=1, stroke=0)
    canvas.setFont('GuideBold', 9)
    canvas.drawString(72, A4[1] - 35, 'EXTRON KIT / ПРАКТИЧЕСКИЕ СЦЕНАРИИ')
    if doc.page == 1:
        canvas.bookmarkPage('contents')
    else:
        canvas.setFont('Guide', 8)
        canvas.drawRightString(A4[0] - 42, A4[1] - 35, 'К списку сценариев')
        canvas.linkRect('К списку сценариев', 'contents', (A4[0] - 137, A4[1] - 40, A4[0] - 42, A4[1] - 28), relative=0)
    canvas.setFillColor(MUTED)
    canvas.setFont('Guide', 8)
    canvas.drawString(42, 24, f"Плагин {PACKAGE['version']} + CLI {PACKAGE['compatibleCliVersion']} / EXUI/5 / {DATA['updated']}")
    canvas.drawRightString(A4[0] - 42, 24, f'{doc.page} / {PAGES}')
    canvas.setStrokeColor(colors.HexColor('#DCE1E4'))
    canvas.line(42, 40, A4[0] - 42, 40)
    canvas.restoreState()


story = [p('От макета до обновления системы', 'title'),
         p('Пять сценариев Figma > Extron с действиями дизайнера и программиста, командами CLI и проверкой результата.', 'lead')]
story.append(p('Выберите задачу', 'h2'))
page_number = 2
for case in DATA['cases']:
    story.append(Paragraph(f'<link href="#case-{case["id"]}" color="#0071E3">{case["number"]} / {html.escape(case["title"])}</link>  <font name="Guide" color="#566169">стр. {page_number}</font>', STYLES['toc']))
    story.append(Spacer(1, 7))
    page_number += len(case['pages'])
story.append(Paragraph(f'<link href="#layout" color="#0071E3">Текст и иконки: правила компоновки</link>  <font name="Guide" color="#566169">стр. {PAGES}</font>', STYLES['toc']))
story.append(p('Перед началом', 'h2'))
for i, line in enumerate(DATA['setup'], 1):
    story.append(p(f'{i}. {line}'))
story.append(code('.\\ExtronExporter.ps1 doctor'))
story.append(Spacer(1, 12))
story.append(note('Preview. Подтверждён программный путь до GDL и отдельные GUI/GCP-сценарии. Работа физических панелей, удержания и аппаратный feedback требуют отдельной проверки. Имена элементов не создают AV-логику.'))

for case in DATA['cases']:
    step_number = 0
    for index, page in enumerate(case['pages']):
        story.append(PageBreak())
        anchor = f'<a name="case-{case["id"]}"/>' if index == 0 else ''
        story.append(Paragraph(anchor + html.escape(f'{case["number"]} / {case["title"]}'), STYLES['title']))
        story.append(p(page['title'], 'lead'))
        if index == 0:
            story.append(p('Кто: ' + case['role'] + '. Вход: ' + case['input'], 'small'))
            story.append(p(case['goal']))
        for step in page['steps']:
            step_number += 1
            block = [p(f'{step_number:02d}. {step["title"]}', 'step'), p(step['text'])]
            if step.get('code'):
                block.extend([code(step['code']), Spacer(1, 3)])
            story.append(KeepTogether(block))
        story.append(Spacer(1, 10))
        story.append(note('Результат: ' + page['result']))

story.append(PageBreak())
story.append(Paragraph('<a name="layout"/>Текст по центру,<br/>иконка сбоку', STYLES['title']))
for line in DATA['layout']['facts']:
    story.append(p(line))
story.append(Spacer(1, 9))
story.append(ButtonComposition(WIDTH))
story.append(note(DATA['layout']['example']))
story.append(p('Проверка перед передачей', 'h2'))
for i, line in enumerate(DATA['layout']['checks'], 1):
    story.append(p(f'{i}. {line}'))
story.append(p('Основания и подробности', 'h2'))
story.append(p('Локальная веб-документация: docs/web/index.html. Шпаргалка рядом: figma-extron-prefix-cheatsheet.pdf. Подробности: src/figma-plugin/NATIVE_TEXT.md, docs/cli-setup.md, docs/updating-configured-projects.md. Проверка выравнивания: docs/verification/results/2026-10-25-button-text-auto.md и 2026-10-25-product-guides.md.', 'small'))

TARGET.parent.mkdir(parents=True, exist_ok=True)
doc = SimpleDocTemplate(str(TARGET), pagesize=A4, leftMargin=42, rightMargin=42,
                        topMargin=59, bottomMargin=55,
                        title='Extron Kit / Практические сценарии', author='Trilliant / Figma > Extron Exporter',
                        subject=f"Плагин {PACKAGE['version']} + CLI {PACKAGE['compatibleCliVersion']}; пять use case; текст и иконки")
doc.build(story, onFirstPage=chrome, onLaterPages=chrome)
print(str(TARGET.resolve()))

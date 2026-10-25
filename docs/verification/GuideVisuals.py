"""Shared vector examples for the printable product guides (no Figma mutations)."""
from reportlab.platypus import Flowable
from reportlab.lib import colors


class ButtonComposition(Flowable):
    def __init__(self, width):
        super().__init__()
        self.width, self.height = width, 125

    def draw(self):
        c = self.canv
        gap = 26
        cell = (self.width - gap) / 2
        for index, side in enumerate(('left', 'right')):
            x = index * (cell + gap)
            c.setFont('GuideBold', 9)
            c.setFillColor(colors.HexColor('#182025'))
            c.drawString(x, 110, 'Иконка слева' if side == 'left' else 'Иконка справа')
            c.saveState()
            c.translate(x, 29)
            c.scale(cell / 240, cell / 240)
            c.setFillColor(colors.HexColor('#E9EFF7'))
            c.roundRect(0, 0, 240, 64, 12, fill=1, stroke=0)
            c.setFillColor(colors.HexColor('#D8E5F7'))
            c.roundRect(52, 8, 136, 48, 5, fill=1, stroke=0)
            c.setStrokeColor(colors.HexColor('#0071E3'))
            c.setDash(2, 3)
            c.line(120, -3, 120, 67)
            c.setDash()
            c.setFillColor(colors.HexColor('#182025'))
            c.setFont('GuideBold', 15)
            c.drawCentredString(120, 27, 'BGM CH 1')
            c.setLineWidth(1.8)
            icon_x = 16 if side == 'left' else 200
            c.setStrokeColor(colors.HexColor('#182025'))
            c.roundRect(icon_x, 22, 24, 19, 3, fill=0, stroke=1)
            c.line(icon_x + 8, 18, icon_x + 16, 18)
            c.line(icon_x + 12, 18, icon_x + 12, 22)
            c.restoreState()
        c.setFillColor(colors.HexColor('#566169'))
        c.setFont('Guide', 8)
        c.drawString(0, 7, 'Пунктир - центр всей кнопки. Голубая область - пример резерва под текст.')

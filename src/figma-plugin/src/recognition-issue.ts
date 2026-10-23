import type { RecognitionIssue } from './model.ts';

// Keep the actual node identity: names such as Normal repeat across buttons.
export function recognitionIssue(node:SceneNode|PageNode,root:SceneNode|PageNode,error:unknown):RecognitionIssue {
  const message=error instanceof Error?error.message:String(error),code=(error as {code?:string})?.code;
  const parts:string[]=[];let current:BaseNode|null=node;
  while(current){parts.unshift(current.name);if(current.id===root.id)break;current=current.parent;}
  let fix='Исправьте указанное требование в Figma и нажмите «Повторить распознавание».';
  if(code==='popup-name-ambiguous')fix='Выберите это место popup. В «Содержимое места popup» укажите нужный popup или группу и нажмите «Сохранить связь popup». Затем повторите проверку проекта.';
  else if(code==='popup-ref'&&message.includes('не найдена в составе экспорта'))fix='Проверьте состав и область экспорта. Выберите группу popup → «Размещение popup» → нужное место → «Связать с местом popup». Затем повторите проверку проекта.';
  else if(code==='name'&&message.includes('поддерживаемый префикс'))fix='Назовите слой по его роли: ln_Divider — линия, shp_Background — фигура, txt_Title — текст. Декоративный рисунок поместите внутрь Frame logo_Name или img_Name. Примеры есть в справочнике ниже.';
  else if(code==='node-type'&&message.includes('состояние должно быть Frame'))fix='Оберните содержимое этого состояния в обычный Frame и оставьте имя состояния (например, Normal). Frame должен быть непосредственным дочерним слоем кнопки.';
  else if(code==='node-type'&&/^(logo|img|image)_/i.test(node.name))fix='Выделите рисунок и выполните Frame selection в Figma. Имя '+node.name+' задайте получившемуся Frame; векторные слои оставьте внутри него.';
  else if(code==='node-type')fix='Измените тип или структуру слоя согласно требованию выше. Группа (Group), вектор (Vector) и Frame — разные типы слоёв Figma; переименование не меняет тип.';
  else if(code==='button-background')fix='Выберите прямоугольник фона внутри этого состояния. В разделе «Оформление кнопок» откройте «Выбрать образцы и фон вручную» и нажмите «Выбранный слой — фон». Фон должен занимать всю кнопку. Затем повторите распознавание.';
  else if(code==='line-appearance')fix='В Stroke проверьте указанное свойство: Position — Center, профиль толщины — Uniform, один сплошной цвет без пунктира и кисти, окончания — None. Затем повторите проверку.';
  else if(code==='states'&&/состояние должно занимать (всю кнопку|весь Frame кнопки)/.test(message))fix='Нажмите «Показать слой»: будет выбрано конкретное состояние внутри кнопки. Сравните его положение и размер с родительской кнопкой. При экспорте координаты и размеры округляются до целых пикселей; границы состояния и кнопки после округления должны совпадать.';
  else if(code==='states')fix='Для новых макетов: button_ — Off / On для включения или выбора либо Normal / Pressed для нажатия; feedbackbutton_ — Normal / Active / Pressed для выбора с видом нажатия. Passive / Active и Normal / Active без Pressed также поддерживаются. Команда «Применить оформление» создаёт Off / On либо Normal / Active; Pressed добавьте вручную. Кнопки и состояния могут быть Group или Frame.';
  else if(code==='datetime-pattern')fix='Перетащите на экран datetime_Clock из Extron Kit (раздел «Дата и время») и выберите формат в свойстве Format. Либо оставьте свой текст, назвав Text-слой внутри компонента «Pattern: MMMM d, h:mm tt», либо выберите слой и задайте формат в поле «Формат даты/времени».';
  else if(code==='name')fix='Переименуйте слой по примеру в сообщении. Используйте латинские буквы, цифры, точки и дефисы; названия типов и состояний смотрите в справочнике ниже.';
  return {nodeId:node.id,nodeName:node.name,nodeType:node.type,path:parts.join(' → '),message:message.startsWith(node.name+': ')?message.slice(node.name.length+2):message,fix};
}

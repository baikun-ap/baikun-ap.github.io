/**
 * Listening midterm practice: 《汉语听力教程》 (3rd ed.) Book 1, lessons 6–8,
 * pages 22–36. The answer options are the book's, word for word. The book
 * does not print what is said on its recordings, so the spoken questions and
 * dialogues here are written for this site, each so that exactly the book's
 * intended kind of answer fits; the site's Chinese voice reads them.
 */

/** 听后选择合适的回答: hear a question, choose the fitting reply. */
export interface Reply { lesson: number; page: number; n: number; ask: string; ru: string; en: string; options: string[]; a: number[] }
const r = (lesson: number, page: number, n: number, ask: string, ru: string, en: string, a: string, options: string[]): Reply =>
  ({ lesson, page, n, ask, ru, en, options, a: [...a].map((x) => 'ABCD'.indexOf(x)) });

export const REPLIES: Reply[] = [
  // Lesson 6 · p. 24–25 (6-6)
  r(6, 24, 1, '玛丽是你妹妹吗？', 'Мэри — твоя младшая сестра?', 'Is Mary your younger sister?', 'C', ['玛丽（Mǎlì）不是姐姐。', '玛丽有妹妹。', '对，她是我妹妹。', '妹妹不是玛丽。']),
  r(6, 24, 2, '你爸爸好吗？', 'Как твой папа?', 'How is your dad?', 'C', ['他很忙。', '他太忙。', '他很好。', '他也忙。']),
  r(6, 24, 3, '他学汉语吗？', 'Он учит китайский?', 'Does he study Chinese?', 'C', ['他不学韩语。', '我哥哥学汉语。', '不，他学韩语。', '你弟弟学英语。']),
  r(6, 24, 4, '什么很难？', 'Что трудное?', 'What is hard?', 'D', ['太难。', '不太难。', '汉语很好。', '韩语很难。']),
  r(6, 24, 5, '她是女老师吗？', 'Она — учительница (женщина)?', 'Is she a female teacher?', 'A', ['对，她是女老师。', '她是我的老师。', '她是妹妹的老师。', '他是马老师。']),
  r(6, 24, 6, '谁是老师？', 'Кто учитель?', 'Who is the teacher?', 'A', ['他是。', '不是。', '不难。', '不太难。']),
  r(6, 25, 7, '你是法国人吗？', 'Ты француз?', 'Are you French?', 'C', ['是法语。', '是英语。', '我不是法国人。', '他是英国人。']),
  r(6, 25, 8, '你有几个哥哥？', 'Сколько у тебя старших братьев?', 'How many older brothers do you have?', 'D', ['我有弟弟。', '我是哥哥。', '我有哥哥。', '一个哥哥。']),
  r(6, 25, 9, '你妹妹忙吗？', 'Твоя сестра занята?', 'Is your younger sister busy?', 'C', ['她很好。', '你不好。', '她很忙。', '妹妹很好。']),
  r(6, 25, 10, '俄语难吗？', 'Русский трудный?', 'Is Russian hard?', 'C', ['英语不难。', '汉语很难。', '俄语很难。', '日语不太难。']),
  // Lesson 7 · p. 29 (7-6)
  r(7, 29, 1, '你星期几去？', 'В какой день недели ты пойдёшь?', 'Which day of the week are you going?', 'B', ['不去。', '星期二。', '今天去。', '我去学习。']),
  r(7, 29, 2, '谁去银行？', 'Кто идёт в банк?', 'Who is going to the bank?', 'B', ['她去银行。', '我姐姐去。', '她不去。', '今天去。']),
  r(7, 29, 3, '谁去取钱？', 'Кто пойдёт снять деньги?', 'Who is going to get the money?', 'D', ['不去银行。', '去邮局。', '他回学校。', '我去取。']),
  r(7, 29, 4, '他是你哥哥，对吗？', 'Он твой старший брат, верно?', 'He is your older brother, right?', 'BA', ['对。', '对，他是。', '去。', '不去。']),
  r(7, 29, 5, '你们回不回学校？', 'Вы вернётесь в школу или нет?', 'Are you going back to school or not?', 'D', ['你们回学校。', '他们回学校。', '我们去学校。', '我们不回。']),
  r(7, 29, 6, '你们学什么？', 'Что вы учите?', 'What do you study?', 'C', ['学。', '我弟弟学。', '我们学西班牙语。', '阿拉伯语很难。']),
  r(7, 29, 7, '有我的信吗？', 'Есть письмо для меня?', 'Is there a letter for me?', 'D', ['明天有。', '我有。', '有他的信。', '没有，有他的。']),
  r(7, 29, 8, '这是你的信吧？', 'Это ведь твоё письмо?', 'This is your letter, isn’t it?', 'C', ['我的信。', '有你的。', '对，谢谢！', '不，对不起。']),
  r(7, 29, 9, '今天星期几？', 'Какой сегодня день недели?', 'What day of the week is it today?', 'A', ['今天是星期五。', '明天是星期五。', '今天星期几？', '昨天不是星期五。']),
  r(7, 29, 10, '明天见！', 'До завтра!', 'See you tomorrow!', 'A', ['明天见。', '星期一见。', '去学校见。', '昨天见。']),
  // Lesson 8 · p. 34–35 (8-7)
  r(8, 34, 1, '你要几个包子？', 'Сколько тебе баоцзы?', 'How many baozi do you want?', 'B', ['一瓶啤酒。', '四个包子。', '我去食堂。', '我不喜欢吃。']),
  r(8, 34, 2, '我们吃什么？', 'Что будем есть?', 'What shall we eat?', 'A', ['我们吃一些米饭。', '好。', '米饭不好。', '我们不吃。']),
  r(8, 34, 3, '你喝什么？', 'Что будешь пить?', 'What will you drink?', 'B', ['都不要。', '有咖啡吗？', '我要去食堂。', '我有书。']),
  r(8, 34, 4, '你吃什么？', 'Что будешь есть?', 'What will you eat?', 'A', ['有馒头吗？', '食堂很好。', '好吧。', '不太好。']),
  r(8, 34, 5, '我们没有包子，有饺子。', 'У нас нет баоцзы, есть пельмени.', 'We have no baozi, we have dumplings.', 'C', ['要包子。', '有报纸。', '饺子也可以。', '没有。']),
  r(8, 34, 6, '你喝啤酒吗？', 'Ты пьёшь пиво?', 'Do you drink beer?', 'C', ['这是啤酒。', '他有啤酒。', '我不喝啤酒。', '我没有啤酒。']),
  r(8, 34, 7, '你要什么汤？', 'Какой суп будешь?', 'What soup will you have?', 'B', ['没有饺子。', '一碗鸡蛋汤。', '一碗面条儿。', '一瓶啤酒。']),
  r(8, 34, 8, '我们家人都喝茶，你们家呢？', 'В моей семье все пьют чай, а в твоей?', 'Everyone in my family drinks tea. And yours?', 'B', ['哥哥喝。', '我们家人也都喝。', '爸爸、妈妈也不喝。', '爸爸喝，妈妈不喝。']),
  r(8, 35, 9, '你要哪些？', 'Какие тебе?', 'Which ones do you want?', 'B', ['我要一些。', '我要这些。', '我要别的。', '我不要那些。']),
  r(8, 35, 10, '中午你在哪儿吃饭？', 'Где ты обедаешь?', 'Where do you have lunch?', 'B', ['我去邮局。', '我回家吃饭。', '我在家。', '我不去那儿。']),
];

/** 听下列对话，选择正确答案: hear a short dialogue and a question about it. */
export interface Talk { lesson: number; page: number; n: string; lines: { who: '男' | '女'; zh: string }[]; q: string; ru: string; en: string; options: string[]; a: number[] }
const d = (lesson: number, page: number, n: string, script: string, q: string, ru: string, en: string, a: string, options: string[]): Talk => ({
  lesson, page, n, q, ru, en, options, a: [...a].map((x) => 'ABCD'.indexOf(x)),
  lines: script.split('|').map((x) => ({ who: x.slice(0, 1) as '男' | '女', zh: x.slice(2) })),
});

export const TALKS: Talk[] = [
  // Lesson 7 · p. 30 (7-7)
  d(7, 30, '1', '男：你去哪儿？|女：我去邮局寄信。你呢？|男：我去银行。', '女的去哪儿？', 'Куда идёт женщина? — На почту отправить письмо, а мужчина — в банк.', 'Where is the woman going? — To the post office; the man goes to the bank.', 'B', ['去银行', '去邮局', '去学校', '在这儿']),
  d(7, 30, '2', '男：你叫什么名字？|女：我叫张彤。', '女的叫什么名字？', 'Как зовут женщину? — Чжан Тун (Zhāng Tóng).', 'What is the woman’s name? — Zhāng Tóng.', 'B', ['Zhāng Dōng', 'Zhāng Tóng', 'Zhāng Tōng', 'Cháng Tóng']),
  d(7, 30, '3', '女：你爸爸忙吗？|男：我爸爸很忙，妈妈也很忙。', '谁很忙？', 'Кто занят? — И папа, и мама.', 'Who is busy? — Both dad and mum.', 'D', ['爸爸', '妈妈', '我', '爸爸和妈妈']),
  d(7, 30, '4', '女：麦克，他们是谁？|男：他们是我哥哥的朋友。', '他们是谁？', 'Кто они? — Друзья старшего брата Майка.', 'Who are they? — Friends of Mike’s older brother.', 'C', ['一个是麦克的朋友，一个不是', '他们是麦克的朋友', '他们是麦克哥哥的朋友', '他们是麦克的哥哥']),
  d(7, 30, '5', '男：明天你去哪儿？|女：我去天安门。你呢？|男：我回学校学习。', '女的明天去哪儿？', 'Куда женщина пойдёт завтра? — На Тяньаньмэнь.', 'Where is the woman going tomorrow? — Tian’anmen.', 'D', ['去学校', '去公园', '去学习', '去天安门']),
  d(7, 30, '6', '男：您贵姓？|女：我姓江。', '女的姓什么？', 'Какая фамилия у женщины? — Цзян (Jiāng).', 'What is the woman’s surname? — Jiāng.', 'B', ['Qiāng', 'Jiāng', 'Zhāng', 'Xiāng']),
  d(7, 30, '7', '男：今天有我的信吗？|女：没有你的信，有王老师的信。', '今天有谁的信？', 'Чьё сегодня письмо? — Учителя Вана.', 'Whose letter came today? — Teacher Wang’s.', 'B', ['有张东的信', '有王老师的信', '张东是老师', '信是张东的']),
  d(7, 30, '8', '女：你有英语书吗？|男：我没有。你有吗？|女：我有。', '下面哪句话是对的？', 'Что верно? — У мужчины нет учебника английского, а у женщины есть.', 'Which is right? — The man has no English book; the woman has one.', 'C', ['英语书是妹妹的', '男的有英语书', '男的没有英语书', '女的没有英语书']),
  d(7, 30, '9', '男：我姐姐学习德语，我弟弟学习日语。', '弟弟学习什么？', 'Что учит младший брат? — Японский.', 'What does the younger brother study? — Japanese.', 'C', ['弟弟学习德语', '姐姐学习日语', '弟弟学习日语', '他们学习日语']),
  d(7, 30, '10', '女：汉语难吗？|男：汉字很难，发音不太难。', '什么很难？', 'Что трудное? — Иероглифы.', 'What is hard? — The characters.', 'A', ['汉字', '发音', '汉字和发音', '法语']),
  // Lesson 7 homework · p. 31 (7-9)
  d(7, 31, '课外 1', '女：你是英国人吗？|男：对，我是英国人。你呢？|女：我也是英国人。', '下面哪句话是对的？', 'Что верно? — Оба англичане.', 'Which is right? — They are both British.', 'C', ['男的是英国人，女的不是', '女的是英国人，男的不是', '他们都是英国人', '一个是英国人，一个是美国人']),
  d(7, 31, '课外 2', '男：你是学生吗？|女：不，我是老师。你呢？|男：我是学生。', '下面哪句话是对的？', 'Что верно? — Один студент, другая нет (она учитель).', 'Which is right? — One is a student, the other is not (she is a teacher).', 'B', ['他们都是学生', '一个是学生，一个不是', '男的是老师', '女的是学生']),
  d(7, 31, '课外 3', '女：你叫什么名字？|男：我叫宋山。', '男的叫什么名字？', 'Как зовут мужчину? — Сун Шань (Sòng Shān).', 'What is the man’s name? — Sòng Shān.', 'B', ['Sòng Xiān', 'Sòng Shān', 'Cóng Shān', 'Zhōngshān']),
  // Lesson 8 · p. 35 (8-8)
  d(8, 35, '1', '女：你去食堂吗？|男：我不去。你呢？|女：我也不去。', '谁去食堂？', 'Кто идёт в столовую? — Никто.', 'Who is going to the canteen? — Nobody.', 'D', ['女的', '男的', '他们都去', '没有人去']),
  d(8, 35, '2', '男：你吃什么？|女：我吃饺子，也吃包子。', '女的吃什么？', 'Что ест женщина? — Пельмени и баоцзы.', 'What does the woman eat? — Dumplings and baozi.', 'D', ['饺子', '米饭或包子', '饺子和米饭', '饺子和包子']),
  d(8, 35, '3', '男：你喝茶吗？|女：不喝。|男：喝咖啡吗？|女：也不喝。', '女的喝什么？', 'Что пьёт женщина? — Ни чай, ни кофе.', 'What does the woman drink? — Neither tea nor coffee.', 'C', ['咖啡', '茶', '茶、咖啡都不喝', '茶、咖啡都喝']),
  d(8, 35, '4', '女：你要什么？|男：我要三个包子，一碗鸡蛋汤。', '男的要什么？', 'Что берёт мужчина? — Три баоцзы и суп с яйцом.', 'What does the man order? — Three baozi and egg soup.', 'D', ['一个包子和一碗鸡蛋汤', '一碗米饭和一碗鸡蛋汤', '三碗米饭和一碗鸡蛋汤', '三个包子和一碗鸡蛋汤']),
  d(8, 35, '5', '男：你有什么书？|女：我有一本汉语书，还有一本英语杂志。', '女的有什么？', 'Что есть у женщины? — Книга на китайском и журнал на английском.', 'What does the woman have? — A Chinese book and an English magazine.', 'D', ['书', '杂志', '英语书和汉语杂志', '汉语书和英语杂志']),
  d(8, 35, '6', '男：玛丽，这是你的杂志吗？|女：不是，是我姐姐的。', '杂志是谁的？', 'Чей журнал? — Старшей сестры Мэри.', 'Whose magazine is it? — Mary’s older sister’s.', 'C', ['杂志不是姐姐的', '杂志是玛丽的', '杂志是玛丽姐姐的', '杂志是她们的']),
  d(8, 35, '7', '女：我吃饺子，你呢？|男：我也吃饺子。', '下面哪句话是对的？', 'Что верно? — Оба едят пельмени.', 'Which is right? — They both eat dumplings.', 'C', ['他要吃饺子', '他要吃面条儿', '他们都吃饺子', '他们都吃面条儿']),
  d(8, 35, '8', '女：你喜欢中国面条儿吗？|男：不太喜欢，我喜欢日本面条儿。', '下面哪句话是对的？', 'Что верно? — Ему нравится японская лапша.', 'Which is right? — He likes Japanese noodles.', 'B', ['他不喜欢中国面条儿', '他喜欢日本面条儿', '今天不吃面条儿', '今天吃日本面条儿']),
  d(8, 35, '9', '男：我们什么时候去？|女：明天中午去吧。', '他们什么时候去？', 'Когда они пойдут? — Завтра в обед.', 'When are they going? — Tomorrow at noon.', 'D', ['今天下午', '明天下午', '今天中午', '明天中午']),
  d(8, 35, '10', '男：你在这个学校学习吗？|女：不，我在北京语言大学学习。|男：你也在这个食堂吃饭吗？|女：对，我们都在这儿吃饭。', '下面哪句话是对的？', 'Что верно? — Они оба едят в этой столовой.', 'Which is right? — They both eat in this canteen.', 'D', ['他们在一个学校学习', '女的在这个学校学习', '女的不喜欢这个食堂', '他们在这个食堂吃饭']),
  // Lesson 8 homework · p. 36 (8-9): the recording's text and answers from the teacher's slides
  d(8, 36, '课外 1', '男：小姐，有馒头吗？|女：对不起，没有馒头。|男：这不是馒头吗？|女：不是，这是包子。|男：对不起，我不知道。我要两个。', '男的要买什么？', 'Что покупает мужчина? — Два баоцзы (он принял их за маньтоу).', 'What does the man buy? — Two baozi (he took them for mantou).', 'C', ['一个面包', '两个馒头', '两个包子', '一个包子']),
  d(8, 36, '课外 2', '女：德国人很喜欢喝啤酒，对吗？|男：对，我们德国男人都喜欢喝。中国人呢？|女：中国男人也喜欢喝。|男：你喝吗？|女：我也喝。', '下面哪个选项不对？', 'Что НЕ верно? — «Женщина не пьёт пиво»: она тоже пьёт.', 'Which is NOT right? — “The woman doesn’t drink beer”: she does.', 'D', ['他们都喜欢喝啤酒', '德国人都喜欢喝啤酒', '两国男人都喜欢喝啤酒', '女的不喝啤酒']),
  d(8, 36, '课外 3（1）', '女：麦克，今天你吃什么？|男：米饭、面条儿都可以，你呢？|女：米饭、面条儿我都不喜欢，我们吃饺子吧。|男：好吧，我也很喜欢吃饺子。', '他们吃什么？', 'Что они едят? — Пельмени.', 'What do they eat? — Dumplings.', 'C', ['女的吃米饭', '女的吃面条儿', '都吃饺子', '米饭和面条儿']),
  d(8, 36, '课外 3（2）', '女：麦克，今天你吃什么？|男：米饭、面条儿都可以，你呢？|女：米饭、面条儿我都不喜欢，我们吃饺子吧。|男：好吧，我也很喜欢吃饺子。', '谁喜欢吃饺子？', 'Кто любит пельмени? — Оба.', 'Who likes dumplings? — Both.', 'C', ['男的', '女的', '他们都喜欢', '他们都不喜欢']),
  d(8, 36, '课外 4', '女：你不要咖啡吗？|男：我中午不喝咖啡。有茶吗？|女：有。', '男的是什么意思？', 'Что имеет в виду мужчина? — Он хочет чай.', 'What does the man mean? — He wants tea.', 'A', ['他现在想喝茶', '他中午喝咖啡', '他下午喝咖啡', '他不喜欢喝咖啡']),
  // 听一听，猜一猜 · p. 36 (8-10): the book prints no options; these four are the site's
  d(8, 36, '猜一猜 1', '男：德国的啤酒好，法国的葡萄酒好。中国呢？当然是白酒。', '中国的什么酒好？', 'Какой алкоголь хорош в Китае? — Байцзю (白酒).', 'Which drink is good in China? — Baijiu (白酒).', 'C', ['啤酒', '葡萄酒', '白酒', '可乐']),
  d(8, 36, '猜一猜 2', '男：麦克喝一瓶啤酒，山田喝一杯葡萄酒，玛丽不喝啤酒，也不喝葡萄酒，她喝可乐。', '谁不喝啤酒？', 'Кто не пьёт пиво? — Ямада и Мэри.', 'Who doesn’t drink beer? — Yamada and Mary.', 'D', ['麦克', '山田', '玛丽', '山田和玛丽']),
];

/** 边听边写出词语的拼音和汉字: hear a word, write its pinyin, then its characters. */
export interface Dictation { lesson: number; page: number; zh: string; py: string; ru: string; en: string }
const w = (lesson: number, page: number, zh: string, py: string, ru: string, en: string): Dictation => ({ lesson, page, zh, py, ru, en });

export const DICTATION: Dictation[] = [
  // Lesson 6 · p. 26 (6-8), the words on the teacher's homework slides
  w(6, 26, '五', 'wǔ', 'пять', 'five'),
  w(6, 26, '一', 'yī', 'один', 'one'),
  w(6, 26, '大', 'dà', 'большой', 'big'),
  w(6, 26, '口', 'kǒu', 'рот; счётное для членов семьи', 'mouth; measure word for family members'),
  w(6, 26, '三', 'sān', 'три', 'three'),
  w(6, 26, '百', 'bǎi', 'сто', 'hundred'),
  w(6, 26, '四口', 'sì kǒu', 'четыре человека (в семье)', 'four (people in a family)'),
  w(6, 26, '白马', 'bái mǎ', 'белая лошадь', 'white horse'),
  w(6, 26, '大马', 'dà mǎ', 'большая лошадь', 'big horse'),
  w(6, 26, '女人', 'nǚrén', 'женщина', 'woman'),
  w(6, 26, '很难', 'hěn nán', 'очень трудно', 'very hard'),
  w(6, 26, '不忙', 'bù máng', 'не занят', 'not busy'),
  // Lesson 7 · p. 31 (7-8), the words on the teacher's homework slides
  w(7, 31, '哪儿', 'nǎr', 'где, куда', 'where'),
  w(7, 31, '那儿', 'nàr', 'там', 'there'),
  w(7, 31, '去', 'qù', 'идти, ехать', 'to go'),
  w(7, 31, '寄', 'jì', 'отправлять (по почте)', 'to send by post'),
  w(7, 31, '取', 'qǔ', 'брать, получать', 'to take, to get'),
  w(7, 31, '前', 'qián', 'перед, впереди', 'front, before'),
  w(7, 31, '见', 'jiàn', 'видеть, встречать', 'to see, to meet'),
  w(7, 31, '北京', 'Běijīng', 'Пекин', 'Beijing'),
  w(7, 31, '银行', 'yínháng', 'банк', 'bank'),
  w(7, 31, '邮局', 'yóujú', 'почта', 'post office'),
  w(7, 31, '学校', 'xuéxiào', 'школа', 'school'),
  w(7, 31, '星期', 'xīngqī', 'неделя', 'week'),
  w(7, 31, '再见', 'zàijiàn', 'до свидания', 'goodbye'),
  w(7, 31, '今天', 'jīntiān', 'сегодня', 'today'),
  // Lesson 8 · words of pp. 33–36
  w(8, 33, '茶', 'chá', 'чай', 'tea'),
  w(8, 33, '邮票', 'yóupiào', 'почтовая марка', 'stamp'),
  w(8, 33, '水果', 'shuǐguǒ', 'фрукты', 'fruit'),
  w(8, 33, '工作', 'gōngzuò', 'работа', 'work'),
  w(8, 33, '多少钱', 'duōshao qián', 'сколько стоит', 'how much (money)'),
  w(8, 33, '客气', 'kèqi', 'вежливый, церемонный', 'polite'),
  w(8, 33, '请进', 'qǐng jìn', 'входите', 'come in'),
  w(8, 33, '身体', 'shēntǐ', 'здоровье, тело', 'health, body'),
  w(8, 34, '咖啡', 'kāfēi', 'кофе', 'coffee'),
  w(8, 34, '米饭', 'mǐfàn', 'варёный рис', 'cooked rice'),
  w(8, 35, '杂志', 'zázhì', 'журнал', 'magazine'),
  w(8, 35, '中午', 'zhōngwǔ', 'полдень, обед', 'noon'),
];

/** 边听边填空 (p. 26, 6-9): hear the text, write the missing words in pinyin or characters. */
export interface Gap { zh: string; py: string }
export interface FillText { page: number; lines: { who?: string; parts: (string | Gap)[] }[]; ru: string; en: string }
const g = (zh: string, py: string): Gap => ({ zh, py });

export const FILL_TEXTS: FillText[] = [
  { page: 26, ru: 'У меня есть младший брат, его зовут Сяомин, он очень занят. Он учит немецкий, немецкий очень трудный.', en: 'I have a younger brother called Xiaoming; he is very busy. He studies German, and German is very hard.',
    lines: [{ parts: ['我有一个', g('弟弟', 'dìdi'), '，他叫小明，他很', g('忙', 'máng'), '。他学德语，德语很', g('难', 'nán'), '。'] }] },
  { page: 26, ru: 'А: Ты идёшь на почту? — Б: Да. А ты? — А: Я тоже, отправить письмо. Ты тоже отправляешь письмо? — Б: Нет, я иду снять деньги.', en: 'A: Are you going to the post office? — B: Yes. And you? — A: Me too, to send a letter. Are you sending one too? — B: No, I am going to get money.',
    lines: [
      { who: 'A', parts: ['你去', g('邮局', 'yóujú'), '吗？'] },
      { who: 'B', parts: ['对，我去。你去吗？'] },
      { who: 'A', parts: ['我', g('也', 'yě'), '去，我去寄信。你也寄信吗？'] },
      { who: 'B', parts: ['不，我去取', g('钱', 'qián'), '。'] },
    ] },
];

/**
 * 听后标出声调 — lessons 1–3 homework, the syllables and words on the
 * teacher's slides. `say` is what the voice reads: single syllables are read
 * through a character with that one reading.
 */
export interface ToneItem { lesson: number; py: string; say: string; zh?: string }
const tn = (lesson: number, list: string, word = false): ToneItem[] => list.split(' / ').map((x) => {
  const [py, say] = x.split('=');
  return { lesson, py, say, zh: word ? say : undefined };
});
export const TONES: ToneItem[] = [
  ...tn(1, 'pà=怕 / mài=卖 / bāo=包 / hǎi=海 / hē=喝 / fǎ=法 / nǚ=女 / tè=特 / fēi=飞 / dōu=兜 / lèi=类 / kǎo=考 / gū=姑 / yì=意 / yú=鱼 / hòu=后'),
  ...tn(1, 'dàgài=大概 / máoyī=毛衣 / fúwù=服务 / tǐyù=体育 / tígāo=提高 / nǔlì=努力 / lí kāi=离开 / hēibái=黑白 / mǎlù=马路 / báimǐ=白米 / àihào=爱好', true),
  ...tn(2, 'bān=班 / páng=旁 / hěn=很 / hóng=红 / kàn=看 / gèng=更 / fēn=分 / lán=蓝 / dòng=动 / máng=忙 / tōng=通 / néng=能 / běn=本 / kōng=空 / gàn=赣'),
  ...tn(2, 'bù tóng=不同 / fāngfǎ=方法 / hǎokàn=好看 / fēngfù=丰富 / hēibǎn=黑板 / gāngbǐ=钢笔 / kèběn=课本 / gǎnmào=感冒 / gōngyù=公寓 / tàiyáng=太阳 / láodòng=劳动 / kěnéng=可能 / Hànyǔ=汉语 / bàn gōng=办公 / hóngdēng=红灯 / bāng máng=帮忙 / nánfāng=南方', true),
  ...tn(3, 'xìn=信 / quán=全 / qún=群 / bié=别 / jiào=叫 / tīng=听 / jué=决 / xuǎn=选 / xiǎng=想'),
  ...tn(3, 'jiàn miàn=见面 / juédìng=决定 / xuéjí=学籍 / qǐng jià=请假 / xiāngxìn=相信 / xiūxi=休息', true),
];

/**
 * 在横线上填出你听到的音节 — lessons 1–5 homework sentences from the
 * teacher's slides. In `py`, the syllables in [brackets] are the gaps, as on
 * the midterm paper ("hěn hǎo[kàn]").
 */
export interface BlankLine { who?: 'A' | 'B'; py: string; zh: string }
export interface BlankItem { lesson: number; lines: BlankLine[]; ru: string; en: string }
const bl = (lesson: number, ru: string, en: string, ...lines: (string | [string, string, string])[]): BlankItem => ({
  lesson, ru, en,
  lines: lines.map((l) => (typeof l === 'string' ? (() => { const [py, zh] = l.split(' = '); return { py, zh }; })() : { who: l[0] as 'A' | 'B', py: l[1], zh: l[2] })),
});

export const BLANKS: BlankItem[] = [
  bl(1, 'Майк старше него.', 'Mike is older than him.', 'Màikè bǐ tā [dà]. = 麦克比他大。'),
  bl(1, 'Его одежда такая белая.', 'His clothes are so white.', 'Tā de yīfu kě [bái] le. = 他的衣服可白了。'),
  bl(1, 'Мама пьёт кофе, старший брат — колу.', 'Mum drinks coffee, my older brother drinks cola.', 'Māma hē kā[fēi], gēge hē kě[lè]. = 妈妈喝咖啡，哥哥喝可乐。'),
  bl(1, 'Она любит вязать свитера, Майк любит бегать.', 'She likes knitting sweaters, Mike likes running.', 'Tā ài dǎ máo[yī], Màikè ài pǎo [bù]. = 她爱打毛衣，麦克爱跑步。'),
  bl(1, 'Ты покупаешь груши, он рыбу, Мэри рис.', 'You buy pears, he buys fish, Mary buys rice.', 'Nǐ mǎi [lí], tā mǎi [yú], Mǎlì mǎi dà[mǐ]. = 你买梨，他买鱼，玛丽买大米。'),
  bl(1, 'Старший брат выше младшего, младший ниже старшего.', 'The older brother is taller than the younger, the younger is shorter.', 'Gēge bǐ dìdi [gāo], dìdi bǐ gēge [ǎi]. = 哥哥比弟弟高，弟弟比哥哥矮。'),
  bl(2, 'Его одежда очень красивая.', 'His clothes look very nice.', 'Tā de yīfu hěn hǎo[kàn]. = 他的衣服很好看。'),
  bl(2, 'Китайский трудный? — Нет.', 'Is Chinese hard? — No.', ['A', 'Hànyǔ [nán] ma?', '汉语难吗？'], ['B', '[Bù nán].', '不难。']),
  bl(2, 'В кофе сахар кладёшь? — Нет.', 'Do you put sugar in coffee? — No.', ['A', 'Kāfēi li fàng [táng] ma?', '咖啡里放糖吗？'], ['B', 'Bú [fàng].', '不放。']),
  bl(2, 'Перевод готов? — Ещё нет.', 'Is the translation done? — Not yet.', ['A', '[Fānyì] hǎo le ma?', '翻译好了吗？'], ['B', 'Hái [méi] ne.', '还没呢。']),
  bl(2, 'Доктор, мне холодно и болит голова. — Наверное, простуда.', 'Doctor, I’m cold and have a headache. — Probably a cold.', ['A', 'Dàifu, wǒ hěn [lěng], hái tóu [téng].', '大夫，我很冷，还头疼。'], ['B', 'Kěnéng [gǎnmào] le.', '可能感冒了。']),
  bl(2, 'Посмотрите на доску… Понятно? — Понятно.', 'Look at the blackboard… Got it? — Got it.', ['A', 'Nǐmen kàn [hēibǎn]… Dǒng le ma?', '你们看黑板……懂了吗？'], ['B', '[Dǒng] le.', '懂了。']),
  bl(3, 'Сегодня суббота, он хочет пойти поплавать.', 'Today is Saturday; he wants to go swimming.', 'Jīntiān Xīngqī[liù], tā xiǎng qù [yóu] yǒng. = 今天星期六，他想去游泳。'),
  bl(3, 'Мэри любит слушать музыку, Майк любит баскетбол.', 'Mary likes listening to music, Mike likes basketball.', 'Mǎlì ài tīng [yīnyuè], Màikè ài dǎ [lán]qiú. = 玛丽爱听音乐，麦克爱打篮球。'),
  bl(3, 'Старшая сестра идёт на почту купить марки.', 'My older sister goes to the post office to buy stamps.', 'Jiějie qù [yóujú] mǎi [yóupiào]. = 姐姐去邮局买邮票。'),
  bl(3, 'Сегодня в школе концерт на китайском, пойдёшь смотреть?', 'There is a Chinese show at school today — going to watch?', 'Jīntiān xuéxiào yǒu Hànyǔ [jiémù] biǎoyǎn, qù [kàn] ma? = 今天学校有汉语节目表演，去看吗？'),
  bl(3, 'Ребята, тише, пожалуйста.', 'Classmates, quiet, please.', 'Tóngxuémen, qǐng [ānjìng]. = 同学们，请安静。'),
  bl(3, 'Сегодня он идёт в банк снять деньги, завтра — в больницу к врачу.', 'Today he goes to the bank for money, tomorrow to the hospital.', 'Tā jīntiān qù [yínháng] qǔ qián, míngtiān qù [yīyuàn] kàn bìng. = 他今天去银行取钱，明天去医院看病。'),
  bl(4, 'Я люблю танцевать, он любит теннис.', 'I like dancing, he likes tennis.', 'Wǒ xǐhuan tiào [wǔ], tā xǐhuan dǎ [wǎng]qiú. = 我喜欢跳舞，他喜欢打网球。'),
  bl(4, 'Скажите, где туалет? — Впереди.', 'Excuse me, where is the toilet? — Up ahead.', ['A', 'Qǐng wèn, nǎr yǒu [cèsuǒ]?', '请问，哪儿有厕所？'], ['B', '[Qián] biānr yǒu.', '前边儿有。']),
  bl(4, 'Есть трудности в учёбе? — Мне кажется, произношение очень трудное.', 'Any difficulties in your studies? — I find pronunciation hard.', ['A', 'Nǐ xuéxí yǒu [kùnnan] ma?', '你学习有困难吗？'], ['B', 'Wǒ juéde Hànyǔ [fāyīn] hěn nán.', '我觉得汉语发音很难。']),
  bl(4, 'Какая завтра погода? — Тепло. — Ветер будет? — Нет.', 'What’s the weather tomorrow? — Warm. — Windy? — No.', ['A', 'Míngtiān [tiānqì] zěnmeyàng?', '明天天气怎么样？'], ['B', 'Hěn [nuǎnhuo].', '很暖和。'], ['A', 'Guā [fēng] ma?', '刮风吗？'], ['B', 'Bù guā fēng.', '不刮风。']),
  bl(4, 'Ваша фамилия? — Хуан. — Добро пожаловать! — Спасибо!', 'Your surname? — Huang. — Welcome! — Thank you!', ['A', 'Nín guìxìng?', '您贵姓？'], ['B', 'Wǒ xìng [Huáng].', '我姓黄。'], ['A', '[Huānyíng] nín!', '欢迎您！'], ['B', 'Xièxie!', '谢谢！']),
  bl(5, 'Это мой муж, он профессор. Это мой сын, он студент.', 'This is my husband, he is a professor. This is my son, he is a student.', 'Zhè shì wǒ ài[ren], tā shì jiào[shòu]. Zhè shì wǒ [ér]zi, tā shì xué[sheng]. = 这是我爱人，他是教授。这是我儿子，他是学生。'),
  bl(5, 'Это аудитория, здесь у нас занятия. Это столовая, здесь мы едим. Это общежитие, здесь мы отдыхаем.', 'This is the classroom, we have classes here. This is the canteen, we eat here. This is the dorm, we rest here.', 'Zhè shì [jiàoshì], wǒmen zài zhèr shàng kè. Zhè shì [shítáng], wǒmen zài zhèr chī fàn. Zhè shì [sùshè], wǒmen zài zhèr xiūxi. = 这是教室，我们在这儿上课。这是食堂，我们在这儿吃饭。这是宿舍，我们在这儿休息。'),
  bl(5, 'Что это за машина? — Такси. — А та как называется? — Автобус.', 'What car is this? — A taxi. — And that one? — A bus.', ['A', 'Zhè shì shénme chē?', '这是什么车？'], ['B', 'Zhè shì [chūzū] qìchē.', '这是出租汽车。'], ['A', 'Nà jiào shénme chē?', '那叫什么车？'], ['B', 'Nà jiào [gōnggòng] qìchē.', '那叫公共汽车。']),
  bl(5, 'Сколько стоит эта рубашка? — Девяносто юаней.', 'How much is this shirt? — Ninety yuan.', ['A', 'Zhè jiàn [chènyī] duōshao qián?', '这件衬衣多少钱？'], ['B', '[Jiǔshí] kuài qián.', '九十块钱。']),
];

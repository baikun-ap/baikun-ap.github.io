/**
 * Midterm practice for 《汉语教程》 Book 1A, lessons 1–7.
 *
 * The words come straight from the book's lessons; the sentences below are
 * written for this site and use only vocabulary from those seven lessons, so
 * every item is something the learner has met. Each item names its lesson so
 * practice can be narrowed to the lessons a test covers.
 */

export const MIDTERM_BOOK = 'jc1a';
export const MIDTERM_LESSONS = [1, 2, 3, 4, 5, 6, 7];

/** «__» marks the gap; the right word and two that do not fit. */
export interface FillItem { lesson: number; zh: string; answer: string; wrong: [string, string]; py: string; ru: string; en: string }

/** Word tiles in the right order; alts lists other orders that are also correct. */
export interface BuildItem { lesson: number; tokens: string[]; alts?: string[][]; py: string; ru: string; en: string }

/** A question and the answer to put together from tiles. */
export interface AnswerItem { lesson: number; q: string; qPy: string; qRu: string; qEn: string; tokens: string[]; alts?: string[][]; py: string; ru: string; en: string }

const f = (lesson: number, zh: string, answer: string, wrong: [string, string], py: string, ru: string, en: string): FillItem => ({ lesson, zh, answer, wrong, py, ru, en });
const b = (lesson: number, tokens: string, py: string, ru: string, en: string, ...alts: string[]): BuildItem =>
  ({ lesson, tokens: tokens.split(' '), alts: alts.map((a) => a.split(' ')), py, ru, en });
const a = (lesson: number, q: string, qPy: string, qRu: string, qEn: string, tokens: string, py: string, ru: string, en: string, ...alts: string[]): AnswerItem =>
  ({ lesson, q, qPy, qRu, qEn, tokens: tokens.split(' '), alts: alts.map((x) => x.split(' ')), py, ru, en });

export const FILL: FillItem[] = [
  f(1, '你__！', '好', ['大', '八'], 'Nǐ hǎo!', 'Здравствуй!', 'Hello!'),
  f(2, '我不__。', '忙', ['你', '马'], 'Wǒ bù máng.', 'Я не занят.', 'I am not busy.'),
  f(2, '你忙__？', '吗', ['很', '太'], 'Nǐ máng ma?', 'Ты занят?', 'Are you busy?'),
  f(2, '汉语不__难。', '太', ['吗', '是'], 'Hànyǔ bú tài nán.', 'Китайский не очень трудный.', 'Chinese is not too hard.'),
  f(2, '我__忙。', '很', ['吗', '是'], 'Wǒ hěn máng.', 'Я занят.', 'I am busy.'),
  f(2, '他是我__。', '哥哥', ['汉语', '银行'], 'Tā shì wǒ gēge.', 'Он мой старший брат.', 'He is my older brother.'),
  f(2, '你爸爸妈妈好__？', '吗', ['很', '不'], 'Nǐ bàba māma hǎo ma?', 'Как твои папа и мама?', 'How are your dad and mum?'),
  f(3, '我__汉语。', '学', ['去', '喝'], 'Wǒ xué Hànyǔ.', 'Я учу китайский.', 'I study Chinese.'),
  f(3, '明天__！', '见', ['学', '对'], 'Míngtiān jiàn!', 'До завтра!', 'See you tomorrow!'),
  f(3, '我去银行__钱。', '取', ['喝', '坐'], 'Wǒ qù yínháng qǔ qián.', 'Я иду в банк снять деньги.', 'I am going to the bank to get money.'),
  f(3, '我去邮局__信。', '寄', ['喝', '吃'], 'Wǒ qù yóujú jì xìn.', 'Я иду на почту отправить письмо.', 'I am going to the post office to send a letter.'),
  f(3, '他学__，不学英语。', '日语', ['银行', '邮局'], 'Tā xué Rìyǔ, bù xué Yīngyǔ.', 'Он учит японский, а не английский.', 'He studies Japanese, not English.'),
  f(4, '你去__？', '哪儿', ['很', '几'], 'Nǐ qù nǎr?', 'Куда ты идёшь?', 'Where are you going?'),
  f(4, '今天星期__？', '几', ['哪儿', '什么'], 'Jīntiān xīngqī jǐ?', 'Какой сегодня день недели?', 'What day of the week is it today?'),
  f(4, '对不起！——__。', '没关系', ['谢谢', '你好'], 'Duìbuqǐ! — Méi guānxi.', 'Извини! — Ничего страшного.', 'Sorry! — It’s OK.'),
  f(4, '__是天安门。', '那儿', ['哪儿', '几'], 'Nàr shì Tiān’ān Mén.', 'Там — Тяньаньмэнь.', 'That is Tian’anmen over there.'),
  f(4, '我__学校。', '去', ['喝', '难'], 'Wǒ qù xuéxiào.', 'Я иду в школу.', 'I am going to school.'),
  f(4, '昨天星期一，今天星期__。', '二', ['五', '六'], 'Zuótiān xīngqīyī, jīntiān xīngqī’èr.', 'Вчера был понедельник, сегодня вторник.', 'Yesterday was Monday, today is Tuesday.'),
  f(5, '这__王老师。', '是', ['很', '吗'], 'Zhè shì Wáng lǎoshī.', 'Это учитель Ван.', 'This is teacher Wang.'),
  f(5, '请__！请坐！', '进', ['是', '很'], 'Qǐng jìn! Qǐng zuò!', 'Входите! Садитесь!', 'Come in! Have a seat!'),
  f(5, '请喝__。', '茶', ['老师', '学校'], 'Qǐng hē chá.', 'Выпейте чаю.', 'Have some tea.'),
  f(5, '谢谢！——不__。', '客气', ['关系', '好'], 'Xièxie! — Bú kèqi.', 'Спасибо! — Не за что.', 'Thank you! — You’re welcome.'),
  f(5, '您身体好__？', '吗', ['很', '是'], 'Nín shēntǐ hǎo ma?', 'Как ваше здоровье?', 'How is your health?'),
  f(5, '他不__老师。', '是', ['很', '好'], 'Tā bú shì lǎoshī.', 'Он не учитель.', 'He is not a teacher.'),
  f(6, '您贵__？', '姓', ['叫', '名字'], 'Nín guìxìng?', 'Ваша фамилия?', 'What is your surname?'),
  f(6, '你叫什么__？', '名字', ['人', '书'], 'Nǐ jiào shénme míngzi?', 'Как тебя зовут?', 'What is your name?'),
  f(6, '你是__国人？', '哪', ['那', '谁'], 'Nǐ shì nǎ guó rén?', 'Из какой ты страны?', 'Which country are you from?'),
  f(6, '这是我__书。', '的', ['是', '吗'], 'Zhè shì wǒ de shū.', 'Это моя книга.', 'This is my book.'),
  f(6, '认识你很__。', '高兴', ['名字', '朋友'], 'Rènshi nǐ hěn gāoxìng.', 'Рад с тобой познакомиться.', 'Nice to meet you.'),
  f(6, '他是__？——他是我朋友。', '谁', ['哪', '什么'], 'Tā shì shéi? — Tā shì wǒ péngyou.', 'Кто он? — Он мой друг.', 'Who is he? — He is my friend.'),
  f(6, '我__学习汉语。', '也', ['很', '是'], 'Wǒ yě xuéxí Hànyǔ.', 'Я тоже учу китайский.', 'I study Chinese too.'),
  f(6, '我是__人。', '中国', ['中文', '汉语'], 'Wǒ shì Zhōngguó rén.', 'Я китаец.', 'I am Chinese.'),
  f(7, '我要三__包子。', '个', ['碗', '口'], 'Wǒ yào sān ge bāozi.', 'Мне три баоцзы.', 'Three baozi for me.'),
  f(7, '我要一__米饭。', '碗', ['口', '些'], 'Wǒ yào yì wǎn mǐfàn.', 'Мне миску риса.', 'A bowl of rice for me.'),
  f(7, '你__什么？——我吃饺子。', '吃', ['喝', '是'], 'Nǐ chī shénme? — Wǒ chī jiǎozi.', 'Что ты будешь есть? — Пельмени.', 'What will you eat? — Dumplings.'),
  f(7, '你喝__吗？', '啤酒', ['包子', '米饭'], 'Nǐ hē píjiǔ ma?', 'Будешь пиво?', 'Will you have a beer?'),
  f(7, '中午你去__吃饭？', '哪儿', ['什么', '谁'], 'Zhōngwǔ nǐ qù nǎr chī fàn?', 'Куда ты пойдёшь обедать?', 'Where are you going for lunch?'),
  f(7, '我要一碗鸡蛋__。', '汤', ['酒', '茶'], 'Wǒ yào yì wǎn jīdàn tāng.', 'Мне миску супа с яйцом.', 'A bowl of egg soup for me.'),
];

export const BUILD: BuildItem[] = [
  b(1, '你 好 ！', 'Nǐ hǎo!', 'Здравствуй!', 'Hello!'),
  b(2, '我 很 忙 。', 'Wǒ hěn máng.', 'Я занят.', 'I am busy.'),
  b(2, '汉语 不 太 难 。', 'Hànyǔ bú tài nán.', 'Китайский не очень трудный.', 'Chinese is not too hard.'),
  b(2, '你 妈妈 好 吗 ？', 'Nǐ māma hǎo ma?', 'Как твоя мама?', 'How is your mum?'),
  b(3, '我 学 汉语 。', 'Wǒ xué Hànyǔ.', 'Я учу китайский.', 'I study Chinese.'),
  b(3, '我 去 银行 取 钱 。', 'Wǒ qù yínháng qǔ qián.', 'Я иду в банк снять деньги.', 'I am going to the bank to get money.'),
  b(3, '我 去 邮局 寄 信 。', 'Wǒ qù yóujú jì xìn.', 'Я иду на почту отправить письмо.', 'I am going to the post office to send a letter.'),
  b(4, '你 去 哪儿 ？', 'Nǐ qù nǎr?', 'Куда ты идёшь?', 'Where are you going?'),
  b(4, '今天 星期 几 ？', 'Jīntiān xīngqī jǐ?', 'Какой сегодня день недели?', 'What day of the week is it today?'),
  b(4, '我 明天 回 学校 。', 'Wǒ míngtiān huí xuéxiào.', 'Я завтра вернусь в школу.', 'I will go back to school tomorrow.', '明天 我 回 学校 。'),
  b(5, '这 是 王 老师 。', 'Zhè shì Wáng lǎoshī.', 'Это учитель Ван.', 'This is teacher Wang.'),
  b(5, '请 喝 茶 。', 'Qǐng hē chá.', 'Выпейте чаю.', 'Have some tea.'),
  b(5, '您 身体 好 吗 ？', 'Nín shēntǐ hǎo ma?', 'Как ваше здоровье?', 'How is your health?'),
  b(5, '他 不 是 老师 。', 'Tā bú shì lǎoshī.', 'Он не учитель.', 'He is not a teacher.'),
  b(6, '你 叫 什么 名字 ？', 'Nǐ jiào shénme míngzi?', 'Как тебя зовут?', 'What is your name?'),
  b(6, '你 是 哪 国 人 ？', 'Nǐ shì nǎ guó rén?', 'Из какой ты страны?', 'Which country are you from?'),
  b(6, '这 是 我 的 书 。', 'Zhè shì wǒ de shū.', 'Это моя книга.', 'This is my book.'),
  b(6, '认识 你 很 高兴 。', 'Rènshi nǐ hěn gāoxìng.', 'Рад с тобой познакомиться.', 'Nice to meet you.', '很 高兴 认识 你 。'),
  b(6, '他 也 学习 汉语 。', 'Tā yě xuéxí Hànyǔ.', 'Он тоже учит китайский.', 'He studies Chinese too.'),
  b(6, '那 是 什么 书 ？', 'Nà shì shénme shū?', 'Что это за книга?', 'What book is that?'),
  b(7, '我 要 一 碗 米饭 。', 'Wǒ yào yì wǎn mǐfàn.', 'Мне миску риса.', 'A bowl of rice for me.'),
  b(7, '我 要 三 个 包子 。', 'Wǒ yào sān ge bāozi.', 'Мне три баоцзы.', 'Three baozi for me.'),
  b(7, '你 喝 啤酒 吗 ？', 'Nǐ hē píjiǔ ma?', 'Будешь пиво?', 'Will you have a beer?'),
  b(7, '中午 你 去 食堂 吗 ？', 'Zhōngwǔ nǐ qù shítáng ma?', 'Ты пойдёшь в обед в столовую?', 'Are you going to the canteen at noon?', '你 中午 去 食堂 吗 ？'),
];

export const ANSWER: AnswerItem[] = [
  a(2, '你忙吗？', 'Nǐ máng ma?', 'Ты занят?', 'Are you busy?', '我 很 忙 。', 'Wǒ hěn máng.', 'Я занят.', 'I am busy.'),
  a(2, '汉语难吗？', 'Hànyǔ nán ma?', 'Китайский трудный?', 'Is Chinese hard?', '汉语 不 太 难 。', 'Hànyǔ bú tài nán.', 'Китайский не очень трудный.', 'Chinese is not too hard.'),
  a(2, '他是你哥哥吗？', 'Tā shì nǐ gēge ma?', 'Он твой старший брат?', 'Is he your older brother?', '他 是 我 哥哥 。', 'Tā shì wǒ gēge.', 'Он мой старший брат.', 'He is my older brother.'),
  a(3, '你学什么？', 'Nǐ xué shénme?', 'Что ты учишь?', 'What do you study?', '我 学 汉语 。', 'Wǒ xué Hànyǔ.', 'Я учу китайский.', 'I study Chinese.'),
  a(3, '你去银行吗？', 'Nǐ qù yínháng ma?', 'Ты идёшь в банк?', 'Are you going to the bank?', '我 不 去 银行 。', 'Wǒ bú qù yínháng.', 'Я не иду в банк.', 'I am not going to the bank.'),
  a(3, '你去邮局吗？', 'Nǐ qù yóujú ma?', 'Ты идёшь на почту?', 'Are you going to the post office?', '我 去 邮局 寄 信 。', 'Wǒ qù yóujú jì xìn.', 'Я иду на почту отправить письмо.', 'I am going to the post office to send a letter.'),
  a(4, '你去哪儿？', 'Nǐ qù nǎr?', 'Куда ты идёшь?', 'Where are you going?', '我 去 天安门 。', 'Wǒ qù Tiān’ān Mén.', 'Я иду на Тяньаньмэнь.', 'I am going to Tian’anmen.'),
  a(4, '今天星期几？', 'Jīntiān xīngqī jǐ?', 'Какой сегодня день недели?', 'What day of the week is it today?', '今天 星期四 。', 'Jīntiān xīngqīsì.', 'Сегодня четверг.', 'Today is Thursday.'),
  a(4, '你明天去学校吗？', 'Nǐ míngtiān qù xuéxiào ma?', 'Ты завтра идёшь в школу?', 'Are you going to school tomorrow?', '我 明天 去 学校 。', 'Wǒ míngtiān qù xuéxiào.', 'Я завтра иду в школу.', 'I am going to school tomorrow.', '明天 我 去 学校 。'),
  a(5, '这是谁？', 'Zhè shì shéi?', 'Кто это?', 'Who is this?', '这 是 王 老师 。', 'Zhè shì Wáng lǎoshī.', 'Это учитель Ван.', 'This is teacher Wang.'),
  a(5, '您身体好吗？', 'Nín shēntǐ hǎo ma?', 'Как ваше здоровье?', 'How is your health?', '我 身体 很 好 。', 'Wǒ shēntǐ hěn hǎo.', 'У меня хорошее здоровье.', 'I am in good health.'),
  a(5, '你喝茶吗？', 'Nǐ hē chá ma?', 'Будешь чай?', 'Will you have tea?', '我 不 喝 茶 。', 'Wǒ bù hē chá.', 'Я не буду чай.', 'I won’t have tea.'),
  a(6, '您贵姓？', 'Nín guìxìng?', 'Ваша фамилия?', 'What is your surname?', '我 姓 王 。', 'Wǒ xìng Wáng.', 'Моя фамилия Ван.', 'My surname is Wang.'),
  a(6, '你叫什么名字？', 'Nǐ jiào shénme míngzi?', 'Как тебя зовут?', 'What is your name?', '我 叫 张东 。', 'Wǒ jiào Zhāng Dōng.', 'Меня зовут Чжан Дун.', 'My name is Zhang Dong.'),
  a(6, '你是哪国人？', 'Nǐ shì nǎ guó rén?', 'Из какой ты страны?', 'Which country are you from?', '我 是 俄国 人 。', 'Wǒ shì Éguó rén.', 'Я из России.', 'I am from Russia.'),
  a(6, '这是什么书？', 'Zhè shì shénme shū?', 'Что это за книга?', 'What book is this?', '这 是 汉语 书 。', 'Zhè shì Hànyǔ shū.', 'Это книга на китайском.', 'It is a Chinese book.'),
  a(6, '他是谁？', 'Tā shì shéi?', 'Кто он?', 'Who is he?', '他 是 我 的 朋友 。', 'Tā shì wǒ de péngyou.', 'Он мой друг.', 'He is my friend.', '他 是 我 朋友 。'),
  a(7, '你吃什么？', 'Nǐ chī shénme?', 'Что ты будешь есть?', 'What will you eat?', '我 吃 饺子 。', 'Wǒ chī jiǎozi.', 'Я буду пельмени.', 'I will have dumplings.'),
  a(7, '你要几个包子？', 'Nǐ yào jǐ ge bāozi?', 'Сколько тебе баоцзы?', 'How many baozi do you want?', '我 要 三 个 包子 。', 'Wǒ yào sān ge bāozi.', 'Мне три баоцзы.', 'Three baozi for me.'),
  a(7, '你喝啤酒吗？', 'Nǐ hē píjiǔ ma?', 'Будешь пиво?', 'Will you have a beer?', '我 不 喝 啤酒 。', 'Wǒ bù hē píjiǔ.', 'Я не буду пиво.', 'I won’t have beer.'),
  a(7, '中午你去哪儿吃饭？', 'Zhōngwǔ nǐ qù nǎr chī fàn?', 'Где ты обедаешь?', 'Where are you having lunch?', '我 去 食堂 吃 饭 。', 'Wǒ qù shítáng chī fàn.', 'Я иду обедать в столовую.', 'I am going to the canteen to eat.'),
];

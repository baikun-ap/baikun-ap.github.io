import type { DialogueLine } from './midterm-paper';

/**
 * The 18 words the teacher said will be on the exam (the "Write the correct
 * 汉字" slide), practised in the five question types she listed: characters
 * from pinyin, pinyin from characters, make a sentence with a word, answer a
 * question in hanzi, choose a measure word. Example sentences use only words
 * of lessons 1–8.
 */

const ex = (zh: string, py: string, ru: string, en: string) => ({ zh, py, ru, en });
export type Example = ReturnType<typeof ex>;

export const EXAM_WORDS: { zh: string; py: string; ru: string; en: string; examples: Example[] }[] = [
  { zh: '汉语', py: 'Hànyǔ', ru: 'китайский язык', en: 'Chinese language', examples: [ex('我学习汉语。', 'Wǒ xuéxí Hànyǔ.', 'Я учу китайский.', 'I study Chinese.'), ex('汉语不太难。', 'Hànyǔ bú tài nán.', 'Китайский не очень трудный.', 'Chinese is not too hard.')] },
  { zh: '邮局', py: 'yóujú', ru: 'почта', en: 'post office', examples: [ex('我去邮局寄信。', 'Wǒ qù yóujú jì xìn.', 'Я иду на почту отправить письмо.', 'I am going to the post office to send a letter.'), ex('明天我去邮局。', 'Míngtiān wǒ qù yóujú.', 'Завтра я пойду на почту.', 'Tomorrow I will go to the post office.')] },
  { zh: '身体', py: 'shēntǐ', ru: 'здоровье; тело', en: 'health; body', examples: [ex('您身体好吗？', 'Nín shēntǐ hǎo ma?', 'Как ваше здоровье?', 'How is your health?'), ex('我身体很好。', 'Wǒ shēntǐ hěn hǎo.', 'У меня хорошее здоровье.', 'I am in good health.')] },
  { zh: '贵姓', py: 'guìxìng', ru: 'ваша фамилия (вежливо)', en: 'your surname (polite)', examples: [ex('请问，您贵姓？', 'Qǐngwèn, nín guìxìng?', 'Скажите, ваша фамилия?', 'Excuse me, what is your surname?'), ex('老师，您贵姓？', 'Lǎoshī, nín guìxìng?', 'Учитель, ваша фамилия?', 'Teacher, what is your surname?')] },
  { zh: '馒头', py: 'mántou', ru: 'маньтоу (паровая булочка)', en: 'mantou (steamed bun)', examples: [ex('我要两个馒头。', 'Wǒ yào liǎng ge mántou.', 'Мне две булочки маньтоу.', 'Two mantou for me.'), ex('我不吃馒头，我吃米饭。', 'Wǒ bù chī mántou, wǒ chī mǐfàn.', 'Я не ем маньтоу, я ем рис.', 'I don’t eat mantou, I eat rice.')] },
  { zh: '语法', py: 'yǔfǎ', ru: 'грамматика', en: 'grammar', examples: [ex('汉语语法不太难。', 'Hànyǔ yǔfǎ bú tài nán.', 'Грамматика китайского не очень трудная.', 'Chinese grammar is not too hard.'), ex('我学习汉语语法。', 'Wǒ xuéxí Hànyǔ yǔfǎ.', 'Я учу китайскую грамматику.', 'I study Chinese grammar.')] },
  { zh: '英语', py: 'Yīngyǔ', ru: 'английский язык', en: 'English', examples: [ex('我妹妹学英语。', 'Wǒ mèimei xué Yīngyǔ.', 'Моя сестра учит английский.', 'My younger sister studies English.'), ex('你学英语吗？', 'Nǐ xué Yīngyǔ ma?', 'Ты учишь английский?', 'Do you study English?')] },
  { zh: '银行', py: 'yínháng', ru: 'банк', en: 'bank', examples: [ex('我去银行取钱。', 'Wǒ qù yínháng qǔ qián.', 'Я иду в банк снять деньги.', 'I am going to the bank to get money.'), ex('今天我不去银行。', 'Jīntiān wǒ bú qù yínháng.', 'Сегодня я не пойду в банк.', 'Today I am not going to the bank.')] },
  { zh: '工作', py: 'gōngzuò', ru: 'работа; работать', en: 'work; to work', examples: [ex('我爸爸工作很忙。', 'Wǒ bàba gōngzuò hěn máng.', 'Папа очень занят на работе.', 'My dad is very busy at work.'), ex('你工作忙吗？', 'Nǐ gōngzuò máng ma?', 'Ты занят на работе?', 'Are you busy at work?')] },
  { zh: '米饭', py: 'mǐfàn', ru: 'варёный рис', en: 'cooked rice', examples: [ex('我要一碗米饭。', 'Wǒ yào yì wǎn mǐfàn.', 'Мне миску риса.', 'A bowl of rice for me.'), ex('中午我吃米饭。', 'Zhōngwǔ wǒ chī mǐfàn.', 'В обед я ем рис.', 'At noon I eat rice.')] },
  { zh: '啤酒', py: 'píjiǔ', ru: 'пиво', en: 'beer', examples: [ex('我不喝啤酒。', 'Wǒ bù hē píjiǔ.', 'Я не пью пиво.', 'I don’t drink beer.'), ex('你喝啤酒吗？', 'Nǐ hē píjiǔ ma?', 'Будешь пиво?', 'Will you have a beer?')] },
  { zh: '发音', py: 'fāyīn', ru: 'произношение', en: 'pronunciation', examples: [ex('汉语发音很难。', 'Hànyǔ fāyīn hěn nán.', 'Китайское произношение трудное.', 'Chinese pronunciation is hard.'), ex('你的发音很好。', 'Nǐ de fāyīn hěn hǎo.', 'У тебя хорошее произношение.', 'Your pronunciation is good.')] },
  { zh: '名字', py: 'míngzi', ru: 'имя', en: 'name', examples: [ex('你叫什么名字？', 'Nǐ jiào shénme míngzi?', 'Как тебя зовут?', 'What is your name?'), ex('他的名字叫大卫。', 'Tā de míngzi jiào Dàwèi.', 'Его зовут Давид.', 'His name is David.')] },
  { zh: '包子', py: 'bāozi', ru: 'баоцзы (пирожки)', en: 'baozi (steamed buns)', examples: [ex('我要三个包子。', 'Wǒ yào sān ge bāozi.', 'Мне три баоцзы.', 'Three baozi for me.'), ex('你吃包子吗？', 'Nǐ chī bāozi ma?', 'Будешь баоцзы?', 'Will you have baozi?')] },
  { zh: '请进', py: 'qǐng jìn', ru: 'входите, пожалуйста', en: 'come in, please', examples: [ex('请进！请坐！', 'Qǐng jìn! Qǐng zuò!', 'Входите! Садитесь!', 'Come in! Have a seat!'), ex('老师，请进！', 'Lǎoshī, qǐng jìn!', 'Учитель, входите!', 'Teacher, come in!')] },
  { zh: '要', py: 'yào', ru: 'хотеть; брать (при заказе)', en: 'to want; to have (when ordering)', examples: [ex('我要一碗汤。', 'Wǒ yào yì wǎn tāng.', 'Мне миску супа.', 'A bowl of soup for me.'), ex('你要什么？', 'Nǐ yào shénme?', 'Что ты будешь?', 'What will you have?')] },
  { zh: '吃', py: 'chī', ru: 'есть, кушать', en: 'to eat', examples: [ex('中午你吃什么？', 'Zhōngwǔ nǐ chī shénme?', 'Что ты ешь в обед?', 'What do you eat at noon?'), ex('我吃饺子。', 'Wǒ chī jiǎozi.', 'Я ем пельмени.', 'I eat dumplings.')] },
  { zh: '什么', py: 'shénme', ru: 'что, какой', en: 'what', examples: [ex('你学习什么？', 'Nǐ xuéxí shénme?', 'Что ты изучаешь?', 'What do you study?'), ex('这是什么书？', 'Zhè shì shénme shū?', 'Что это за книга?', 'What book is this?')] },
];

const s = ex;
const q = (zh: string, py: string, ok: string[], ...sample: Example[]): DialogueLine[] => [
  { who: 'A', zh, py },
  { who: 'B', blank: { ok, sample }, end: '。' },
];

/** Answer the questions — in hanzi. */
export const EXAM_QUESTIONS: DialogueLine[][] = [
  q('你学习什么？', 'Nǐ xuéxí shénme?', ['^(我)?学(习)?(汉语|英语|语法|汉语语法|汉字|发音|中文)$'], s('我学习汉语。', 'Wǒ xuéxí Hànyǔ.', 'Я учу китайский.', 'I study Chinese.')),
  q('你去哪儿？', 'Nǐ qù nǎr?', ['^(我)?去(邮局|银行|学校|食堂|天安门|北京)', '^(我)?回学校$'], s('我去邮局。', 'Wǒ qù yóujú.', 'Я иду на почту.', 'I am going to the post office.'), s('我去银行。', 'Wǒ qù yínháng.', 'Я иду в банк.', 'I am going to the bank.')),
  q('你去银行取钱吗？', 'Nǐ qù yínháng qǔ qián ma?', ['^(对|是|是的|不|不去)?我(不)?去(银行)?(取钱)?$', '^(对|是的?)$', '^(不|不去)我去(邮局|学校|食堂)'], s('对，我去银行取钱。', 'Duì, wǒ qù yínháng qǔ qián.', 'Да, я иду в банк снять деньги.', 'Yes, I am going to the bank to get money.'), s('不，我去邮局。', 'Bù, wǒ qù yóujú.', 'Нет, я иду на почту.', 'No, I am going to the post office.')),
  q('您贵姓？', 'Nín guìxìng?', ['^(我)?姓[\\p{Script=Han}]{1,2}$'], s('我姓王。', 'Wǒ xìng Wáng.', 'Моя фамилия Ван.', 'My surname is Wang.')),
  q('你叫什么名字？', 'Nǐ jiào shénme míngzi?', ['^(我)?叫[\\p{Script=Han}]{1,4}$', '^我的名字(叫|是)[\\p{Script=Han}]{1,4}$'], s('我叫马丁。', 'Wǒ jiào Mǎdīng.', 'Меня зовут Мартин.', 'My name is Martin.')),
  q('您身体好吗？', 'Nín shēntǐ hǎo ma?', ['^(我)?(身体)?(很|不太|不|挺)?好(谢谢)?(你呢|您呢)?$', '^(很好|不太好)(谢谢)?(您呢|你呢)?$'], s('我身体很好，谢谢！', 'Wǒ shēntǐ hěn hǎo, xièxie!', 'Здоровье хорошее, спасибо!', 'I am in good health, thank you!')),
  q('你工作忙吗？', 'Nǐ gōngzuò máng ma?', ['^(我)?(工作)?(很|不太|不|太|有点儿)忙(了)?(你呢)?$'], s('我工作很忙。', 'Wǒ gōngzuò hěn máng.', 'Я очень занят на работе.', 'I am very busy at work.'), s('我工作不太忙。', 'Wǒ gōngzuò bú tài máng.', 'На работе я не очень занят.', 'I am not too busy at work.')),
  q('中午你吃什么？', 'Zhōngwǔ nǐ chī shénme?', ['^(中午)?(我)?(吃|要)[\\p{Script=Han}]{1,8}$'], s('我吃米饭。', 'Wǒ chī mǐfàn.', 'Я ем рис.', 'I eat rice.'), s('我吃包子。', 'Wǒ chī bāozi.', 'Я ем баоцзы.', 'I eat baozi.')),
  q('你吃馒头吗？', 'Nǐ chī mántou ma?', ['^(我)?(不)?吃(馒头)?$', '^(我)?不吃馒头(我)?吃[\\p{Script=Han}]{1,4}$'], s('我不吃馒头，我吃米饭。', 'Wǒ bù chī mántou, wǒ chī mǐfàn.', 'Я не ем маньтоу, я ем рис.', 'I don’t eat mantou, I eat rice.'), s('我吃馒头。', 'Wǒ chī mántou.', 'Я ем маньтоу.', 'I eat mantou.')),
  q('你喝啤酒吗？', 'Nǐ hē píjiǔ ma?', ['^(我)?(不)?喝(啤酒|酒)?$', '^(我)?不喝(啤)?酒(我)?喝[\\p{Script=Han}]{1,4}$'], s('我不喝啤酒。', 'Wǒ bù hē píjiǔ.', 'Я не пью пиво.', 'I don’t drink beer.'), s('我不喝酒，我喝茶。', 'Wǒ bù hē jiǔ, wǒ hē chá.', 'Я не пью алкоголь, я пью чай.', 'I don’t drink alcohol, I drink tea.')),
  q('你要几个包子？', 'Nǐ yào jǐ ge bāozi?', ['^(我)?要[一二两三四五六七八九十]个(包子)?$'], s('我要三个包子。', 'Wǒ yào sān ge bāozi.', 'Мне три баоцзы.', 'Three baozi for me.')),
  q('汉语语法难吗？', 'Hànyǔ yǔfǎ nán ma?', ['^(汉语)?(语法)?(很|不太|不|太|有点儿)难(了)?$'], s('汉语语法不太难。', 'Hànyǔ yǔfǎ bú tài nán.', 'Грамматика китайского не очень трудная.', 'Chinese grammar is not too hard.')),
  q('汉语发音难吗？', 'Hànyǔ fāyīn nán ma?', ['^(汉语)?(发音)?(很|不太|不|太|有点儿)难(了)?$'], s('汉语发音很难。', 'Hànyǔ fāyīn hěn nán.', 'Китайское произношение трудное.', 'Chinese pronunciation is hard.')),
  q('你学英语吗？', 'Nǐ xué Yīngyǔ ma?', ['^(我)?(不)?学(习)?(英语)?$', '^(我)?不学(习)?英语(我)?学(习)?汉语$'], s('我不学英语，我学汉语。', 'Wǒ bù xué Yīngyǔ, wǒ xué Hànyǔ.', 'Я не учу английский, я учу китайский.', 'I don’t study English, I study Chinese.')),
  q('你要什么？', 'Nǐ yào shénme?', ['^(我)?要[\\p{Script=Han}]{1,8}$'], s('我要一碗米饭。', 'Wǒ yào yì wǎn mǐfàn.', 'Мне миску риса.', 'A bowl of rice for me.')),
];

/** Choose the correct measure word: the slide's food words and the test's own items. */
export const EXAM_MEASURE = [
  { n: '一', noun: '米饭', py: 'yì wǎn mǐfàn', ru: 'миска риса', en: 'a bowl of rice', ok: ['碗'] },
  { n: '三', noun: '包子', py: 'sān ge bāozi', ru: 'три баоцзы', en: 'three baozi', ok: ['个'] },
  { n: '两', noun: '馒头', py: 'liǎng ge mántou', ru: 'две маньтоу', en: 'two mantou', ok: ['个'] },
  { n: '四', noun: '啤酒', py: 'sì píng píjiǔ', ru: 'четыре бутылки пива', en: 'four bottles of beer', ok: ['瓶', '杯'] },
  { n: '一', noun: '汉语书', py: 'yì běn Hànyǔ shū', ru: 'один учебник китайского', en: 'one Chinese book', ok: ['本'] },
  { n: '一', noun: '汤', py: 'yì wǎn tāng', ru: 'миска супа', en: 'a bowl of soup', ok: ['碗'] },
  { n: '两', noun: '苹果', py: 'liǎng jīn píngguǒ', ru: 'два цзиня яблок', en: 'two jin of apples', ok: ['斤', '个'] },
  { n: '五', noun: '咖啡', py: 'wǔ bēi kāfēi', ru: 'пять чашек кофе', en: 'five cups of coffee', ok: ['杯'] },
  { n: '三', noun: '笔', py: 'sān zhī bǐ', ru: 'три ручки', en: 'three pens', ok: ['支'] },
  { n: '四', noun: '饺子', py: 'sì pán jiǎozi', ru: 'четыре тарелки пельменей', en: 'four plates of dumplings', ok: ['盘'] },
];

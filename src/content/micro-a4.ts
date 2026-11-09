import type { MicroQ } from './micro';

/** Assignment Four — Chapter 4, The Market Forces of Supply and Demand (Mankiw). */
const MARKET = ['Equilibrium price and quantity increase', 'Equilibrium price and quantity decrease', 'The equilibrium price rises, while the equilibrium quantity decreases', 'The equilibrium price decreases, while the equilibrium quantity increases', 'None of the above'];
const GAP = ['There is a surplus, and the price will rise', 'There is a surplus, and the price will fall', 'There is a shortage, and the price will rise', 'There is a shortage, and the price will fall', 'The quantity demanded is equal to the quantity supplied, and the price remains the same'];

export const A4: MicroQ[] = [
  {
    id: 'a4-1', q: 'A change in which of the following will NOT shift the demand curve for hamburgers?',
    ru: 'Изменение чего НЕ сдвигает кривую спроса на гамбургеры?',
    options: ['the price of hot dogs', 'the price of hamburgers', 'the price of hamburger buns', 'the income of hamburger consumers'],
    answer: 1,
    explain: 'Цена самого товара даёт движение вдоль кривой (change in quantity demanded), а не её сдвиг. Цены хот-догов (substitute), булочек (complement) и доходы сдвигают спрос.',
  },
  {
    id: 'a4-2', q: 'An increase in ________ will cause a movement along a given demand curve, which is called a change in ________.',
    ru: 'Рост ___ вызывает движение вдоль данной кривой спроса, это называется изменением ___.',
    options: ['supply, demand', 'supply, quantity demanded', 'demand, supply', 'demand, quantity supplied'],
    answer: 1,
    explain: 'Если сдвигается предложение, цена меняется, и покупатели двигаются вдоль кривой спроса: это change in quantity demanded, а не change in demand.',
  },
  {
    id: 'a4-3', q: 'Movie tickets and DVDs are substitutes. If the price of DVDs increases, what happens in the market for movie tickets?',
    ru: 'Билеты в кино и DVD — заменители. Если DVD дорожают, что с рынком билетов?',
    options: ['The supply curve shifts to the left.', 'The supply curve shifts to the right.', 'The demand curve shifts to the left.', 'The demand curve shifts to the right.'],
    answer: 3,
    explain: 'Substitutes: заменитель подорожал, люди переходят на билеты, и спрос на билеты растёт (сдвиг вправо).',
  },
  {
    id: 'a4-4', q: 'The discovery of a large new reserve of crude oil will shift the ________ curve for gasoline, leading to a ________ equilibrium price.',
    ru: 'Открытие большого месторождения нефти сдвигает кривую ___ бензина, и равновесная цена становится ___.',
    options: ['supply, higher', 'supply, lower', 'demand, higher', 'demand, lower'],
    answer: 1,
    explain: 'Нефть — сырьё (input) для бензина. Она дешевеет, предложение бензина растёт (сдвиг вправо), цена падает.',
  },
  {
    id: 'a4-5', q: 'If the economy goes into a recession and incomes fall, what happens in the markets for inferior goods?',
    ru: 'Рецессия, доходы падают. Что происходит на рынках инфериорных (низших) товаров?',
    options: ['Prices and quantities both rise.', 'Prices and quantities both fall.', 'Prices rise, quantities fall.', 'Prices fall, quantities rise.'],
    answer: 0,
    explain: 'Inferior good: доход падает, а спрос растёт (люди переходят на дешёвое). Спрос вправо, значит и цена, и количество растут.',
  },
  {
    id: 'a4-6', q: 'Which of the following might lead to an increase in the equilibrium price of jelly and a decrease in the equilibrium quantity of jelly sold?',
    ru: 'Что может поднять равновесную цену джема и снизить равновесное количество?',
    options: ['an increase in the price of peanut butter, a complement to jelly', 'an increase in the price of Marshmallow Fluff, a substitute for jelly', 'an increase in the price of grapes, an input into jelly', 'an increase in consumers\' incomes, as long as jelly is a normal good'],
    answer: 2,
    explain: 'Цена вверх, количество вниз — это уменьшение предложения. Виноград (сырьё) подорожал, предложение джема сдвигается влево. A сдвигает спрос влево (цена падает), B и D — спрос вправо (количество растёт).',
  },
  {
    id: 'a4-7', q: 'Which of the following events causes the demand curve for watches to shift to the right?',
    ru: 'Что сдвигает кривую спроса на часы вправо?',
    options: ['The price of watches decreases.', 'If watches are normal goods, consumers\' incomes decrease.', 'If watch batteries are complementary to watches, the price of watch batteries decreases.', 'The price of watches rises.', 'None of the above.'],
    answer: 2,
    explain: 'Батарейки — complement. Они дешевеют, часы пользоваться выгоднее, спрос растёт. Изменение цены самих часов (A, D) — движение вдоль кривой. Падение дохода для normal good сдвигает спрос влево.',
  },
  {
    id: 'a4-8', q: 'The following items all shift the supply curve of watches to the right, EXCEPT for ______.',
    ru: 'Всё перечисленное сдвигает предложение часов вправо, КРОМЕ…',
    options: ['The price of watches has increased', 'Technological advancements used in the manufacture of watches', 'Decrease in wages for workers used to make watches', 'The manufacturer expects the price of watches to decrease in the future', 'All of the above have caused an increase in the supply of watches'],
    answer: 0,
    explain: 'Рост цены самих часов — движение вдоль кривой предложения (change in quantity supplied), а не сдвиг. Технологии и дешёвый труд снижают издержки. Если цена завтра упадёт, выгоднее продать сегодня, поэтому предложение сегодня растёт.',
  },
  {
    id: 'a4-9', q: 'If the price of a good is higher than the equilibrium price, ______.',
    ru: 'Если цена выше равновесной…',
    options: GAP, answer: 1,
    explain: 'Цена выше равновесия: продавцы хотят продать больше, чем покупатели купить, — surplus (излишек). Продавцы снижают цену.',
  },
  {
    id: 'a4-10', q: 'If the price of a good is lower than the equilibrium price, ______.',
    ru: 'Если цена ниже равновесной…',
    options: GAP, answer: 2,
    explain: 'Цена ниже равновесия: покупателям нужно больше, чем есть, — shortage (дефицит). Цена растёт.',
  },
  {
    id: 'a4-11', q: 'If the price of a good is equal to the equilibrium price, ______.',
    ru: 'Если цена равна равновесной…',
    options: GAP, answer: 4,
    explain: 'В равновесии quantity demanded = quantity supplied, давления на цену нет.',
  },
  {
    id: 'a4-12', q: 'An increase in demand for a good (the demand curve shifts to the right) will cause ______.',
    ru: 'Рост спроса (кривая спроса вправо) приведёт к тому, что…',
    options: MARKET, answer: 0,
    explain: 'Спрос вправо по неподвижной кривой предложения: цена и количество растут.',
  },
  {
    id: 'a4-13', q: 'A decrease in the supply of a good (the supply curve shifts to the left) will cause ______.',
    ru: 'Сокращение предложения (кривая предложения влево) приведёт к тому, что…',
    options: MARKET, answer: 2,
    explain: 'Предложение влево по неподвижной кривой спроса: цена растёт, количество падает.',
  },
  {
    id: 'a4-14', q: 'Suppose the supply and demand for personal computers increase. In the PC market, we can expect ______.',
    ru: 'Спрос и предложение компьютеров растут одновременно. Что ожидать?',
    options: ['The equilibrium quantity increases, and the equilibrium price rises', 'The equilibrium quantity increases and the equilibrium price decreases', 'The equilibrium quantity increases and the equilibrium price remains the same', 'The equilibrium quantity increases, and the change in the equilibrium price cannot be determined', 'The change in equilibrium quantity is uncertain, and the equilibrium price rises'],
    answer: 3,
    explain: 'Оба сдвига вправо увеличивают количество. Цену спрос тянет вверх, а предложение вниз, поэтому без размеров сдвигов её изменение не определить.',
  },
  {
    id: 'a4-15', q: 'Suppose the supply and demand for personal computers increase. Then assume that the increase in the supply of personal computers is greater than the increase in the demand for personal computers. In the PC market, we can expect ______.',
    ru: 'Спрос и предложение компьютеров растут, причём предложение растёт сильнее. Что ожидать?',
    options: ['The equilibrium quantity increases, and the equilibrium price rises', 'The equilibrium quantity increases and the equilibrium price decreases', 'The equilibrium quantity increases and the equilibrium price is maintained', 'The equilibrium quantity increases, and the change in the equilibrium price cannot be determined', 'The change in equilibrium quantity is uncertain, and the equilibrium price decreases'],
    answer: 1,
    explain: 'Количество растёт в любом случае. Предложение сдвинулось сильнее и «перетягивает» цену вниз.',
  },
  {
    id: 'a4-16', q: 'Which of the following statements about the impact of an increase in the price of lettuce is correct?',
    ru: 'Что верно о последствиях подорожания салата-латука?',
    options: ['The demand for lettuce will decrease.', 'The supply of lettuce will decrease.', 'The equilibrium price and quantity of salad dressing will increase.', 'The equilibrium price and quantity of salad dressing will decrease.', 'Both A and B are correct.'],
    answer: 3,
    explain: 'Латук и салатная заправка — complements. Латук дорожает, салатов едят меньше, спрос на заправку падает, и её цена и количество снижаются. Рост цены латука — движение вдоль его кривых, а не сдвиг спроса или предложения (A и B неверны).',
  },
  {
    id: 'a4-17', q: 'Suppose a frost destroys the orange harvest in Florida. At the same time, suppose that consumer tastes shift toward orange juice. What do we expect to happen to equilibrium price and quantity in the orange juice market?',
    ru: 'Мороз уничтожил урожай апельсинов, а вкусы сместились в пользу апельсинового сока. Что с ценой и количеством сока?',
    options: ['The price will rise, and the quantity is uncertain.', 'The price will rise and the quantity will increase.', 'The price will rise and the quantity will decrease.', 'The price will fall and the quantity is uncertain.', 'The impact on price and quantity is uncertain.'],
    answer: 0,
    explain: 'Мороз сдвигает предложение влево, вкусы сдвигают спрос вправо. Оба сдвига поднимают цену, а количество один тянет вниз, другой вверх, поэтому оно неопределённо.',
  },
  {
    id: 'a4-18', q: 'Suppose consumer tastes shift toward apple consumption. Which of the following correctly describes the impact of this event on the apple market?',
    ru: 'Вкусы сместились в пользу яблок. Как это влияет на рынок яблок?',
    options: ['The demand for apples increases, and the supply of apples increases.', 'Both the demand and supply of apples increase.', 'The demand for apples increases, while the supply of apples remains unchanged.', 'The demand for apples decreases, while the supply of apples remains unchanged.', 'The demand for apples decreases, and the supply of apples increases.'],
    answer: 2,
    explain: 'Вкусы (tastes) — фактор спроса, спрос растёт. Предложение не сдвигается: продают больше только из-за роста цены, это движение вдоль кривой (quantity supplied).',
  },
  {
    id: 'a4-19', q: 'Suppose both buyers and sellers of wheat expect wheat prices to rise in the near future. What do we expect to see in equilibrium price and quantity in the wheat market today?',
    ru: 'И покупатели, и продавцы пшеницы ждут роста цен. Что с ценой и количеством сегодня?',
    options: ['The impact on price and quantity is uncertain.', 'The price will rise, and the quantity is uncertain.', 'The price will rise and the quantity will increase.', 'The price will rise and the quantity will decrease.', 'The price will fall and the quantity is uncertain.'],
    answer: 1,
    explain: 'Покупатели спешат купить сейчас — спрос сегодня растёт. Продавцы придерживают товар до подорожания — предложение сегодня падает. Цена точно растёт, количество неопределённо.',
  },
  {
    id: 'a4-20', q: 'Inferior goods are goods for which an increase in income causes ______.',
    ru: 'Инфериорные товары — это товары, для которых рост дохода вызывает…',
    options: ['Supply to increase', 'Supply to decrease', 'Demand to increase', 'Demand to decrease'],
    answer: 3,
    explain: 'Определение inferior good: доход растёт, а спрос падает (например, автобус вместо такси). У normal good наоборот.',
  },
];

// Persisted slot IDs stay attached to each drink independently of display order.
const groups = [
  { role: '摸魚大師', code: '02', color: '#16e0bc' },
  { role: '高級牛馬', code: '01', color: '#23a7ff' },
  { role: '畫餅充飢', code: '03', color: '#a861ff' },
  { role: '人生勝利組', code: '04', color: '#ff7048' },
];
// Names originated in the menu sheet; ingredients and prices confirmed by the owner.
// Public ingredient names only; quantities and preparation notes are omitted.
// Default intensity is first/light, second/medium, third/strong; explicit recipe levels override it.
const recipes: Record<string, Array<{ name: string; englishName: string; englishIngredients: string[]; slot: number; ingredients: string[]; price: number; alcoholLevel?: number }>> = {
  "01": [
    {
      "name": "精緻窮",
      "ingredients": [
        "伏特加",
        "桂花",
        "洛神",
        "葡萄",
        "香草"
      ],
      "price": 380,
      "slot": 1,
      "englishName": "Broke in Style",
      "englishIngredients": [
        "Vodka",
        "Osmanthus",
        "Roselle",
        "Grape",
        "Vanilla"
      ]
    },
    {
      "name": "高規格加班",
      "ingredients": [
        "伏特加",
        "咖啡",
        "巧克力",
        "Redbull",
        "櫻桃"
      ],
      "price": 430,
      "slot": 2,
      "englishName": "Overtime Deluxe",
      "englishIngredients": [
        "Vodka",
        "Coffee",
        "Chocolate",
        "Red Bull",
        "Cherry"
      ]
    },
    {
      "name": "KPI壓頂",
      "ingredients": [
        "Gin",
        "黑醋栗",
        "火焰艾碧斯",
        "蔓越莓"
      ],
      "price": 430,
      "slot": 3,
      "englishName": "Crushed by KPIs",
      "englishIngredients": [
        "Gin",
        "Blackcurrant",
        "Flaming Absinthe",
        "Cranberry"
      ]
    }
  ],
  "02": [
    {
      "name": "切換分頁",
      "ingredients": [
        "深色蘭姆酒",
        "水蜜桃",
        "草莓",
        "香草",
        "月桃花",
        "佛手柑",
        "牛奶"
      ],
      "price": 400,
      "slot": 1,
      "englishName": "Alt + Tab",
      "englishIngredients": [
        "Dark Rum",
        "Peach",
        "Strawberry",
        "Vanilla",
        "Shell Ginger Flower",
        "Bergamot",
        "Milk"
      ]
    },
    {
      "name": "薪水小偷",
      "ingredients": [
        "蘇格蘭威士忌",
        "紅心芭樂",
        "覆盆莓",
        "焦糖",
        "杏仁",
        "柳橙"
      ],
      "price": 420,
      "slot": 2,
      "englishName": "Wage Thief",
      "englishIngredients": [
        "Scotch Whisky",
        "Pink Guava",
        "Raspberry",
        "Caramel",
        "Almond",
        "Orange"
      ]
    },
    {
      "name": "帶薪如廁",
      "ingredients": [
        "梅茲卡爾",
        "梅干菜",
        "羅望子",
        "焙茶"
      ],
      "price": 480,
      "slot": 3,
      "englishName": "Paid Bathroom Break",
      "englishIngredients": [
        "Mezcal",
        "Preserved Mustard Greens",
        "Tamarind",
        "Hojicha"
      ]
    }
  ],
  "03": [
    {
      "name": "上市敲鐘",
      "ingredients": [
        "琴酒",
        "烏龍茶",
        "接骨木花",
        "梅酒",
        "萬壽菊",
        "希臘無糖優格",
        "葡萄柚蘇打水"
      ],
      "price": 400,
      "slot": 1,
      "englishName": "Ring the IPO Bell",
      "englishIngredients": [
        "Gin",
        "Oolong Tea",
        "Elderflower",
        "Plum Wine",
        "Marigold",
        "Unsweetened Greek Yogurt",
        "Grapefruit Soda"
      ]
    },
    {
      "name": "明年幫你加薪",
      "ingredients": [
        "波本威士忌",
        "哈密瓜",
        "餅乾",
        "苦瓜"
      ],
      "price": 420,
      "slot": 2,
      "englishName": "A Raise Next Year",
      "englishIngredients": [
        "Bourbon Whiskey",
        "Cantaloupe",
        "Cookie",
        "Bitter Melon"
      ]
    },
    {
      "name": "當自己家",
      "ingredients": [
        "深色蘭姆酒",
        "芒果",
        "紅豆",
        "豆腐乳",
        "甜米釀"
      ],
      "price": 450,
      "slot": 3,
      "englishName": "Make Yourself at Company",
      "englishIngredients": [
        "Dark Rum",
        "Mango",
        "Red Bean",
        "Fermented Tofu",
        "Sweet Fermented Rice"
      ]
    }
  ],
  "04": [
    {
      "name": "財富自由",
      "alcoholLevel": 1,
      "ingredients": [
        "蘭姆酒",
        "百香果",
        "白可可",
        "香蕉",
        "鳳梨",
        "夏威夷果仁"
      ],
      "price": 400,
      "slot": 2,
      "englishName": "Financial Freedom",
      "englishIngredients": [
        "Rum",
        "Passion Fruit",
        "White Cocoa",
        "Banana",
        "Pineapple",
        "Macadamia"
      ]
    },
    {
      "name": "富二代",
      "alcoholLevel": 2,
      "ingredients": [
        "琴酒",
        "白山茶花",
        "紫蘇",
        "野薑花",
        "麗葉酒"
      ],
      "price": 420,
      "slot": 1,
      "englishName": "Trust Fund Baby",
      "englishIngredients": [
        "Gin",
        "White Camellia",
        "Shiso",
        "White Ginger Lily",
        "Lillet"
      ]
    },
    {
      "name": "金湯匙",
      "ingredients": [
        "龍舌蘭",
        "松露",
        "刺蔥",
        "蜂蜜"
      ],
      "price": 480,
      "slot": 3,
      "englishName": "Born with a Golden Spoon",
      "englishIngredients": [
        "Tequila",
        "Truffle",
        "Prickly Ash",
        "Honey"
      ]
    }
  ]
};
export const drinks = groups.flatMap(group => recipes[group.code].map((recipe, index) => ({
  ...group, id: `role-${group.code}-drink-${recipe.slot}`, number: index + 1,
  ...recipe, category: `${group.code} · ${group.role}專屬`,
  description: recipe.ingredients.join('、'),
  alcoholIntensity: ['酒輕', '酒中', '酒重'][(recipe.alcoholLevel ?? index + 1) - 1],
  alcoholLevel: recipe.alcoholLevel ?? index + 1,
})));
export type ExplorationRecord = {
  drinkId: string; status: 'pending' | 'completed' | 'revoked';
  requestedAt: string; confirmedAt: string | null; confirmedBy: string | null; revision: number;
};
export type Exploration = {
  memberId: string; records: ExplorationRecord[]; completed: number; total: number;
  voucher: { code: string; redeemedAt: string | null; eligible: boolean } | null;
};
export const explorationLabel = (status?: string) => status === 'completed' ? '已探索' : status === 'pending' ? '待確認' : '未解鎖';
export function uniformInt(size: number): number {
  if (!Number.isInteger(size) || size < 1 || size > 256) throw new Error('Invalid sample size');
  const limit = 256 - 256 % size;
  let value: number;
  do { value = crypto.getRandomValues(new Uint8Array(1))[0]; } while (value >= limit);
  return value % size;
}
// Each accepted ordered pair is equally likely. For twelve drinks each has
// exactly three of the 36 pairs. Reject surplus pairs for filtered pools.
export function rollMenuDice(count: number, random = uniformInt) {
  if (!Number.isInteger(count) || count < 1 || count > drinks.length) throw new Error('No eligible drinks');
  const limit = 36 - 36 % count;
  let pair: number;
  do { pair = random(6) * 6 + random(6); } while (pair >= limit);
  return { dice: [Math.floor(pair / 6) + 1, pair % 6 + 1], index: pair % count };
}

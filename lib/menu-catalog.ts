// Stable IDs belong to the existing twelve menu slots, even when names are finalized.
const groups = [
  { role: '高級牛馬', code: '01', color: '#23a7ff' },
  { role: '摸魚大師', code: '02', color: '#16e0bc' },
  { role: '人生勝利組', code: '04', color: '#ff7048' },
  { role: '畫餅充飢', code: '03', color: '#a861ff' },
];
// Source: 2026 酒單架構整理 / for chatgpt, rows 2–13.
// Public ingredient names only; quantities and preparation notes are omitted.
// Alcohol intensity follows the owner's rule: first/light, second/medium, third/strong.
const recipes: Record<string, Array<{ name: string; ingredients: string[] }>> = {
  "01": [
    {
      "name": "精緻窮",
      "ingredients": [
        "桂花 infused 伏特加",
        "洛神 Acid",
        "桂花 syrup",
        "葡萄利口酒",
        "香草苦精"
      ]
    },
    {
      "name": "高規格加班",
      "ingredients": [
        "咖啡 infuse 伏特加",
        "Chocolate bitter",
        "Redbull Syrup",
        "Heering",
        "Aer",
        "chocolate liqueur"
      ]
    },
    {
      "name": "KPI壓頂",
      "ingredients": [
        "甘草 infused Gin",
        "Merlet 黑醋栗",
        "Fruko 紅",
        "蔓越莓苦精",
        "Acid Blended",
        "syrup"
      ]
    }
  ],
  "02": [
    {
      "name": "切換分頁",
      "ingredients": [
        "Dark Rum",
        "Merlet 水蜜桃",
        "草莓果泥",
        "月桃花純露",
        "香草糖漿",
        "Scrappy's lime bitter",
        "佛手柑",
        "牛奶"
      ]
    },
    {
      "name": "薪水小偷",
      "ingredients": [
        "威士忌",
        "紅心芭樂果泥",
        "Almond bitter",
        "覆盆莓利口酒",
        "焦糖糖漿",
        "lemon juice",
        "orange juice",
        "orange bitter",
        "cream cheese"
      ]
    },
    {
      "name": "帶薪如廁",
      "ingredients": [
        "梅乾菜 infuse Mezcal",
        "羅望子 Syrup",
        "焙茶 liqueur",
        "Scrappy's Fire Tincture",
        "Orange bitter"
      ]
    }
  ],
  "03": [
    {
      "name": "上市敲鐘",
      "ingredients": [
        "烏龍茶 infused Gin",
        "Giffard Elderflower",
        "Lillet",
        "梅酒",
        "萬壽菊純露",
        "Greek Yogurt",
        "lemon juice",
        "syrup",
        "Grapefruit Soda"
      ]
    },
    {
      "name": "明年幫你加薪",
      "ingredients": [
        "Bianco",
        "Fermented 苦瓜",
        "哈密瓜利口酒",
        "波本威士忌",
        "餅乾利口酒",
        "lemon juice",
        "syrup",
        "hibiki bitter"
      ]
    },
    {
      "name": "當自己家",
      "ingredients": [
        "Dark Rum",
        "A&H Mango",
        "Dover 小豆",
        "Monin 紅豆",
        "豆腐乳",
        "甜米釀",
        "angus bitter"
      ]
    }
  ],
  "04": [
    {
      "name": "富二代",
      "ingredients": [
        "椰子 Soda",
        "Gin infused 白山茶花",
        "Dover 紫蘇",
        "Lillet",
        "野薑花純露",
        "syrup"
      ]
    },
    {
      "name": "財富自由",
      "ingredients": [
        "Rum",
        "passion fruit liqueur",
        "Giffard White Cocoa",
        "香蕉果泥",
        "鳳梨汁",
        "夏威夷果糖漿",
        "Lime Juice"
      ]
    },
    {
      "name": "金湯匙",
      "ingredients": [
        "Tequila reposado fat-wash Truffle Sauce",
        "Honey",
        "刺蔥利口酒",
        "Umami bitters",
        "Walnut bitters"
      ]
    }
  ]
};
export const drinks = groups.flatMap(group => recipes[group.code].map((recipe, index) => ({
  ...group, id: `role-${group.code}-drink-${index + 1}`, number: index + 1,
  ...recipe, category: `${group.code} · ${group.role}專屬`,
  description: recipe.ingredients.join('、'),
  alcoholIntensity: ['酒輕', '酒中', '酒重'][index],
  alcoholLevel: index + 1,
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

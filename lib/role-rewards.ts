// Shared by all four roles, for both guests and members.
export const roleRewards = [
  {
    "label": "點該系列任一杯調酒即獲得一杯Shot",
    "weight": 50
  },
  {
    "label": "點同系列調酒第二杯9折（以低價者計）",
    "weight": 20
  },
  {
    "label": "點同系列調酒第二杯7折（以低價者計）",
    "weight": 7
  },
  {
    "label": "點同系列調酒第二杯5折（以低價者計）",
    "weight": 3
  },
  {
    "label": "招待老闆喝一杯shot",
    "weight": 5
  },
  {
    "label": "點該系列任一杯調酒即可獲得純酒Shot一杯（Vodka/Gin/Rum/Tequila任選一杯）",
    "weight": 14
  },
  {
    "label": "點同系列調酒第二杯免費（以低價者計）",
    "weight": 1
  }
] as const;

export function chooseReward(randomByte = () => crypto.getRandomValues(new Uint8Array(1))[0]) {
  // Accept 0..199 only: each percentile has exactly two equally likely byte values.
  let value: number;
  do { value = randomByte(); } while (value >= 200);
  const roll = value % 100;
  let cursor = 0;
  for (const reward of roleRewards) {
    cursor += reward.weight;
    if (roll < cursor) return reward.label;
  }
  throw new Error('Reward weights must total 100');
}

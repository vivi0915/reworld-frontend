// Stable IDs belong to the existing twelve menu slots, even when names are finalized.
const groups = [
  { role: '高級牛馬', code: '01', color: '#23a7ff' },
  { role: '摸魚大師', code: '02', color: '#16e0bc' },
  { role: '人生勝利組', code: '04', color: '#ff7048' },
  { role: '畫餅充飢', code: '03', color: '#a861ff' },
];
export const drinks = groups.flatMap(group => [1, 2, 3].map(number => ({
  ...group, id: `role-${group.code}-drink-${number}`, number,
  name: `${group.role} ${number}`, category: `${group.code} · ${group.role}專屬`,
  description: '酒名、風味與價格待確認。',
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

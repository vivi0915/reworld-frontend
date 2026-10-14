import { ApiError, database } from './member-auth';
import { drinks, type Exploration, type ExplorationRecord } from './menu-catalog';

export function drinkId(value: unknown) {
  if (typeof value !== 'string' || !drinks.some(drink => drink.id === value)) throw new ApiError(400, '酒款不存在。');
  return value;
}
export async function exploration(memberId: string): Promise<Exploration> {
  // One read snapshot keeps counts and voucher eligibility consistent during staff updates.
  const row = await database().prepare(`SELECT
    (SELECT json_group_array(json_object('drinkId',drink_id,'status',status,'requestedAt',requested_at,'confirmedAt',confirmed_at,'confirmedBy',confirmed_by,'revision',revision)) FROM menu_explorations WHERE member_id=?) AS records,
    (SELECT json_object('code',code,'redeemedAt',redeemed_at) FROM menu_vouchers WHERE member_id=?) AS voucher`).bind(memberId, memberId).first<{ records: string; voucher: string | null }>();
  const records = JSON.parse(row?.records || '[]') as ExplorationRecord[];
  const completed = records.filter(record => record.status === 'completed').length;
  const voucher = row?.voucher ? JSON.parse(row.voucher) as { code: string; redeemedAt: string | null } : null;
  return { memberId, records, completed, total: drinks.length, voucher: voucher ? { ...voucher, eligible: completed === drinks.length } : null };
}

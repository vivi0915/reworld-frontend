import { ApiError, apiError, database, json, rateLimit, readBody, requireMember } from '@/lib/member-auth';
export async function POST(request: Request) {
  try {
    const body = await readBody(request);
    const member = await requireMember(request);
    if (typeof body.claimId !== 'string' || body.claimId.length > 64) throw new ApiError(400, 'REWARD NOT FOUND');
    await rateLimit(request, member.id, 'reward-claim');
    const db = database();
    // Only a previously server-issued entitlement can be claimed. The client
    // cannot supply the reward, verification requirement, user or unlock status.
    const entitlement = await db.prepare('SELECT c.reward_key, c.status, r.requires_phone_verification, r.one_time FROM reward_claims c JOIN reward_definitions r ON r.reward_key = c.reward_key WHERE c.id = ? AND c.user_id = ?').bind(body.claimId, member.id).first<{ reward_key: string; status: string; requires_phone_verification: number; one_time: number }>();
    if (!entitlement) throw new ApiError(404, 'REWARD NOT FOUND');
    if (!['available', 'unlocked'].includes(entitlement.status)) throw new ApiError(409, 'REWARD ALREADY CLAIMED OR EXPIRED');
    if (entitlement.requires_phone_verification && !member.phoneVerifiedAt) return json({ error: 'VERIFY PLAYER TO CLAIM', code: 'PHONE_VERIFICATION_REQUIRED' }, 403);
    // Account identity is stable: verified phones cannot be moved between users.
    // The unique lock and claim update share a transaction, including races.
    const statements = [];
    if (entitlement.one_time) statements.push(db.prepare('INSERT OR IGNORE INTO reward_claim_locks(user_id,reward_key,claim_id) VALUES(?,?,?)').bind(member.id, entitlement.reward_key, body.claimId));
    statements.push(db.prepare("UPDATE reward_claims SET status = 'claimed', claimed_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ? AND status IN ('available','unlocked') AND EXISTS(SELECT 1 FROM members WHERE id = ? AND status = 'active' AND (? = 0 OR phone_verified_at IS NOT NULL)) AND (? = 0 OR EXISTS(SELECT 1 FROM reward_claim_locks WHERE user_id = ? AND reward_key = ? AND claim_id = ?)) RETURNING id").bind(body.claimId, member.id, member.id, entitlement.requires_phone_verification, entitlement.one_time, member.id, entitlement.reward_key, body.claimId));
    const results = await db.batch(statements);
    if (!results.at(-1)?.results.length) throw new ApiError(409, 'REWARD ALREADY CLAIMED OR UNAVAILABLE');
    return json({ ok: true, status: 'CLAIM SUCCESS' });
  } catch (error) { return apiError(error); }
}

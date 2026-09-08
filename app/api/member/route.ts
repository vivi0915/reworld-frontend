import { apiError, currentMember, database, json, profile, readBody, requireMember } from "@/lib/member-auth";
export async function GET(request: Request) {
  try { return json({ member: await currentMember(request) }); }
  catch (error) { return apiError(error); }
}
export async function PATCH(request: Request) {
  try {
    const body = await readBody(request);
    const member = await requireMember(request);
    const details = profile(body);
    await database().prepare("UPDATE members SET display_name = ?, phone = ?, email = ? WHERE id = ?").bind(details.displayName, details.phone, details.email, member.id).run();
    return json({ member: { ...member, ...details } });
  } catch (error) { return apiError(error); }
}

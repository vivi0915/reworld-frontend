# Twelve-drink exploration

The existing menu now includes personal exploration. Guests can view all twelve drinks and roll two dice. Sign in or create a Player ID from the menu to load server-owned progress. The current Player/phone recovery and legacy account sign-in flows are preserved.

- Choose a drink to create a pending request. Only an authenticated admin can confirm completion.
- Operations → MEMBERS: search username, display name, phone or Player ID; open the member, then use the twelve-drink panel to confirm a pending drink.
- Corrections require a revocation reason. The card returns to incomplete; the member can request it again. Audit history preserves each confirmation, time and staff account.
- Twelve distinct completed drinks unlock a physical-menu voucher in the menu. Staff can mark delivery once. Revoking a completion disables an unredeemed voucher until all twelve are completed again. A redeemed voucher never becomes redeemable a second time.
- All records are in D1, keyed by member and stable drink ID. Neither localStorage nor browser-shared progress is used. Account changes remount the menu, abort old requests and refetch. Progress refreshes every ten seconds and on focus.
- Both dice form an ordered pair; each of the 36 outcomes maps to one of twelve drinks (three outcomes per drink). The optional incomplete-only pool rejects surplus pairs before mapping, preserving equal probability.
- The numbered cocktail names/prices remain placeholders. Preserve IDs when final names are supplied.

Migration `0006_menu_exploration.sql` is additive and must run before the Worker deploy. Existing deployment script applies D1 migrations. It does not update the separate chatgpt.site deployment.

Validation runs in GitHub Actions: typecheck, lint and npm test, including real disposable D1 tests for auth/isolation, concurrent confirmations, revocations, voucher gating and single redemption. No production member test data is created.

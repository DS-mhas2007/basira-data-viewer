# Replace the blocked guest AI trial with a supported sign-in flow

## Confirmed issue
The current shared AI action helper calls anonymous sign-in when visitors have no session. The supplied production logs confirm that authentication rejects these calls with `anonymous_provider_disabled`. No fallback in this helper grants access after that rejection.

Anonymous sign-ups are prohibited by this project's Cloud instructions. Enabling the provider is therefore not an available fix. The finding remains unresolved; no application, database, or authentication settings have been changed.

## Proposed alternative — requires approval
- Require a supported account sign-in before cloud AI use, instead of attempting a hidden guest registration.
- Show the sign-in requirement clearly before visitors submit an AI question; retain their draft and uploaded local data during the sign-in flow where possible.
- Keep local file analysis available without an account.
- Preserve existing account quotas and server-side authorization. Do not replace them with browser-only limits or expose AI keys.

This removes failed guest-registration attempts but does **not** provide account-free cloud AI. It changes the entry experience and must be approved before implementation.

## Cross-app rule and code audit
The intended rule is: visitors should be able to try cloud AI without creating an account, within the guest allowance. That rule currently conflicts with the prohibition on anonymous sign-ups.

Read-only checks completed:
- **Ask Data drawer and agent chat submission:** both call the failing guest-session helper directly; neither restores guest access after failure.
- **Ask Data cloud questions, agent quick questions, agent analysis/briefs, and templates:** all use `metered()`, so all inherit the same failure. Ask Data's local-plan branch bypasses the cloud call and is not blocked by this helper.
- **Quota dialog:** already offers account registration after `login_required`; this is an account-based fallback, not a guest trial.
- **AI query, agent brief, report narrative, and streaming chat server entry points:** require authentication and enforce quotas. These protections are correct and must remain; none grants account-free access.
- **Shared quota server helper and migration definitions of `get_ai_quota()` / `consume_ai_quota()`:** require a user identity and distinguish authenticated anonymous sessions from regular accounts. Guest quota definitions cannot create the missing session. Live database definitions were not queried.
- **README and generated auth config:** still describe/declare guest access, but the supplied production auth logs show that the actual provider rejects it.

No background guest-registration caller was found in the source search. These checks were source reads, not successful end-to-end guest AI runs. No settled usage records, permissions, settings, or sample data were changed.

## Technical scope
- Replace the automatic anonymous registration in `src/lib/ai-action.ts` with a session check, updating its callers in Ask Data and agent chat.
- Reuse the existing supported authentication screen and quota notification flow.
- Update the existing quota tests to assert that signed-out AI actions do not register anonymous users or invoke protected AI calls, while signed-in actions continue unchanged.
- Correct guest-trial documentation without editing generated Cloud configuration, database policies, or quota limits.

## Verification
Run the affected tests; check signed-out file analysis and sign-in prompts, then sign in and submit a real AI question if a test session and AI balance are available. Report any unverified AI response explicitly. Resolve monitoring only for the approved, verified outcome—not as a restored account-free trial.
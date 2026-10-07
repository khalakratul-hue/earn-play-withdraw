<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- All app data lives in Lovable Cloud; `src/lib/app-store.ts` is the only client data layer — UI reads via `useStore()`. Why: one swap point, every device sees the same data.
- Coin/point balance changes happen only in SQL security-definer functions (claim_reward, daily_checkin, send_gift, request_withdraw, apply_referral) or admin server functions. Why: clients can't edit their own wallet.
- Admin actions go through `src/lib/admin.functions.ts`, which checks the shared ADMIN_PASSWORD secret server-side (timing-safe) before using the service-role client. Why: user chose to keep the /#admin password login.

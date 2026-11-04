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

# Project rules

- Attributes and their sub-skills are defined in `src/lib/skills.ts` (ATTRIBUTES); each attribute is a numeric column on `characters`, so adding one means a migration plus a config entry. Why: one source of truth for skill names, descriptions and roll math.
- Sub-skill extra points live one row per skill in `character_skills` (upserted on `character_id,skill_key`); base = attribute value, computed in code, never stored. Why: each skill saves individually and bases follow the attribute automatically.
- The table is open-access (no login): RLS policies allow anon read/write on all RPG tables by user choice. Why: shared tabletop link; revisit if accounts are added.
- Sheet data is read through react-query `sheetQuery` and written via `useSheetMutations` with optimistic cache patches. Why: steppers feel instant while still persisting.
- Client UI libraries used by the app are listed in `optimizeDeps.include` in `vite.config.ts`; add new runtime UI deps there. Why: mid-session dependency re-optimization in dev loads two React copies and blanks the preview.
- Database changes live in `drizzle/migrations/` and must be listed in `meta/_journal.json`; write them idempotent (IF NOT EXISTS, DROP POLICY IF EXISTS, guarded publication adds). Why: changes pushed from GitHub may be partly applied already, and the migration tool replays every unrecorded file.
- Live sync opens one realtime channel per table in `use-realtime-sync.ts`, and every table it listens to must be in the `supabase_realtime` publication (added via an idempotent migration). Why: a single unpublished table makes the server reject the whole channel, silently freezing live updates for everyone.
- Map chests are `battle_map_items` rows with `is_chest=true` and their contents in `chest_items` jsonb (catalog item refs); taking re-reads the row first, and catalog items are delivered via `giveCatalogItem` in `src/lib/give-item.ts`. Why: one delivery path for catalog, chests and master gifts, no double pickups.
- Passive skill rules (passive score, damage reduction, level damage bonus) live in `src/lib/passives.ts`. Why: one tested place for no-roll mechanics.

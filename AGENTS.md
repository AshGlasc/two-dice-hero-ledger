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

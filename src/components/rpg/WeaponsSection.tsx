import { Crosshair, Plus, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";

import { InlineField } from "@/components/rpg/InlineField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { useSheetMutations } from "@/hooks/use-sheet-mutations";
import { Stepper } from "@/components/rpg/Stepper";
import { isCustomAttack } from "@/lib/custom-attacks";
import type { CharacterSheet, Weapon } from "@/lib/rpg-queries";
import { ALL_SKILLS } from "@/lib/skills";

type Mutations = ReturnType<typeof useSheetMutations>;

const EMPTY = { name: "", weapon_type: "", damage: "", ammo: "", notes: "" };

export function WeaponsSection({ sheet, mutations }: { sheet: CharacterSheet; mutations: Mutations }) {
  const [form, setForm] = useState(EMPTY);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    mutations.addWeapon.mutate(
      { ...form, name: form.name.trim() },
      { onSuccess: () => setForm(EMPTY) },
    );
  };

  const save = (w: Weapon, patch: Partial<Weapon>) =>
    mutations.updateWeapon.mutate({
      id: w.id,
      name: w.name,
      weapon_type: w.weapon_type,
      damage: w.damage,
      ammo: w.ammo,
      notes: w.notes,
      skill_key: w.skill_key,
      range: w.range,
      uses_max: w.uses_max,
      uses_current: w.uses_current,
      ...patch,
    });
  const weapons = sheet.weapons.filter((w) => !isCustomAttack(w));

  return (
    <div className="space-y-6">
      <form
        onSubmit={submit}
        className="grid gap-3 rounded-lg border border-border bg-card p-5 shadow-paint md:grid-cols-[2fr_1fr_1fr_1fr_auto] md:items-end"
      >
        <label className="space-y-1.5">
          <span className="label-caps text-muted-foreground">Nova arma</span>
          <Input
            placeholder="Ex.: Revólver Kiejl"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
        </label>
        <label className="space-y-1.5">
          <span className="label-caps text-muted-foreground">Tipo</span>
          <Input
            placeholder="Fogo, branca…"
            value={form.weapon_type}
            onChange={(e) => setForm({ ...form, weapon_type: e.target.value })}
          />
        </label>
        <label className="space-y-1.5">
          <span className="label-caps text-muted-foreground">Dano</span>
          <Input
            placeholder="1d6+2"
            value={form.damage}
            onChange={(e) => setForm({ ...form, damage: e.target.value })}
          />
        </label>
        <label className="space-y-1.5">
          <span className="label-caps text-muted-foreground">Munição</span>
          <Input
            placeholder="6/6"
            value={form.ammo}
            onChange={(e) => setForm({ ...form, ammo: e.target.value })}
          />
        </label>
        <Button type="submit" variant="paint" disabled={mutations.addWeapon.isPending}>
          <Plus /> Guardar
        </Button>
      </form>

      {weapons.length === 0 ? (
        <EmptyState icon={<Crosshair />} text="Nenhuma arma no arsenal ainda." />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {weapons.map((w) => (
            <li key={w.id} className="rounded-lg border border-border bg-card p-4 shadow-paint">
              <div className="flex items-start gap-2">
                <InlineField
                  label="Nome da arma"
                  value={w.name}
                  required
                  onSave={(v) => save(w, { name: v })}
                  className="h-auto px-1 font-display text-2xl font-bold uppercase md:text-2xl"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Remover ${w.name}`}
                  onClick={() => {
                    if (confirm(`Remover ${w.name} do arsenal?`)) mutations.deleteWeapon.mutate(w.id);
                  }}
                >
                  <Trash2 />
                </Button>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {(
                  [
                    ["weapon_type", "Tipo"],
                    ["damage", "Dano"],
                    ["ammo", "Munição"],
                  ] as const
                ).map(([field, label]) => (
                  <div key={field}>
                    <span className="label-caps px-1 text-muted-foreground">{label}</span>
                    <InlineField
                      label={label}
                      value={w[field]}
                      placeholder="—"
                      onSave={(v) => save(w, { [field]: v })}
                      className="px-1"
                    />
                  </div>
                ))}
              </div>
              <div className="mt-3 grid gap-2 rounded-md border border-border/60 bg-muted/30 p-2 text-xs sm:grid-cols-2">
                <label className="space-y-1 sm:col-span-2">
                  <span className="label-caps text-muted-foreground">Skill para acertar</span>
                  <select
                    className="h-8 w-full rounded border border-border bg-card px-1 text-sm"
                    value={w.skill_key}
                    onChange={(e) => save(w, { skill_key: e.target.value })}
                  >
                    {ALL_SKILLS.map((s) => (
                      <option key={s.key} value={s.key}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="space-y-1">
                  <span className="label-caps text-muted-foreground">Alcance (casas)</span>
                  <Stepper
                    label="alcance"
                    value={w.range}
                    min={1}
                    max={30}
                    onChange={(v) => save(w, { range: v })}
                  />
                </div>
                <div className="space-y-1">
                  <span className="label-caps text-muted-foreground">
                    {w.range > 1 ? "Munição máx." : "Durabilidade máx."} (0 = infinita)
                  </span>
                  <Stepper
                    label="usos máximos"
                    value={w.uses_max}
                    min={0}
                    max={999}
                    onChange={(v) =>
                      save(w, { uses_max: v, uses_current: Math.min(w.uses_current || v, v) })
                    }
                  />
                </div>
                {w.uses_max > 0 && (
                  <div className="space-y-1 sm:col-span-2">
                    <span className="label-caps text-muted-foreground">
                      {w.range > 1 ? "Munição restante" : "Durabilidade restante"}
                      {w.uses_current <= 0 && (
                        <span className="ml-1 text-destructive">
                          {w.range > 1 ? "— sem munição" : "— quebrada"}
                        </span>
                      )}
                    </span>
                    <div className="flex items-center gap-2">
                      <Stepper
                        label="usos restantes"
                        value={w.uses_current}
                        min={0}
                        max={w.uses_max}
                        onChange={(v) => save(w, { uses_current: v })}
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7"
                        onClick={() => save(w, { uses_current: w.uses_max })}
                      >
                        {w.range > 1 ? "Recarregar" : "Consertar"}
                      </Button>
                    </div>
                  </div>
                )}
                <p className="text-muted-foreground sm:col-span-2">
                  No combate, esta arma aparece no menu de ataque (⚔️) e gasta 1{" "}
                  {w.range > 1 ? "munição" : "de durabilidade"} por uso.
                </p>
              </div>
              <div className="mt-2">
                <span className="label-caps px-1 text-muted-foreground">Notas</span>
                <InlineField
                  label="Notas da arma"
                  value={w.notes}
                  placeholder="Alcance, efeitos, história…"
                  onSave={(v) => save(w, { notes: v })}
                  className="px-1 text-sm"
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border py-14 text-muted-foreground [&_svg]:size-8">
      {icon}
      <p className="italic">{text}</p>
    </div>
  );
}

import { Backpack, Plus, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";

import { InlineField } from "@/components/rpg/InlineField";
import { Stepper } from "@/components/rpg/Stepper";
import { EmptyState } from "@/components/rpg/WeaponsSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { useSheetMutations } from "@/hooks/use-sheet-mutations";
import { useMasterAuth } from "@/context/MasterAuthContext";
import type { BackpackItem, CharacterSheet } from "@/lib/rpg-queries";
import { ALL_SKILLS } from "@/lib/skills";

type Mutations = ReturnType<typeof useSheetMutations>;

export function BackpackSection({ sheet, mutations }: { sheet: CharacterSheet; mutations: Mutations }) {
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    mutations.addItem.mutate(
      { name: name.trim(), quantity, notes: notes.trim() },
      {
        onSuccess: () => {
          setName("");
          setQuantity(1);
          setNotes("");
        },
      },
    );
  };

  const totalItems = sheet.backpack.reduce((sum, it) => sum + it.quantity, 0);

  return (
    <div className="space-y-6">
      <form
        onSubmit={submit}
        className="grid gap-3 rounded-lg border border-border bg-card p-5 shadow-paint md:grid-cols-[2fr_auto_2fr_auto] md:items-end"
      >
        <label className="space-y-1.5">
          <span className="label-caps text-muted-foreground">Novo item</span>
          <Input
            placeholder="Ex.: Isqueiro de prata"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </label>
        <div className="space-y-1.5">
          <span className="label-caps text-muted-foreground">Qtd.</span>
          <Stepper label="quantidade" value={quantity} min={1} max={999} onChange={setQuantity} className="h-9" />
        </div>
        <label className="space-y-1.5">
          <span className="label-caps text-muted-foreground">Notas</span>
          <Input placeholder="Opcional" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        <Button type="submit" variant="paint" disabled={mutations.addItem.isPending}>
          <Plus /> Colocar
        </Button>
      </form>

      {sheet.backpack.length === 0 ? (
        <EmptyState icon={<Backpack />} text="A mochila está vazia." />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-paint">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <span className="label-caps text-muted-foreground">Conteúdo</span>
            <span className="label-caps text-primary">{totalItems} itens</span>
          </div>
          <ul className="divide-y divide-border">
            {sheet.backpack.map((it) => (
              <li key={it.id} className="px-4 py-2">
              <div className="grid grid-cols-[1fr_auto_auto] items-center gap-3 md:grid-cols-[2fr_2fr_auto_auto]">
                <InlineField
                  label="Nome do item"
                  value={it.name}
                  required
                  onSave={(v) => mutations.updateItem.mutate({ id: it.id, name: v })}
                  className="font-display text-lg font-semibold uppercase"
                />
                <InlineField
                  label="Notas do item"
                  value={it.notes}
                  placeholder="Notas…"
                  onSave={(v) => mutations.updateItem.mutate({ id: it.id, notes: v })}
                  className="hidden text-sm text-muted-foreground md:block"
                />
                <Stepper
                  label={`quantidade de ${it.name}`}
                  value={it.quantity}
                  min={1}
                  max={999}
                  onChange={(v) => mutations.updateItem.mutate({ id: it.id, quantity: v })}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Remover ${it.name}`}
                  onClick={() => mutations.deleteItem.mutate(it.id)}
                >
                  <Trash2 />
                </Button>
              </div>
              <ItemBonuses
                item={it}
                onSave={(skill_bonuses) => mutations.updateItem.mutate({ id: it.id, skill_bonuses })}
              />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Bônus que o item dá em skills (ex.: Lupa +1 Cálculo Visual). Só o mestre define. */
function ItemBonuses({
  item,
  onSave,
}: {
  item: BackpackItem;
  onSave: (b: Record<string, number>) => void;
}) {
  const { isMaster } = useMasterAuth();
  const [skill, setSkill] = useState("");
  const [value, setValue] = useState(1);
  const bonuses = (item.skill_bonuses ?? {}) as Record<string, number>;
  const entries = Object.entries(bonuses).filter(([, v]) => Number(v) !== 0);
  if (!isMaster && entries.length === 0) return null;
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
      {entries.map(([k, v]) => (
        <span
          key={k}
          className="flex items-center gap-1 rounded-full border border-success/50 bg-success/10 px-2 py-0.5 font-semibold text-success"
        >
          {v > 0 ? "+" : ""}
          {v} {ALL_SKILLS.find((s) => s.key === k)?.name ?? k}
          {isMaster && (
            <button
              type="button"
              aria-label="Tirar bônus"
              className="ml-0.5 text-muted-foreground hover:text-destructive"
              onClick={() => {
                const next = { ...bonuses };
                delete next[k];
                onSave(next);
              }}
            >
              ×
            </button>
          )}
        </span>
      ))}
      {isMaster && (
        <span className="flex items-center gap-1">
          <select
            className="h-7 rounded border border-border bg-card px-1"
            value={skill}
            onChange={(e) => setSkill(e.target.value)}
            aria-label="Skill do bônus"
          >
            <option value="">+ bônus em skill…</option>
            {ALL_SKILLS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.name}
              </option>
            ))}
          </select>
          {skill && (
            <>
              <Stepper label="valor do bônus" value={value} min={-5} max={10} onChange={setValue} className="h-7" />
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7"
                onClick={() => {
                  onSave({ ...bonuses, [skill]: value });
                  setSkill("");
                  setValue(1);
                }}
              >
                OK
              </Button>
            </>
          )}
        </span>
      )}
    </div>
  );
}

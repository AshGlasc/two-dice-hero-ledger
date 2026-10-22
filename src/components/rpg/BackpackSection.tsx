import { Backpack, Plus, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";

import { InlineField } from "@/components/rpg/InlineField";
import { Stepper } from "@/components/rpg/Stepper";
import { EmptyState } from "@/components/rpg/WeaponsSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { useSheetMutations } from "@/hooks/use-sheet-mutations";
import type { CharacterSheet } from "@/lib/rpg-queries";

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
              <li
                key={it.id}
                className="grid grid-cols-[1fr_auto_auto] items-center gap-3 px-4 py-2 md:grid-cols-[2fr_2fr_auto_auto]"
              >
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
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

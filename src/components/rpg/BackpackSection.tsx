import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Backpack, Dices, Plus, Send, Sparkles, Trash2, Utensils } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { InlineField } from "@/components/rpg/InlineField";
import { Stepper } from "@/components/rpg/Stepper";
import { EmptyState } from "@/components/rpg/WeaponsSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { useSheetMutations } from "@/hooks/use-sheet-mutations";
import { useMasterAuth } from "@/context/MasterAuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  charactersQuery,
  sheetQueryKey,
  type BackpackItem,
  type CharacterSheet,
} from "@/lib/rpg-queries";
import { ALL_SKILLS, roll2d6, skillTotal } from "@/lib/skills";
import { itemBonusFor } from "@/lib/combat";
import { logRolls } from "@/lib/roll-log";

type Mutations = ReturnType<typeof useSheetMutations>;

export function BackpackSection({
  sheet,
  mutations,
}: {
  sheet: CharacterSheet;
  mutations: Mutations;
}) {
  const qc = useQueryClient();
  const { data: characters } = useQuery(charactersQuery);
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");

  // Modais de Sobrevivência
  const [improviseItem, setImproviseItem] = useState<BackpackItem | null>(null);
  const [improviseSubskill, setImproviseSubskill] = useState<string>("tecnica");
  const [improviseDifficulty, setImproviseDifficulty] = useState<number>(14);

  const [transferItem, setTransferItem] = useState<BackpackItem | null>(null);
  const [transferTargetId, setTransferTargetId] = useState<string>("");

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

  const handleConsume = (it: BackpackItem) => {
    const isFood =
      it.survival_tag === "Ração" ||
      it.name.toLowerCase().includes("ração") ||
      it.name.toLowerCase().includes("comida");
    const isWater =
      it.survival_tag === "Hidratação" ||
      it.name.toLowerCase().includes("água") ||
      it.name.toLowerCase().includes("cantil");

    if (isFood) {
      mutations.updateCharacter.mutate({ hunger_state: "satisfeito" });
      toast.success(`${it.name} consumido. Fome saciada!`);
    } else if (isWater) {
      mutations.updateCharacter.mutate({ thirst_state: "satisfeito" });
      toast.success(`${it.name} consumido. Sede saciada!`);
    } else {
      toast.success(`1 unidade de ${it.name} consumida.`);
    }

    // Regra rígida: dec se > 1, deleta se <= 1
    if (it.quantity > 1) {
      mutations.updateItem.mutate({ id: it.id, quantity: it.quantity - 1 });
    } else {
      mutations.deleteItem.mutate(it.id);
    }
  };

  const handleImproviseRoll = () => {
    if (!improviseItem) return;
    const skill = ALL_SKILLS.find((s) => s.key === improviseSubskill);
    if (!skill) return;

    const base = sheet.character[skill.attribute];
    const extra = sheet.skills.find((s) => s.skill_key === skill.key)?.bonus ?? 0;
    const itemBonus = itemBonusFor(sheet.backpack, sheet.character.id, skill.key);
    const mod = skillTotal(base, extra) + itemBonus;
    const roll = roll2d6(mod, improviseDifficulty);

    // Consome 1 unidade do item
    if (improviseItem.quantity > 1) {
      mutations.updateItem.mutate({ id: improviseItem.id, quantity: improviseItem.quantity - 1 });
    } else {
      mutations.deleteItem.mutate(improviseItem.id);
    }

    void logRolls([
      {
        characterId: sheet.character.id,
        characterName: sheet.character.name,
        label: `Improviso com ${improviseItem.name}: ${skill.name}`,
        result: roll,
      },
    ]);

    const outcomeLabel =
      roll.outcome === "critical-success"
        ? "Sucesso Crítico!"
        : roll.outcome === "success"
          ? "Sucesso!"
          : roll.outcome === "critical-failure"
            ? "Falha Crítica!"
            : "Falha!";

    toast(`Improviso com ${improviseItem.name}: ${skill.name}`, {
      description: `Resultado: ${roll.total} vs CD ${improviseDifficulty} (${outcomeLabel})`,
    });

    setImproviseItem(null);
  };

  const handleTransferConfirm = async () => {
    if (!transferItem || !transferTargetId) return;
    const target = characters?.find((c) => c.id === transferTargetId);
    try {
      const { error } = await supabase
        .from("backpack_items")
        .update({ character_id: transferTargetId, equipped: false })
        .eq("id", transferItem.id);
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: sheetQueryKey(sheet.character.id) });
      await qc.invalidateQueries({ queryKey: sheetQueryKey(transferTargetId) });
      toast.success(`${transferItem.name} entregue para ${target?.name ?? "o aliado"}!`);
    } catch {
      toast.error("Não foi possível transferir o item.");
    } finally {
      setTransferItem(null);
      setTransferTargetId("");
    }
  };

  const totalItems = sheet.backpack.reduce((sum, it) => sum + it.quantity, 0);
  const otherCharacters = characters?.filter((c) => c.id !== sheet.character.id) ?? [];

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
          <Stepper
            label="quantidade"
            value={quantity}
            min={1}
            max={999}
            onChange={setQuantity}
            className="h-9"
          />
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
                {it.armor_part && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    <span className="text-muted-foreground">
                      Proteção: {it.armor_part} · RD {it.armor_reduction}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant={it.equipped ? "default" : "outline"}
                      className="h-7"
                      onClick={() =>
                        mutations.updateItem.mutate({ id: it.id, equipped: !it.equipped })
                      }
                    >
                      {it.equipped ? "Equipado" : "Equipar"}
                    </Button>
                  </div>
                )}
                <ItemBonuses
                  item={it}
                  onSave={(skill_bonuses) =>
                    mutations.updateItem.mutate({ id: it.id, skill_bonuses })
                  }
                />

                <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-border/40 pt-1.5 text-xs">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-6 gap-1 text-[11px] hover:bg-muted"
                    onClick={() => handleConsume(it)}
                  >
                    <Utensils className="size-3 text-amber-400" /> Consumir
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-6 gap-1 text-[11px] border-primary/50 text-primary hover:bg-primary/10"
                    onClick={() => setImproviseItem(it)}
                  >
                    <Sparkles className="size-3" /> Improvisar
                  </Button>
                  {!it.equipped && otherCharacters.length > 0 && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-6 gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        setTransferItem(it);
                        setTransferTargetId(otherCharacters[0]?.id ?? "");
                      }}
                    >
                      <Send className="size-3" /> Entregar para...
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Modal de Improviso */}
      <Dialog open={!!improviseItem} onOpenChange={(open) => !open && setImproviseItem(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display uppercase tracking-wider">
              <Sparkles className="size-5 text-primary" /> Uso Criativo: {improviseItem?.name}
            </DialogTitle>
            <DialogDescription>
              Gaste 1 unidade de {improviseItem?.name} para realizar um feito improvisado na cena.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="label-caps text-muted-foreground">Escolha a Perícia</label>
              <Select value={improviseSubskill} onValueChange={setImproviseSubskill}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tecnica">🔧 Técnica (Psique)</SelectItem>
                  <SelectItem value="ferramenta_fisica">🔨 Ferramenta Física (Físico)</SelectItem>
                  <SelectItem value="mao_leve">🤏 Mão Leve (Motor)</SelectItem>
                  <SelectItem value="enciclopedia">📚 Enciclopédia (Intelecto)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="label-caps text-muted-foreground">Dificuldade do Teste</label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  { label: "Fácil", dc: 10 },
                  { label: "Médio", dc: 14 },
                  { label: "Difícil", dc: 18 },
                  { label: "Impossível", dc: 20 },
                ].map((d) => (
                  <button
                    key={d.dc}
                    type="button"
                    onClick={() => setImproviseDifficulty(d.dc)}
                    className={
                      improviseDifficulty === d.dc
                        ? "rounded border border-primary bg-primary/20 px-2 py-1.5 text-center font-bold text-primary transition-colors"
                        : "rounded border border-border bg-card px-2 py-1.5 text-center text-muted-foreground transition-colors hover:bg-muted"
                    }
                  >
                    <div className="text-xs">{d.label}</div>
                    <div className="text-lg font-bold">CD {d.dc}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            <Button type="button" variant="outline" onClick={() => setImproviseItem(null)}>
              Cancelar
            </Button>
            <Button type="button" variant="paint" onClick={handleImproviseRoll} className="gap-2">
              <Dices className="size-4" /> Rolar 2d6 + Perícia
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Entregar Item */}
      <Dialog open={!!transferItem} onOpenChange={(open) => !open && setTransferItem(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display uppercase tracking-wider">
              <Send className="size-5 text-primary" /> Entregar {transferItem?.name}
            </DialogTitle>
            <DialogDescription>
              Transfira a posse deste item para outro personagem do grupo.
            </DialogDescription>
          </DialogHeader>

          <div className="py-3">
            <label className="label-caps mb-1.5 block text-muted-foreground">
              Selecione o Personagem
            </label>
            <Select value={transferTargetId} onValueChange={setTransferTargetId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um aliado..." />
              </SelectTrigger>
              <SelectContent>
                {otherCharacters.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} {c.player_name ? `(${c.player_name})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            <Button type="button" variant="outline" onClick={() => setTransferItem(null)}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="paint"
              disabled={!transferTargetId}
              onClick={handleTransferConfirm}
              className="gap-2"
            >
              <Send className="size-4" /> Confirmar Entrega
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
              <Stepper
                label="valor do bônus"
                value={value}
                min={-5}
                max={10}
                onChange={setValue}
                className="h-7"
              />
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

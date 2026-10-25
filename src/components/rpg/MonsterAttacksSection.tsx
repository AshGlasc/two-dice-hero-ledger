import { Check, Clock, Dices, Plus, Swords, Trash2, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Stepper } from "@/components/rpg/Stepper";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  COMBAT_SKILLS,
  getSkillLabel,
  parseMonsterAttacks,
  serializeMonsterAttacks,
  type CustomAttack,
} from "@/lib/custom-attacks";
import type { Monster } from "@/lib/rpg-queries";

const EMPTY_FORM = {
  name: "",
  skillKey: "attack_bonus",
  turnsCost: 1,
  diceCount: 2,
  description: "",
};

export function MonsterAttacksSection({
  monster,
  onSave,
}: {
  monster: Monster;
  onSave: (attacks: string) => void;
}) {
  const attacks = parseMonsterAttacks(monster.id, monster.attacks);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;

    const newAttack: CustomAttack = {
      id: `monster-${monster.id}-atk-${Date.now()}`,
      ownerId: monster.id,
      ownerType: "monster",
      name: form.name.trim(),
      skillKey: form.skillKey,
      turnsCost: form.turnsCost,
      diceCount: form.diceCount,
      description: form.description.trim(),
      status: "approved",
      createdAt: new Date().toISOString(),
    };

    const updated = [...attacks, newAttack];
    onSave(serializeMonsterAttacks(updated));
    setForm(EMPTY_FORM);
    setShowForm(false);
    toast.success(`Ataque "${newAttack.name}" adicionado!`);
  };

  const removeAttack = (id: string) => {
    const updated = attacks.filter((a) => a.id !== id);
    onSave(serializeMonsterAttacks(updated));
    toast("Ataque removido.");
  };

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-5 shadow-paint">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="label-caps text-destructive">Ataques do Monstro</p>
          <h2 className="text-2xl font-bold uppercase">Ações de Combate</h2>
        </div>
        <Button
          variant={showForm ? "outline" : "paint"}
          size="sm"
          onClick={() => setShowForm(!showForm)}
          className="gap-2"
        >
          {showForm ? <X className="size-4" /> : <Plus className="size-4" />}
          {showForm ? "Cancelar" : "Novo Ataque"}
        </Button>
      </div>

      {/* Formulário */}
      {showForm && (
        <form
          onSubmit={submit}
          className="space-y-4 rounded-xl border border-destructive/30 bg-card p-4 animate-in fade-in zoom-in-95"
        >
          <div className="flex items-center gap-2 border-b border-border pb-3">
            <Swords className="size-5 text-destructive" />
            <h3 className="font-display text-xl font-bold uppercase">Definir Ataque</h3>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1.5">
              <span className="label-caps text-muted-foreground">Nome do Ataque</span>
              <Input
                placeholder="Ex.: Mordida, Garras, Rugido Paralisante"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                autoFocus
              />
            </label>

            <label className="space-y-1.5">
              <span className="label-caps text-muted-foreground">Skill / Base</span>
              <Select
                value={form.skillKey}
                onValueChange={(val) => setForm({ ...form, skillKey: val })}
              >
                <SelectTrigger aria-label="Skill do ataque do monstro">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectGroup>
                    <SelectItem value="attack_bonus">Bônus de Ataque Geral</SelectItem>
                  </SelectGroup>
                  <SelectGroup>
                    <SelectLabel className="text-primary font-bold">Skills de Combate</SelectLabel>
                    {COMBAT_SKILLS.map((s) => (
                      <SelectItem key={s.key} value={s.key}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col items-center gap-1.5 rounded-lg border border-border bg-background/40 p-3">
              <span className="label-caps flex items-center gap-1 text-muted-foreground">
                <Clock className="size-3.5 text-destructive" /> Turnos que leva
              </span>
              <Stepper
                label="turnos"
                value={form.turnsCost}
                min={1}
                max={5}
                onChange={(v) => setForm({ ...form, turnsCost: v })}
              />
              <span className="text-[11px] text-muted-foreground">
                {form.turnsCost === 1 ? "Ação rápida" : `${form.turnsCost} turnos`}
              </span>
            </div>

            <div className="flex flex-col items-center gap-1.5 rounded-lg border border-border bg-background/40 p-3">
              <span className="label-caps flex items-center gap-1 text-muted-foreground">
                <Dices className="size-3.5 text-destructive" /> Dados (d6)
              </span>
              <Stepper
                label="dados"
                value={form.diceCount}
                min={1}
                max={8}
                onChange={(v) => setForm({ ...form, diceCount: v })}
              />
              <span className="text-[11px] text-muted-foreground">{form.diceCount}d6</span>
            </div>
          </div>

          <label className="block space-y-1.5">
            <span className="label-caps text-muted-foreground">Descrição / Efeito</span>
            <Textarea
              placeholder="Efeito do ataque, dano extra, condição aplicada…"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="min-h-16"
            />
          </label>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="destructive" disabled={!form.name.trim()}>
              <Check className="mr-1.5 size-4" /> Adicionar Ataque
            </Button>
          </div>
        </form>
      )}

      {/* Lista */}
      {attacks.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border py-8 text-center text-muted-foreground">
          <Swords className="size-8 opacity-50" />
          <p className="text-sm italic">Nenhum ataque configurado. Adicione ações de combate para este monstro.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {attacks.map((atk) => (
            <div
              key={atk.id}
              className="flex flex-col justify-between rounded-lg border border-border bg-background/50 p-3 transition-colors hover:border-destructive/40"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-display text-xl font-bold uppercase leading-tight">{atk.name}</h3>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => removeAttack(atk.id)}
                    title="Remover ataque"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
                <p className="text-xs font-semibold text-destructive">{getSkillLabel(atk.skillKey)}</p>
                {atk.description && (
                  <p className="mt-1 text-xs italic text-foreground/70">{atk.description}</p>
                )}
              </div>
              <div className="mt-3 flex items-center gap-3 border-t border-border/50 pt-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="size-3 text-destructive" />
                  {atk.turnsCost} {atk.turnsCost === 1 ? "turno" : "turnos"}
                </span>
                <span className="flex items-center gap-1">
                  <Dices className="size-3 text-destructive" />
                  {atk.diceCount}d6
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

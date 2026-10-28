import { Check, CheckCircle2, Clock, Dices, Plus, ShieldAlert, Sparkles, Swords, Trash2, X, XCircle } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Stepper } from "@/components/rpg/Stepper";
import { Badge } from "@/components/ui/badge";
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
import { useMasterAuth } from "@/context/MasterAuthContext";
import type { useSheetMutations } from "@/hooks/use-sheet-mutations";
import { itemBonusFor } from "@/lib/combat";
import {
  attackToWeaponPayload,
  COMBAT_SKILLS,
  getSkillLabel,
  isCustomAttack,
  parseWeaponToAttack,
  type CustomAttack,
} from "@/lib/custom-attacks";
import type { CharacterSheet } from "@/lib/rpg-queries";
import { ALL_SKILLS, ATTRIBUTES, skillTotal } from "@/lib/skills";

type Mutations = ReturnType<typeof useSheetMutations>;

const EMPTY_FORM = {
  name: "",
  skillKey: "ferramenta_fisica",
  turnsCost: 1,
  diceCount: 2,
  description: "",
};

export function AttacksSection({
  sheet,
  mutations,
}: {
  sheet: CharacterSheet;
  mutations: Mutations;
}) {
  const { isMaster } = useMasterAuth();
  const [form, setForm] = useState(EMPTY_FORM);
  const [showForm, setShowForm] = useState(false);

  // Filtra apenas as armas que são ataques customizados
  const attacks: CustomAttack[] = sheet.weapons
    .filter(isCustomAttack)
    .map(parseWeaponToAttack);

  const getCharacterSkillBonus = (key: string): number => {
    const s = ALL_SKILLS.find((sk) => sk.key === key);
    if (!s) return 0;
    const base = sheet.character[s.attribute];
    const extra = sheet.skills.find((sk) => sk.skill_key === key)?.bonus ?? 0;
    return skillTotal(base, extra) + itemBonusFor(sheet.backpack, sheet.character.id, key);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;

    const payload = attackToWeaponPayload({
      ...form,
      status: isMaster ? "approved" : "pending",
    });

    mutations.addWeapon.mutate(payload, {
      onSuccess: () => {
        setForm(EMPTY_FORM);
        setShowForm(false);
        if (isMaster) {
          toast.success("Ataque criado e aprovado!");
        } else {
          toast.success("Ataque enviado! Aguardando aprovação do Mestre para poder usá-lo em combate.");
        }
      },
    });
  };

  const updateStatus = (attack: CustomAttack, status: "approved" | "rejected") => {
    const payload = attackToWeaponPayload({
      name: attack.name,
      skillKey: attack.skillKey,
      turnsCost: attack.turnsCost,
      diceCount: attack.diceCount,
      description: attack.description,
      status,
    });

    mutations.updateWeapon.mutate({
      id: attack.id,
      ...payload,
    });

    toast.success(status === "approved" ? "Ataque aprovado!" : "Ataque recusado.");
  };

  const removeAttack = (attack: CustomAttack) => {
    if (confirm(`Remover o ataque "${attack.name}"?`)) {
      mutations.deleteWeapon.mutate(attack.id);
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho e botão de novo ataque */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold uppercase tracking-wider">Ataques do Personagem</h2>
          <p className="text-sm text-muted-foreground">
            Ataques customizados usando qualquer skill, turnos de ação e dados. Devem ser aprovados pelo Mestre.
          </p>
        </div>
        <Button
          variant={showForm ? "outline" : "paint"}
          size="sm"
          onClick={() => setShowForm(!showForm)}
          className="gap-2"
        >
          {showForm ? <X className="size-4" /> : <Plus className="size-4" />}
          {showForm ? "Cancelar" : "Criar Novo Ataque"}
        </Button>
      </div>

      {/* Formulário de criação de ataque */}
      {showForm && (
        <form
          onSubmit={submit}
          className="space-y-4 rounded-xl border border-primary/30 bg-card p-5 shadow-paint animate-in fade-in zoom-in-95"
        >
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <Swords className="size-5 text-primary" />
              <h3 className="font-display text-xl font-bold uppercase">Propor Novo Ataque</h3>
            </div>
            {!isMaster && (
              <Badge variant="outline" className="border-warning/60 bg-warning/10 text-xs text-warning">
                Requer Aprovação do Mestre
              </Badge>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1.5">
              <span className="label-caps text-muted-foreground">Nome do Ataque</span>
              <Input
                placeholder="Ex.: Golpe de Misericórdia, Tiro Furtivo, Cabeçada Brutal"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                autoFocus
              />
            </label>

            <label className="space-y-1.5">
              <span className="label-caps text-muted-foreground">Skill Usada</span>
              <Select
                value={form.skillKey}
                onValueChange={(val) => setForm({ ...form, skillKey: val })}
              >
                <SelectTrigger aria-label="Skill do ataque">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectGroup>
                    <SelectLabel className="text-primary font-bold">Skills de Combate Recomendadas</SelectLabel>
                    {COMBAT_SKILLS.map((s) => (
                      <SelectItem key={s.key} value={s.key}>
                        {s.name} (+{getCharacterSkillBonus(s.key)})
                      </SelectItem>
                    ))}
                  </SelectGroup>
                  <SelectGroup>
                    <SelectLabel className="text-muted-foreground">Todas as Skills</SelectLabel>
                    {ATTRIBUTES.map((attr) =>
                      attr.skills
                        .filter((s) => !COMBAT_SKILLS.some((cs) => cs.key === s.key))
                        .map((s) => (
                          <SelectItem key={s.key} value={s.key}>
                            {s.name} ({attr.name}) (+{getCharacterSkillBonus(s.key)})
                          </SelectItem>
                        )),
                    )}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-2">
            <div className="flex flex-col items-center gap-1.5 rounded-lg border border-border bg-background/40 p-3">
              <span className="label-caps flex items-center gap-1 text-muted-foreground">
                <Clock className="size-3.5 text-primary" /> Turnos que leva
              </span>
              <Stepper
                label="turnos"
                value={form.turnsCost}
                min={1}
                max={5}
                onChange={(v) => setForm({ ...form, turnsCost: v })}
              />
              <span className="text-[11px] text-muted-foreground">
                {form.turnsCost === 1 ? "Ação rápida (1 turno)" : `Ação demorada (${form.turnsCost} turnos)`}
              </span>
            </div>

            <div className="flex flex-col items-center gap-1.5 rounded-lg border border-border bg-background/40 p-3">
              <span className="label-caps flex items-center gap-1 text-muted-foreground">
                <Dices className="size-3.5 text-primary" /> Quantidade de Dados (d6)
              </span>
              <Stepper
                label="dados"
                value={form.diceCount}
                min={1}
                max={6}
                onChange={(v) => setForm({ ...form, diceCount: v })}
              />
              <span className="text-[11px] text-muted-foreground">
                Rola {form.diceCount}d6 + {getSkillLabel(form.skillKey)}
              </span>
            </div>
          </div>

          <label className="block space-y-1.5">
            <span className="label-caps text-muted-foreground">Descrição / Efeito Especial</span>
            <Textarea
              placeholder="Descreva como o ataque funciona, efeito em caso de acerto, dano extra, etc."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="min-h-20"
            />
          </label>

          {!isMaster && (
            <p className="text-xs text-muted-foreground flex items-center gap-1.5 italic">
              <ShieldAlert className="size-4 text-warning shrink-0" />
              O mestre analisará este ataque no Painel do Mestre e precisará aprová-lo antes que possa ser usado em combate.
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="paint" disabled={!form.name.trim() || mutations.addWeapon.isPending}>
              {isMaster ? "Criar e Aprovar Ataque" : "Enviar para Aprovação do Mestre"}
            </Button>
          </div>
        </form>
      )}

      {/* Lista de Ataques */}
      {attacks.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border py-12 text-center text-muted-foreground">
          <Swords className="size-10 opacity-60" />
          <p className="italic">Nenhum ataque configurado ainda.</p>
          <Button variant="paint" size="sm" onClick={() => setShowForm(true)}>
            <Plus className="mr-1.5 size-4" /> Propor primeiro ataque
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {attacks.map((atk) => {
            const skillBonus = getCharacterSkillBonus(atk.skillKey);

            return (
              <div
                key={atk.id}
                className="flex flex-col justify-between rounded-lg border border-border bg-card p-4 shadow-paint transition-colors hover:border-primary/50"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-display text-2xl font-bold uppercase leading-tight">{atk.name}</h3>
                      <p className="text-xs font-semibold text-primary">
                        Skill: {getSkillLabel(atk.skillKey)} (+{skillBonus})
                      </p>
                    </div>

                    {/* Badge de status */}
                    <div>
                      {atk.status === "approved" && (
                        <Badge variant="outline" className="border-success/60 bg-success/10 text-success gap-1 text-[11px]">
                          <CheckCircle2 className="size-3" /> Aprovado
                        </Badge>
                      )}
                      {atk.status === "pending" && (
                        <Badge variant="outline" className="border-warning/60 bg-warning/10 text-warning gap-1 text-[11px] animate-pulse">
                          <Clock className="size-3" /> Pendente
                        </Badge>
                      )}
                      {atk.status === "rejected" && (
                        <Badge variant="outline" className="border-destructive/60 bg-destructive/10 text-destructive gap-1 text-[11px]">
                          <XCircle className="size-3" /> Recusado
                        </Badge>
                      )}
                    </div>
                  </div>

                  {atk.description && (
                    <p className="mt-2 text-xs text-foreground/80 italic">{atk.description}</p>
                  )}

                  {/* Informações mecânicas */}
                  <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-border/50 pt-3 text-xs">
                    <span className="flex items-center gap-1 font-semibold text-muted-foreground">
                      <Clock className="size-3.5 text-primary" />
                      {atk.turnsCost} {atk.turnsCost === 1 ? "turno" : "turnos"}
                    </span>
                    <span className="flex items-center gap-1 font-semibold text-muted-foreground">
                      <Dices className="size-3.5 text-primary" />
                      {atk.diceCount}d6 + {skillBonus}
                    </span>
                  </div>
                </div>

                {/* Ações do Mestre / Exclusão */}
                <div className="mt-4 flex items-center justify-between border-t border-border/50 pt-2">
                  {isMaster ? (
                    <div className="flex items-center gap-1.5">
                      {atk.status !== "approved" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs border-success/50 text-success hover:bg-success/10"
                          onClick={() => updateStatus(atk, "approved")}
                        >
                          <Check className="mr-1 size-3" /> Aprovar
                        </Button>
                      )}
                      {atk.status !== "rejected" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs border-destructive/50 text-destructive hover:bg-destructive/10"
                          onClick={() => updateStatus(atk, "rejected")}
                        >
                          <X className="mr-1 size-3" /> Recusar
                        </Button>
                      )}
                    </div>
                  ) : (
                    <span className="text-[11px] text-muted-foreground">
                      {atk.status === "approved"
                        ? "Disponível para uso em combate."
                        : atk.status === "pending"
                        ? "O mestre precisa aprovar antes do uso."
                        : "Ataque não aceito pelo mestre."}
                    </span>
                  )}

                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-muted-foreground hover:text-destructive"
                    onClick={() => removeAttack(atk)}
                    title="Remover ataque"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

import { Shield, Swords } from "lucide-react";
import { useState } from "react";

import { Avatar } from "@/components/rpg/AvatarUpload";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { AttackOption } from "@/lib/combat";
import { BODY_TARGETS, type BodyTarget } from "@/lib/combat";
import { COMBAT_SKILLS, EFFECT_CONDITIONS } from "@/lib/custom-attacks";
import { cn } from "@/lib/utils";

export type AttackTarget = {
  id: string;
  name: string;
  avatar: string;
  tone: "player" | "monster";
  distance: number | null;
  bodyTargets?: { target: BodyTarget; label: string }[];
};

const dmgText = (d: AttackOption["damage"]) =>
  `${d.count > 0 ? `${d.count}d${d.sides}` : ""}${d.bonus ? `${d.bonus > 0 && d.count > 0 ? "+" : ""}${d.bonus}` : ""}`;

/** Menu do ⚔️: escolhe o ataque e um alvo dentro do alcance. */
export function AttackDialog({
  attackerName,
  options,
  targets,
  canIgnoreRange,
  disabledReason,
  attackDisabledReason,
  getSkillValue,
  onAttack,
  onDefend,
}: {
  attackerName: string;
  options: AttackOption[];
  targets: AttackTarget[];
  canIgnoreRange: boolean;
  disabledReason?: string | null;
  attackDisabledReason?: string | null;
  getSkillValue: (skillKey: string) => number;
  onAttack: (option: AttackOption, targetId: string, bodyTarget: BodyTarget) => void;
  onDefend: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [optId, setOptId] = useState(options[0]?.id ?? "");
  const [bodyTarget, setBodyTarget] = useState<BodyTarget>("general");
  const [targetId, setTargetId] = useState("");
  const [improvising, setImprovising] = useState(false);
  const [improvSkill, setImprovSkill] = useState<string>(COMBAT_SKILLS[0].key);
  const [improvSides, setImprovSides] = useState(6);
  const [improvRange, setImprovRange] = useState(1);
  const [attackSource, setAttackSource] = useState("all");
  const [improvEffect, setImprovEffect] =
    useState<(typeof EFFECT_CONDITIONS)[number]["value"]>("none");
  const availableOptions = options.filter(
    (option) => attackSource === "all" || option.kind === attackSource,
  );
  const opt = availableOptions.find((o) => o.id === optId) ?? availableOptions[0];
  const improvSkillDetails = COMBAT_SKILLS.find((skill) => skill.key === improvSkill);
  const improvisedOption: AttackOption = {
    id: "improvised",
    name: "Ataque improvisado",
    kind: "basic",
    hitBonus: getSkillValue(improvSkill),
    hitDice: 2,
    range: improvRange,
    ...(improvSkillDetails ? { attributeKey: improvSkillDetails.attribute } : {}),
    damage: { count: 1, sides: improvSides, bonus: 0 },
    effectCondition: improvEffect,
    ...(improvSkillDetails ? { note: improvSkillDetails.name } : {}),
  };
  const selectedOption = improvising ? improvisedOption : opt;
  const inRange = (target: AttackTarget) =>
    target.distance !== null && target.distance <= (selectedOption?.range ?? 1);
  const selectedTarget =
    targets.find((target) => target.id === targetId) ?? targets.find(inRange) ?? targets[0];
  const bodyTargets =
    selectedTarget?.bodyTargets ?? BODY_TARGETS.map(({ key, label }) => ({ target: key, label }));
  const selectedBodyTarget = bodyTargets.some((option) => option.target === bodyTarget)
    ? bodyTarget
    : (bodyTargets[0]?.target ?? "general");
  const selectedBodyOption = bodyTargets.find((option) => option.target === selectedBodyTarget);
  const aimDifficulty =
    BODY_TARGETS.find((part) => part.key === selectedBodyTarget)?.defenseModifier ?? 0;
  const canAttackSelected =
    !!selectedTarget &&
    !!selectedOption &&
    (inRange(selectedTarget) || canIgnoreRange || selectedTarget.distance === null) &&
    !attackDisabledReason;

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) setTargetId("");
      }}
    >
      <DialogTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className="size-8"
          aria-label={`Atacar com ${attackerName}`}
        >
          <Swords />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ação de {attackerName}</DialogTitle>
          <DialogDescription>
            Escolha o ataque e o alvo; mirar em uma parte específica aumenta o risco, mas pode
            trazer uma vantagem.
          </DialogDescription>
        </DialogHeader>
        {disabledReason ? (
          <p className="rounded border border-border bg-muted/40 p-3 text-sm">{disabledReason}</p>
        ) : (
          <div className="space-y-4">
            {attackDisabledReason && (
              <p className="rounded border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                {attackDisabledReason}
              </p>
            )}
            {!improvising && (
              <div className="grid gap-1.5">
                <label className="mb-1 block max-w-xs space-y-1">
                  <span className="label-caps text-muted-foreground">Origem do ataque</span>
                  <select
                    className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
                    value={attackSource}
                    onChange={(event) => setAttackSource(event.target.value)}
                  >
                    <option value="all">Todos</option>
                    <option value="weapon">Arma equipada</option>
                    <option value="basic">Natural / desarmado</option>
                    <option value="custom">Habilidade / sobrenatural</option>
                  </select>
                </label>
                {availableOptions.map((o) => {
                  const empty = (o.usesMax ?? 0) > 0 && (o.usesCurrent ?? 0) <= 0;
                  return (
                    <button
                      key={o.id}
                      type="button"
                      disabled={empty || !!attackDisabledReason}
                      onClick={() => setOptId(o.id)}
                      className={cn(
                        "flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-sm",
                        opt?.id === o.id ? "border-primary bg-primary/10" : "border-border",
                        (empty || attackDisabledReason) && "opacity-50",
                      )}
                    >
                      {o.imageUrl ? (
                        <img
                          src={o.imageUrl}
                          alt=""
                          className="size-8 shrink-0 rounded object-cover"
                        />
                      ) : null}
                      <span>
                        <b>{o.name}</b>
                        {o.note && (
                          <span className="ml-1 text-xs text-muted-foreground">{o.note}</span>
                        )}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        +{o.hitBonus} · {dmgText(o.damage)} · {o.range} casa{o.range > 1 ? "s" : ""}
                        {(o.energyCost ?? 0) > 0 && ` · ${o.energyCost} energia`}
                        {(o.usesMax ?? 0) > 0 && (
                          <span className={cn("ml-1", empty && "text-destructive")}>
                            · {o.usesCurrent}/{o.usesMax}
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {improvising && (
              <section className="grid gap-3 rounded-md border border-primary/30 bg-muted/20 p-3 sm:grid-cols-4">
                <label className="space-y-1">
                  <span className="label-caps text-muted-foreground">Atributo / perícia</span>
                  <select
                    className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
                    value={improvSkill}
                    onChange={(event) => setImprovSkill(event.target.value)}
                  >
                    {COMBAT_SKILLS.map((skill) => (
                      <option key={skill.key} value={skill.key}>
                        {skill.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="label-caps text-muted-foreground">Dado de dano</span>
                  <select
                    className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
                    value={improvSides}
                    onChange={(event) => setImprovSides(Number(event.target.value))}
                  >
                    {[4, 6, 8, 10, 12].map((sides) => (
                      <option key={sides} value={sides}>
                        1d{sides}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="label-caps text-muted-foreground">Alcance</span>
                  <select
                    className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
                    value={improvRange}
                    onChange={(event) => setImprovRange(Number(event.target.value))}
                  >
                    <option value={1}>Adjacente</option>
                    <option value={3}>Arremesso curto (3)</option>
                    <option value={6}>Arremesso longo (6)</option>
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="label-caps text-muted-foreground">Efeito</span>
                  <select
                    className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
                    value={improvEffect}
                    onChange={(event) => setImprovEffect(event.target.value as typeof improvEffect)}
                  >
                    {EFFECT_CONDITIONS.map((effect) => (
                      <option key={effect.value} value={effect.value}>
                        {effect.label}
                      </option>
                    ))}
                  </select>
                </label>
              </section>
            )}

            {selectedOption && (
              <div className="space-y-1.5">
                <p className="label-caps text-muted-foreground">Alvo</p>
                {targets.length === 0 && (
                  <p className="text-sm text-muted-foreground">Ninguém para atacar.</p>
                )}
                {targets.map((t) => {
                  const targetIsInRange = inRange(t);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      aria-pressed={selectedTarget?.id === t.id}
                      disabled={!!attackDisabledReason}
                      onClick={() => setTargetId(t.id)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-left text-sm",
                        selectedTarget?.id === t.id
                          ? "border-primary bg-primary/10"
                          : targetIsInRange
                            ? "border-destructive/60 hover:bg-destructive/10"
                            : "border-border",
                        attackDisabledReason && "cursor-not-allowed opacity-40",
                      )}
                    >
                      <Avatar
                        src={t.avatar}
                        name={t.name}
                        tone={t.tone}
                        className="size-7 text-[10px]"
                      />
                      <span className="flex-1 font-semibold">{t.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {t.distance === null
                          ? "sem posição no grid"
                          : targetIsInRange
                            ? `${t.distance} casa${t.distance > 1 ? "s" : ""}`
                            : `${t.distance} casa${t.distance > 1 ? "s" : ""} — Fora de alcance${canIgnoreRange ? " (mestre)" : ""}`}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {selectedOption && selectedTarget && (
              <>
                <label className="block space-y-1">
                  <span className="label-caps text-muted-foreground">
                    Mirar em {selectedTarget.name}
                  </span>
                  <select
                    className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
                    value={selectedBodyTarget}
                    onChange={(event) => setBodyTarget(event.target.value as BodyTarget)}
                  >
                    {bodyTargets.map((part, index) => {
                      const modifier =
                        BODY_TARGETS.find((target) => target.key === part.target)
                          ?.defenseModifier ?? 0;
                      return (
                        <option key={`${part.target}-${index}`} value={part.target}>
                          {part.label}
                          {modifier > 0
                            ? ` · +${modifier} dificuldade, crítico ampliado`
                            : modifier < 0
                              ? ` · ${modifier} dificuldade`
                              : " · dificuldade normal"}
                        </option>
                      );
                    })}
                  </select>
                </label>
                <p className="text-xs text-muted-foreground">
                  {selectedBodyOption?.label ?? "Geral"}:{" "}
                  {aimDifficulty > 0
                    ? `mais difícil de acertar (+${aimDifficulty}), mas amplia o dano crítico.`
                    : aimDifficulty < 0
                      ? `mais fácil de acertar (${aimDifficulty}); a proteção da região ainda reduz o dano.`
                      : "sem modificador de acerto; a proteção da região ainda reduz o dano."}
                </p>
                <Button
                  variant="paint"
                  className="w-full"
                  disabled={!canAttackSelected}
                  onClick={() => {
                    onAttack(selectedOption, selectedTarget.id, selectedBodyTarget);
                    setOpen(false);
                    setImprovising(false);
                  }}
                >
                  <Swords />
                  Atacar {selectedTarget.name}
                </Button>
              </>
            )}

            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                onDefend();
                setOpen(false);
              }}
            >
              <Shield /> Defender (+2 defesa e esquiva até a próxima vez)
            </Button>
            <Button
              variant={improvising ? "secondary" : "outline"}
              className="w-full"
              onClick={() => setImprovising((value) => !value)}
            >
              {improvising ? "Voltar aos ataques cadastrados" : "Ataque improvisado"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

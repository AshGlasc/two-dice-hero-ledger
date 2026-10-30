import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Crown,
  Dices,
  Lock,
  Minus,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AttackDialog, type AttackTarget } from "@/components/rpg/AttackDialog";
import { Avatar } from "@/components/rpg/AvatarUpload";
import { BattleMap, type MapToken } from "@/components/rpg/BattleMap";
import { MasterUnlockModal } from "@/components/rpg/MasterUnlockModal";
import { QuickRollPanel } from "@/components/rpg/QuickRollPanel";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useMasterAuth } from "@/context/MasterAuthContext";
import { useCombat } from "@/hooks/use-combat";
import {
  ATTACK_SKILLS,
  CONDITIONS,
  conditionPenalty,
  conditionEmoji,
  INITIATIVE_SKILL,
  attackOptionsForCharacter,
  attackOptionsForMonster,
  canMoveThisTurn,
  changeHp,
  consumeUse,
  DEFEND_BONUS,
  DODGE_SKILL,
  dodges,
  findFreeCell,
  gridDistance,
  moveRangeFor,
  monsterMoveRange,
  nextTurn,
  playerCombatStats,
  previousTurn,
  rollDamage,
  rollHit,
  skillValueFor,
  sortByInitiative,
  uniqueName,
  cellKey,
  type AttackOption,
  type Terrain,
} from "@/lib/combat";
import { EFFECT_TO_CONDITION_NAME } from "@/lib/custom-attacks";
import {
  appSettingsQuery,
  calculateDifficultyBonus,
  parseDifficultyModifiers,
} from "@/lib/difficulty";
import { getPlayerCharacterId } from "@/lib/player-character";
import { postCombatStartToDiscord } from "@/lib/discord-webhook";
import { logRolls } from "@/lib/roll-log";
import {
  battleMapQuery,
  combatQuery,
  groupQuery,
  monstersQuery,
  type Combatant,
} from "@/lib/rpg-queries";
import { roll2d6, rollD6 } from "@/lib/skills";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/combate")({
  head: () => ({
    meta: [
      { title: "Combate — Eco dos Caídos" },
      { name: "description", content: "Mapa de batalha, iniciativa e turnos ao vivo para a mesa." },
      { property: "og:title", content: "Combate — Eco dos Caídos" },
      {
        property: "og:description",
        content: "Mapa de batalha, iniciativa e turnos ao vivo para a mesa.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(combatQuery),
      context.queryClient.ensureQueryData(groupQuery),
      context.queryClient.ensureQueryData(monstersQuery),
      context.queryClient.ensureQueryData(battleMapQuery),
    ]),
  component: CombatPage,
});

function CombatPage() {
  const { data: raw } = useSuspenseQuery(combatQuery);
  const combat = {
    ...raw,
    combatants: raw.combatants.map((x) => ({
      ...x,
      hp_current: x.hp_current ?? 0,
      hp_max: x.hp_max ?? 0,
    })),
  };
  const { data: group } = useSuspenseQuery(groupQuery);
  const { data: monsters } = useSuspenseQuery(monstersQuery);
  const { data: map } = useSuspenseQuery(battleMapQuery);
  const { data: appSettings } = useQuery(appSettingsQuery);
  const { isMaster } = useMasterAuth();
  const c = useCombat();
  const [hpDelta, setHpDelta] = useState(1);
  const [quickRollOpen, setQuickRollOpen] = useState(false);
  const [turnEffect, setTurnEffect] = useState<{
    combatantId: string;
    name: string;
    conditions: string[];
    damageRolls: number[];
  } | null>(null);

  const order = sortByInitiative(combat.combatants);
  const slots = order.map((x) => ({ id: x.id, out: x.kind === "monster" && x.hp_current <= 0 }));
  const { state } = combat;
  const terrain = (map.terrain ?? {}) as Terrain;

  const occupied = () =>
    new Set(
      combat.combatants
        .filter((x) => x.pos_x != null && x.pos_y != null)
        .map((x) => cellKey(x.pos_x!, x.pos_y!)),
    );

  const avatarOf = (x: Pick<Combatant, "kind" | "character_id" | "monster_id">) =>
    x.kind === "character"
      ? (group.characters.find((ch) => ch.id === x.character_id)?.avatar_url ?? "")
      : (monsters.find((m) => m.id === x.monster_id)?.avatar_url ?? "");

  const addCharacter = (id: string) => {
    const ch = group.characters.find((x) => x.id === id);
    if (!ch) return;
    const s = playerCombatStats(ch.fisico, ch.motor);
    const cell = findFreeCell(map.cols, map.rows, terrain, occupied(), "left");
    c.add.mutate([
      {
        kind: "character",
        character_id: ch.id,
        name: ch.name,
        hp_current: s.hp,
        hp_max: s.hp,
        defense: s.defense,
        attack_bonus: Math.max(...ATTACK_SKILLS.map((a) => skillValueFor(group, ch.id, a.key))),
        initiative_bonus: skillValueFor(group, ch.id, INITIATIVE_SKILL),
        pos_x: cell?.x ?? null,
        pos_y: cell?.y ?? null,
      },
    ]);
  };

  const addMonster = (id: string) => {
    const m = monsters.find((x) => x.id === id);
    if (!m) return;
    const cell = findFreeCell(map.cols, map.rows, terrain, occupied(), "right");
    c.add.mutate([
      {
        kind: "monster",
        monster_id: m.id,
        name: uniqueName(
          m.name,
          combat.combatants.map((x) => x.name),
        ),
        hp_current: m.hp_max,
        hp_max: m.hp_max,
        defense: m.defense,
        attack_bonus: m.attack_bonus,
        initiative_bonus: m.initiative_bonus,
        pos_x: cell?.x ?? null,
        pos_y: cell?.y ?? null,
      },
    ]);
  };

  const rollInitiative = async () => {
    const results = combat.combatants.map((x) => ({ x, r: roll2d6(x.initiative_bonus, null) }));
    c.update.mutate(results.map(({ x, r }) => ({ id: x.id, patch: { initiative: r.total } })));
    await logRolls(
      results.map(({ x, r }) => ({
        characterId: x.character_id,
        characterName: x.name,
        label: "Iniciativa",
        result: r,
      })),
    );
    const sorted = sortByInitiative(
      combat.combatants.map((x) => ({
        ...x,
        initiative: results.find((y) => y.x.id === x.id)!.r.total,
      })),
    );
    c.setState.mutate({ active: true, round: 1, current_combatant_id: sorted[0]?.id ?? null });
    if (sorted[0]) prepareTurnEffect(sorted[0].id);
    if (isMaster && sorted.length > 0) {
      void postCombatStartToDiscord(sorted).catch((error: unknown) => {
        console.error("Não foi possível publicar o início do combate no Discord.", error);
        toast.error("Não foi possível avisar o Discord sobre o início do combate.");
      });
    }
  };

  const prepareTurnEffect = (combatantId: string) => {
    const combatant = combat.combatants.find((item) => item.id === combatantId);
    if (!combatant) return;
    const activeConditions = combatant.conditions.filter(
      (condition) => condition === "Sangrando" || condition === "Em chamas",
    );
    if (activeConditions.length === 0) {
      setTurnEffect(null);
      return;
    }
    setTurnEffect({
      combatantId,
      name: combatant.name,
      conditions: activeConditions,
      damageRolls: activeConditions.map(() => rollD6()),
    });
  };

  const advanceTurn = () => {
    const next = nextTurn(slots, state.current_combatant_id, state.round);
    c.setState.mutate({ active: true, current_combatant_id: next.currentId, round: next.round });
    if (next.currentId) {
      prepareTurnEffect(next.currentId);
      // "Defender" dura até a vez de quem se defendeu chegar de novo.
      const upNext = combat.combatants.find((item) => item.id === next.currentId);
      if (upNext?.defending) c.update.mutate([{ id: upNext.id, patch: { defending: false } }]);
    }
  };

  /** Casas entre dois combatentes no mapa (null se algum deles está fora do mapa). */
  const distanceBetween = (a: Combatant, b: Combatant) =>
    a.pos_x == null || a.pos_y == null || b.pos_x == null || b.pos_y == null
      ? null
      : gridDistance(a.pos_x, a.pos_y, b.pos_x, b.pos_y);

  const attackOptionsOf = (x: Combatant): AttackOption[] =>
    x.kind === "character" && x.character_id
      ? attackOptionsForCharacter(group, x.character_id)
      : attackOptionsForMonster(
          x.monster_id,
          monsters.find((m) => m.id === x.monster_id)?.attacks,
          x.attack_bonus,
        );

  /** Alvos possíveis: quem está do outro lado e ainda de pé, com a distância no mapa. */
  const attackTargetsOf = (x: Combatant): AttackTarget[] =>
    order
      .filter((t) => t.id !== x.id && t.kind !== x.kind && t.hp_current > 0)
      .map((t) => ({
        id: t.id,
        name: t.name,
        avatar: avatarOf(t),
        tone: t.kind === "monster" ? "monster" : "player",
        distance: distanceBetween(x, t),
      }));

  /** Por que o ⚔️ está bloqueado agora (null = liberado). O mestre age a qualquer hora. */
  const attackBlockedReason = (x: Combatant) => {
    if (x.kind === "monster" && (x.hp_current ?? 0) <= 0) return `${x.name} está fora de combate.`;
    if (state.active && !isMaster && state.current_combatant_id !== x.id) {
      return "Aguarde a sua vez para agir.";
    }
    return null;
  };

  /**
   * Resolve um ataque: gasta o uso da arma, rola para acertar e, se acertou sem crítico, o alvo
   * (com Velocidade de Reação) rola a esquiva. Esquiva ≥ ataque anula o dano.
   */
  const resolveAttack = (attacker: Combatant, option: AttackOption, targetId: string) => {
    const target = combat.combatants.find((t) => t.id === targetId);
    if (!target) return;

    // Trava estrita de alcance no grid de combate
    const dist = distanceBetween(attacker, target);
    if (!isMaster && dist !== null && dist > option.range) {
      toast.error(`Alvo fora de alcance! Alcance máximo: ${option.range} casa(s), distância atual: ${dist}.`);
      return;
    }

    if (option.weaponId && (option.usesMax ?? 0) > 0) {
      const use = consumeUse(option.usesCurrent ?? 0, option.usesMax ?? 0);
      if (!use.ok) {
        toast.error(`${option.name} está sem munição/durabilidade.`);
        return;
      }
      c.spendWeaponUse.mutate({ id: option.weaponId, usesCurrent: use.next });
    }

    const mods = appSettings?.difficulty_modifiers
      ? parseDifficultyModifiers(appSettings.difficulty_modifiers)
      : null;
    const masterBonus = calculateDifficultyBonus(
      mods,
      attacker.kind === "character" ? attacker.character_id : null,
      option.kind === "basic" ? "fisico" : null,
    );

    const attackerPenalty = conditionPenalty(attacker.conditions);
    const targetPenalty = conditionPenalty(target.conditions);
    const defendBonus = target.defending ? DEFEND_BONUS : 0;
    const defense =
      target.defense == null
        ? null
        : Math.max(2, target.defense + defendBonus - targetPenalty + masterBonus);
    if (attackerPenalty || targetPenalty) {
      toast(`Penalidades aplicadas: ataque −${attackerPenalty}, defesa do alvo −${targetPenalty}.`);
    }

    const r = rollHit(option.hitDice, option.hitBonus - attackerPenalty, defense);
    const crit = r.outcome === "critical-success";
    const hit = r.outcome === "success" || crit;
    const damage = hit ? rollDamage(option.damage) + (crit ? 3 : 0) : 0;

    // Esquiva: só em acerto comum (duplo 6 nunca é esquivado) e só quem tem a skill (personagens).
    let dodgeRoll: ReturnType<typeof roll2d6> | null = null;
    if (hit && !crit && target.kind === "character" && target.character_id) {
      dodgeRoll = roll2d6(
        skillValueFor(group, target.character_id, DODGE_SKILL) + defendBonus,
        null,
      );
    }
    const dodged = dodgeRoll !== null && dodges(r.total, dodgeRoll.total);

    let conditionAdded: string | null = null;
    let nextConditions = [...target.conditions];
    if (hit && !dodged && option.effectCondition && option.effectCondition !== "none") {
      const mapped = EFFECT_TO_CONDITION_NAME[option.effectCondition];
      if (mapped && !nextConditions.includes(mapped)) {
        nextConditions.push(mapped);
        conditionAdded = mapped;
      }
    }

    let defenseDebuffed = 0;
    let nextDefense = target.defense;
    if (hit && !dodged && option.defenseDebuff && option.defenseDebuff > 0 && target.defense != null) {
      defenseDebuffed = option.defenseDebuff;
      nextDefense = Math.max(0, target.defense - defenseDebuffed);
    }

    const effectsSummary: string[] = [];
    if (conditionAdded) effectsSummary.push(`causou ${conditionAdded}`);
    if (defenseDebuffed > 0) effectsSummary.push(`reduziu a defesa do alvo em ${defenseDebuffed}`);
    const effectsText =
      effectsSummary.length > 0 ? ` (${effectsSummary.join(" e ")}!)` : "";

    void logRolls([
      {
        characterId: attacker.character_id,
        characterName: attacker.name,
        label: `${option.name} em ${target.name}${
          !hit
            ? " — errou"
            : dodged
              ? " — esquivado"
              : ` — ${damage} de dano${effectsText}`
        }`,
        result: r,
        masterBonus: masterBonus !== 0 ? masterBonus : undefined,
      },
      ...(dodgeRoll
        ? [
            {
              characterId: target.character_id,
              characterName: target.name,
              label: dodged
                ? `${target.name} esquivou do ataque!`
                : `Esquiva de ${target.name} — não conseguiu desviar`,
              result: dodgeRoll,
            },
          ]
        : []),
    ]);

    if (!hit) return;
    if (dodged) {
      toast(`${target.name} esquivou do ataque!`);
      return;
    }

    c.update.mutate([
      {
        id: target.id,
        patch: {
          hp_current: changeHp(target.hp_current, -damage, target.hp_max),
          ...(conditionAdded ? { conditions: nextConditions } : {}),
          ...(defenseDebuffed > 0 ? { defense: nextDefense } : {}),
        },
      },
    ]);

    toast.success(`${attacker.name} acertou ${target.name}: −${damage} de vida${effectsText}.`);
  };

  const defend = (x: Combatant) => {
    c.update.mutate([{ id: x.id, patch: { defending: true } }]);
    toast(`${x.name} se defende: +${DEFEND_BONUS} em defesa e esquiva até o próximo turno.`);
  };

  /** Casas por turno: Motor do personagem; monstro sem Motor definido anda 3. */
  const moveRangeOf = (x: Combatant) =>
    x.kind === "character"
      ? moveRangeFor(group.characters.find((ch) => ch.id === x.character_id)?.motor)
      : monsterMoveRange(monsters.find((m) => m.id === x.monster_id)?.motor);

  /** Andar conta como o passo da rodada; colocar no mapa (ou tirar dele) não conta. */
  const moveCombatant = (id: string, x: number | null, y: number | null) => {
    const who = combat.combatants.find((item) => item.id === id);
    const stepped = state.active && x !== null && y !== null && who?.pos_x != null;
    c.update.mutate([
      { id, patch: { pos_x: x, pos_y: y, ...(stepped ? { moved_round: state.round } : {}) } },
    ]);
  };

  const tokens: MapToken[] = order.map((x) => ({
    id: x.id,
    characterId: x.kind === "character" ? x.character_id : null,
    name: x.name,
    avatar: avatarOf(x),
    tone: x.kind === "monster" ? "monster" : "player",
    x: x.pos_x,
    y: x.pos_y,
    hpPct: x.hp_max ? x.hp_current / x.hp_max : null,
    out: x.hp_current <= 0,
    current: x.id === state.current_combatant_id,
    conditions: x.conditions,
    moveRange: moveRangeOf(x),
    moved: !canMoveThisTurn(x.moved_round, state.round, state.active),
  }));

  const myId = getPlayerCharacterId();
  /** Mestre controla todos; jogador só o próprio personagem. */
  const mine = (x: Combatant) => isMaster || (!!myId && x.character_id === myId);

  const inCombat = new Set(combat.combatants.map((x) => x.character_id));

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-3 md:p-6">
      <header className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2">
          <h1 className="font-display text-3xl font-bold uppercase">Combate</h1>
          {isMaster ? (
            <span className="flex items-center gap-1 rounded bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase text-primary">
              <Crown className="size-3" /> Mestre Ativo
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Lock className="size-3" /> Jogador
            </span>
          )}
        </div>
        {state.active && <span className="label-caps text-primary">Rodada {state.round}</span>}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {isMaster ? (
            <>
              <select
                className="h-9 rounded-md border border-border bg-card px-2 text-sm"
                value=""
                onChange={(e) => addCharacter(e.target.value)}
              >
                <option value="">+ Jogador</option>
                {group.characters
                  .filter((ch) => !inCombat.has(ch.id))
                  .map((ch) => (
                    <option key={ch.id} value={ch.id}>
                      {ch.name}
                    </option>
                  ))}
              </select>
              <select
                className="h-9 rounded-md border border-border bg-card px-2 text-sm"
                value=""
                onChange={(e) => addMonster(e.target.value)}
              >
                <option value="">+ Monstro</option>
                {monsters.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
              <Button size="sm" onClick={rollInitiative} disabled={!combat.combatants.length}>
                <Dices /> Iniciativa
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!!turnEffect}
                onClick={() => {
                  const p = previousTurn(slots, state.current_combatant_id, state.round);
                  c.setState.mutate({ current_combatant_id: p.currentId, round: p.round });
                }}
              >
                <ChevronLeft />
              </Button>
              <Button size="sm" variant="outline" disabled={!!turnEffect} onClick={advanceTurn}>
                Próximo <ChevronRight />
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => confirm("Encerrar combate?") && c.end.mutate()}
              >
                <X /> Encerrar
              </Button>
            </>
          ) : (
            <MasterUnlockModal
              trigger={
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  <Lock className="size-3.5" /> Controle do Mestre
                </Button>
              }
            />
          )}
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="overflow-auto rounded-lg border border-border bg-card p-2">
          <BattleMap
            map={map}
            tokens={tokens}
            combatActive={state.active}
            currentCombatantId={state.current_combatant_id}
            onMove={moveCombatant}
          />
        </div>

        <aside className="space-y-2">
          <Collapsible open={quickRollOpen} onOpenChange={setQuickRollOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm" className="w-full justify-between">
                <span className="flex items-center gap-2">
                  <Dices /> Testes rápidos de skill
                </span>
                <ChevronDown
                  className={cn("transition-transform", quickRollOpen && "rotate-180")}
                />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              <QuickRollPanel group={group} />
            </CollapsibleContent>
          </Collapsible>
          {isMaster && (
            <div className="flex items-center gap-2 text-sm">
              <span className="label-caps">Dano/cura:</span>
              <Button
                size="icon"
                variant="outline"
                className="size-7"
                onClick={() => setHpDelta((d) => Math.max(1, d - 1))}
              >
                <Minus />
              </Button>
              <span className="w-6 text-center font-bold">{hpDelta}</span>
              <Button
                size="icon"
                variant="outline"
                className="size-7"
                onClick={() => setHpDelta((d) => d + 1)}
              >
                <Plus />
              </Button>
            </div>
          )}
          {order.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Adicione jogadores e monstros para começar.
            </p>
          )}
          {order.map((x) => (
            <div
              key={x.id}
              className={cn(
                "rounded-lg border border-border bg-card p-3",
                x.id === state.current_combatant_id && "border-primary ring-2 ring-primary",
                x.hp_current <= 0 && "opacity-50",
              )}
            >
              <div className="flex items-center gap-2">
                <Avatar
                  src={avatarOf(x)}
                  name={x.name}
                  tone={x.kind === "monster" ? "monster" : "player"}
                  className="size-10"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">
                    {x.name}{" "}
                    {x.conditions.map((cd) => (
                      <span
                        key={cd}
                        title={
                          cd === "Atordoado" || cd === "Caído" ? `${cd}: −2 em ataque e defesa` : cd
                        }
                      >
                        {conditionEmoji(cd)}
                      </span>
                    ))}
                    {x.defending && (
                      <span title={`Defendendo: +${DEFEND_BONUS} em defesa e esquiva`}>🛡️</span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Inic. {x.initiative ?? "—"} · Def {x.defense}
                    {x.defending && ` (+${DEFEND_BONUS})`}
                    {conditionPenalty(x.conditions) > 0 && ` (−${conditionPenalty(x.conditions)})`}
                    {" · "}Atq +{x.attack_bonus}
                    {conditionPenalty(x.conditions) > 0 && ` (−${conditionPenalty(x.conditions)})`}
                  </p>
                </div>
                {mine(x) && (
                  <AttackDialog
                    attackerName={x.name}
                    options={attackOptionsOf(x)}
                    targets={attackTargetsOf(x)}
                    canIgnoreRange={isMaster}
                    disabledReason={attackBlockedReason(x)}
                    onAttack={(option, targetId) => resolveAttack(x, option, targetId)}
                    onDefend={() => defend(x)}
                  />
                )}
                {isMaster && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-8"
                    onClick={() => c.remove.mutate(x.id)}
                    aria-label="Remover"
                  >
                    <Trash2 />
                  </Button>
                )}
              </div>
              {/* PV e condições à mão: só o mestre. Jogador só vê; o PV muda pelos ataques e esquivas. */}
              {!isMaster ? (
                <div className="mt-2 flex items-center gap-2">
                  <div className="h-2 flex-1 overflow-hidden rounded bg-muted">
                    <div
                      className="h-full bg-destructive"
                      style={{ width: `${(x.hp_current / Math.max(1, x.hp_max)) * 100}%` }}
                    />
                  </div>
                  {x.kind === "character" && (
                    <span className="w-14 text-right text-sm font-bold">
                      {x.hp_current}/{x.hp_max}
                    </span>
                  )}
                </div>
              ) : (
                <>
                  <div className="mt-2 flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7"
                      onClick={() =>
                        c.update.mutate([
                          {
                            id: x.id,
                            patch: { hp_current: changeHp(x.hp_current, -hpDelta, x.hp_max) },
                          },
                        ])
                      }
                    >
                      −{hpDelta}
                    </Button>
                    <div className="h-2 flex-1 overflow-hidden rounded bg-muted">
                      <div
                        className="h-full bg-destructive"
                        style={{ width: `${(x.hp_current / Math.max(1, x.hp_max)) * 100}%` }}
                      />
                    </div>
                    <span className="w-14 text-right text-sm font-bold">
                      {x.hp_current}/{x.hp_max}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7"
                      onClick={() =>
                        c.update.mutate([
                          {
                            id: x.id,
                            patch: { hp_current: changeHp(x.hp_current, hpDelta, x.hp_max) },
                          },
                        ])
                      }
                    >
                      +{hpDelta}
                    </Button>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {CONDITIONS.map((cond) => {
                      const on = x.conditions.includes(cond);
                      return (
                        <button
                          key={cond}
                          type="button"
                          onClick={() =>
                            c.update.mutate([
                              {
                                id: x.id,
                                patch: {
                                  conditions: on
                                    ? x.conditions.filter((k) => k !== cond)
                                    : [...x.conditions, cond],
                                },
                              },
                            ])
                          }
                          className={cn(
                            "rounded-full border px-2 py-0.5 text-[11px]",
                            on
                              ? "border-destructive bg-destructive/20 text-destructive"
                              : "border-border text-muted-foreground",
                          )}
                        >
                          {conditionEmoji(cond)} {cond}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          ))}
        </aside>
      </div>
      {turnEffect && (
        <div
          className="fixed inset-0 z-[70] grid place-items-center bg-black/70 p-4"
          role="presentation"
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="turn-effect-title"
            className="w-full max-w-sm space-y-4 rounded-xl border border-destructive/50 bg-card p-5 shadow-paint"
          >
            <div>
              <p className="label-caps text-destructive">Início do turno</p>
              <h2 id="turn-effect-title" className="font-display text-2xl font-bold uppercase">
                Dano de condição: {turnEffect.name}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {turnEffect.conditions.join(" + ")} ·{" "}
                {turnEffect.damageRolls.map((roll) => `1d6 (${roll})`).join(" + ")}
              </p>
              <p className="mt-2 font-bold">
                Aplicar {turnEffect.damageRolls.reduce((sum, roll) => sum + roll, 0)} de dano?
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setTurnEffect(null)}>
                Ignorar
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  const combatant = combat.combatants.find(
                    (item) => item.id === turnEffect.combatantId,
                  );
                  if (combatant) {
                    const damage = turnEffect.damageRolls.reduce((sum, roll) => sum + roll, 0);
                    c.update.mutate([
                      {
                        id: combatant.id,
                        patch: {
                          hp_current: changeHp(combatant.hp_current, -damage, combatant.hp_max),
                        },
                      },
                    ]);
                  }
                  setTurnEffect(null);
                }}
              >
                Aplicar dano
              </Button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

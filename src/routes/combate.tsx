import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
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
import { IntimidateDialog } from "@/components/rpg/IntimidateDialog";
import { ConvinceDialog } from "@/components/rpg/ConvinceDialog";
import { MasterUnlockModal } from "@/components/rpg/MasterUnlockModal";
import { QuickRollPanel } from "@/components/rpg/QuickRollPanel";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useMasterAuth } from "@/context/MasterAuthContext";
import { useCombat } from "@/hooks/use-combat";
import { supabase } from "@/integrations/supabase/client";
import {
  ATTACK_SKILLS,
  CONDITIONS,
  conditionPenalty,
  conditionEmoji,
  INITIATIVE_SKILL,
  attackOptionsForCharacter,
  attackOptionsForMonster,
  canMoveThisTurn,
  canMoveTo,
  changeHp,
  cellKey,
  consumeUse,
  DEFEND_BONUS,
  DODGE_SKILL,
  dodges,
  findFreeCell,
  gridDistance,
  intimidationRetreatCell,
  MOVEMENT_RANGE,
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
  type AttackOption,
  type Fog,
  type Terrain,
  tokenVisible,
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
  battleMapItemsQuery,
  combatQuery,
  combatEventsQuery,
  groupQuery,
  monstersQuery,
  type Combatant,
  type BattleMapItem,
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
      context.queryClient.ensureQueryData(battleMapItemsQuery),
    ]),
  component: CombatPage,
});

function CombatPage() {
  const { data: raw } = useSuspenseQuery(combatQuery);
  const { data: combatEvents = [] } = useQuery(combatEventsQuery);
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
  const { data: mapItems } = useSuspenseQuery(battleMapItemsQuery);
  const { data: catalogItems = [] } = useQuery({
    queryKey: ["catalog_items"],
    queryFn: async () => {
      const { data, error } = await supabase.from("catalog_items").select("*");
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: appSettings } = useQuery(appSettingsQuery);
  const { isMaster } = useMasterAuth();
  const c = useCombat();
  const qc = useQueryClient();
  const [hpDelta, setHpDelta] = useState(1);
  const [quickRollOpen, setQuickRollOpen] = useState(false);
  const [selectedCatalogItemId, setSelectedCatalogItemId] = useState("");
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
  const fog = (map.fog ?? {}) as Fog;
  const myId = getPlayerCharacterId();

  const energyValue = (characterId: string, key: "vigor" | "vontade") => {
    const character = group.characters.find((item) => item.id === characterId);
    if (!character) return 0;
    return skillValueFor(group, characterId, key) + (character.energia_atual <= 0 ? 2 : 0);
  };
  const maxEnergy = (characterId: string) =>
    Math.max(
      1,
      10 + 2 * energyValue(characterId, "vigor") + 2 * energyValue(characterId, "vontade"),
    );
  const persistEnergy = async (characterId: string, value: number) => {
    const maximum = maxEnergy(characterId);
    const { error } = await supabase
      .from("characters")
      .update({ energia_atual: Math.max(0, Math.min(maximum, value)), energia_maxima: maximum })
      .eq("id", characterId);
    if (error) throw error;
    void qc.invalidateQueries({ queryKey: ["group"] });
    void qc.invalidateQueries({ queryKey: ["sheet", characterId] });
  };
  const spendEnergy = async (attacker: Combatant, cost: number) => {
    if (!attacker.character_id || cost <= 0) return { accepted: true, hpCost: 0 };
    const character = group.characters.find((item) => item.id === attacker.character_id);
    if (!character) return { accepted: false, hpCost: 0 };
    const energy = Math.max(0, character.energia_atual);
    const hpCost = Math.max(0, cost - energy);
    if (
      hpCost > 0 &&
      !window.confirm(
        `Energia insuficiente. Esforço Desesperado gastará ${energy} energia e causará ${hpCost} de dano direto aos PV. Continuar?`,
      )
    ) {
      return { accepted: false, hpCost: 0 };
    }
    try {
      await persistEnergy(attacker.character_id, Math.max(0, energy - cost));
      return { accepted: true, hpCost };
    } catch (error) {
      toast.error(
        `Não foi possível atualizar a energia: ${error instanceof Error ? error.message : "erro desconhecido"}`,
      );
      return { accepted: false, hpCost: 0 };
    }
  };
  const recoverPassiveEnergy = (combatantId: string) => {
    const combatant = combat.combatants.find((item) => item.id === combatantId);
    if (combatant?.kind !== "character" || !combatant.character_id) return;
    const character = group.characters.find((item) => item.id === combatant.character_id);
    if (!character) return;
    const vigor = energyValue(character.id, "vigor");
    const will = energyValue(character.id, "vontade");
    void persistEnergy(
      character.id,
      character.energia_atual + 1 + Math.floor((vigor + will) / 2),
    ).catch((error: unknown) => {
      console.error("Falha na regeneração passiva de energia.", error);
      toast.error("Não foi possível regenerar a energia.");
    });
  };
  const conditionDurationsOf = (combatant: Combatant): Record<string, number> => {
    const raw = combatant.condition_durations;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
    return Object.fromEntries(
      Object.entries(raw).filter(
        (entry): entry is [string, number] => typeof entry[1] === "number",
      ),
    );
  };
  const logCombatEvent = async (combatant: Combatant, description: string) => {
    const { error } = await supabase.from("combat_events").insert({
      character_id: combatant.character_id,
      character_name: combatant.name,
      description,
    });
    if (error) {
      console.error("Não foi possível registrar a ação no log de combate.", error);
      toast.error("A ação foi aplicada, mas não foi possível registrar no log.");
      return;
    }
    void qc.invalidateQueries({ queryKey: ["combat_events"] });
  };

  const occupied = () =>
    new Set(
      combat.combatants
        .filter(
          (x) => x.pos_x != null && x.pos_y != null && !(x.kind === "monster" && x.hp_current <= 0),
        )
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
    if (sorted[0]) {
      prepareTurnEffect(sorted[0].id);
      recoverPassiveEnergy(sorted[0].id);
    }
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
    const previous = combat.combatants.find((item) => item.id === state.current_combatant_id);
    if (previous?.conditions.includes("Hesitante")) {
      c.update.mutate([
        {
          id: previous.id,
          patch: {
            conditions: previous.conditions.filter((condition) => condition !== "Hesitante"),
          },
        },
      ]);
    }
    const next = nextTurn(slots, state.current_combatant_id, state.round);
    c.setState.mutate({ active: true, current_combatant_id: next.currentId, round: next.round });
    if (next.round !== state.round) {
      for (const combatant of combat.combatants) {
        const durations = conditionDurationsOf(combatant);
        const nextDurations: Record<string, number> = {};
        const expired: string[] = [];
        for (const [condition, remaining] of Object.entries(durations)) {
          if (remaining <= 1) expired.push(condition);
          else nextDurations[condition] = remaining - 1;
        }
        if (
          expired.length > 0 ||
          Object.keys(nextDurations).length !== Object.keys(durations).length
        ) {
          c.update.mutate([
            {
              id: combatant.id,
              patch: {
                conditions: combatant.conditions.filter(
                  (condition) => !expired.includes(condition),
                ),
                condition_durations: nextDurations,
              },
            },
          ]);
        }
      }
    }
    if (next.currentId) {
      prepareTurnEffect(next.currentId);
      recoverPassiveEnergy(next.currentId);
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

  const intimidationTargetsOf = (x: Combatant): AttackTarget[] =>
    order
      .filter((target) => {
        if (target.id === x.id || target.kind === x.kind || target.hp_current <= 0) {
          return false;
        }
        const distance = distanceBetween(x, target);
        return (
          distance === null ||
          (distance <= MOVEMENT_RANGE &&
            (target.pos_x == null ||
              target.pos_y == null ||
              tokenVisible(
                fog,
                target.pos_x,
                target.pos_y,
                isMaster,
                target.kind === "character" && target.character_id === myId,
              )))
        );
      })
      .map((target) => ({
        id: target.id,
        name: target.name,
        avatar: avatarOf(target),
        tone: target.kind === "monster" ? "monster" : "player",
        distance: distanceBetween(x, target),
      }));

  const isCollapsed = (combatant: Combatant) =>
    combatant.kind === "character" &&
    group.characters.find((character) => character.id === combatant.character_id)
      ?.sanity_current === 0;

  /** Por que o ⚔️ está bloqueado agora (null = liberado). O mestre age a qualquer hora. */
  const attackBlockedReason = (x: Combatant) => {
    if (x.kind === "monster" && (x.hp_current ?? 0) <= 0) return `${x.name} está fora de combate.`;
    if (x.conditions.includes("Hostilidade Quebrada"))
      return "O alvo perdeu a intenção hostil até sofrer dano direto.";
    if (state.active && !isMaster && state.current_combatant_id !== x.id) {
      return "Aguarde a sua vez para agir.";
    }
    return null;
  };

  /**
   * Resolve um ataque: gasta o uso da arma, rola para acertar e, se acertou sem crítico, o alvo
   * (com Velocidade de Reação) rola a esquiva. Esquiva ≥ ataque anula o dano.
   */
  const resolveAttack = async (
    attacker: Combatant,
    option: AttackOption,
    targetId: string,
    areaSubattack = false,
    skipRange = false,
    consumeAction = true,
  ) => {
    const target = combat.combatants.find((t) => t.id === targetId);
    if (!target || target.hp_current <= 0) return;

    const dist = distanceBetween(attacker, target);
    if (!skipRange && !isMaster && dist !== null && dist > option.range) {
      toast.error(
        `Alvo fora de alcance! Alcance máximo: ${option.range} casa(s), distância atual: ${dist}.`,
      );
      return;
    }

    if (option.reach === "area" && !areaSubattack) {
      const payment = await spendEnergy(attacker, option.energyCost ?? 0);
      if (!payment.accepted) return;
      if (payment.hpCost > 0) {
        c.update.mutate([
          {
            id: attacker.id,
            patch: {
              hp_current: changeHp(attacker.hp_current ?? 0, -payment.hpCost, attacker.hp_max ?? 0),
            },
          },
        ]);
      }
      const affected = combat.combatants.filter((candidate) => {
        if (candidate.hp_current <= 0 || candidate.id === attacker.id) return false;
        if (candidate.kind === attacker.kind) return false;
        if (candidate.id === target.id) return true;
        const areaDistance = distanceBetween(target, candidate);
        return areaDistance !== null && areaDistance <= 1;
      });
      for (const candidate of affected) {
        await resolveAttack(
          attacker,
          { ...option, energyCost: 0 },
          candidate.id,
          true,
          true,
          false,
        );
      }
      if (consumeAction && state.active && state.current_combatant_id === attacker.id)
        advanceTurn();
      return;
    }

    const energyPayment = await spendEnergy(attacker, option.energyCost ?? 0);
    if (!energyPayment.accepted) return;
    if (energyPayment.hpCost > 0) {
      c.update.mutate([
        {
          id: attacker.id,
          patch: {
            hp_current: changeHp(
              attacker.hp_current ?? 0,
              -energyPayment.hpCost,
              attacker.hp_max ?? 0,
            ),
          },
        },
      ]);
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
    const resistanceSkill =
      option.kind === "custom" && option.resistanceType === "Vontade"
        ? "vontade"
        : option.kind === "custom" && option.resistanceType === "Esquiva"
          ? DODGE_SKILL
          : null;
    const resistanceValue =
      resistanceSkill && target.character_id
        ? skillValueFor(group, target.character_id, resistanceSkill)
        : target.defense;
    const defense =
      resistanceValue == null
        ? null
        : Math.max(
            2,
            resistanceValue + target.temporary_shield + defendBonus - targetPenalty + masterBonus,
          );
    if (attackerPenalty || targetPenalty) {
      toast(`Penalidades aplicadas: ataque −${attackerPenalty}, defesa do alvo −${targetPenalty}.`);
    }

    const r = rollHit(option.hitDice, option.hitBonus - attackerPenalty, defense);
    const crit = r.outcome === "critical-success";
    const hit = r.outcome === "success" || crit;
    const damage = hit ? rollDamage(option.damage) + (crit ? 3 : 0) : 0;

    // Esquiva: só em acerto comum (duplo 6 nunca é esquivado) e só quem tem a skill (personagens).
    let dodgeRoll: ReturnType<typeof roll2d6> | null = null;
    if (
      hit &&
      !crit &&
      !(option.kind === "custom" && option.resistanceType === "Esquiva") &&
      target.kind === "character" &&
      target.character_id
    ) {
      dodgeRoll = roll2d6(
        skillValueFor(group, target.character_id, DODGE_SKILL) + defendBonus - targetPenalty,
        null,
      );
    }
    const dodged = dodgeRoll !== null && dodges(r.total, dodgeRoll.total);

    let conditionAdded: string | null = null;
    const nextConditions = [...target.conditions];
    if (hit && !dodged && option.effectCondition && option.effectCondition !== "none") {
      const mapped = EFFECT_TO_CONDITION_NAME[option.effectCondition];
      if (mapped && !nextConditions.includes(mapped)) {
        nextConditions.push(mapped);
        conditionAdded = mapped;
      }
    }

    let defenseDebuffed = 0;
    let nextDefense = target.defense;
    if (
      hit &&
      !dodged &&
      option.defenseDebuff &&
      option.defenseDebuff > 0 &&
      target.defense != null
    ) {
      defenseDebuffed = option.defenseDebuff;
      nextDefense = Math.max(0, target.defense - defenseDebuffed);
    }

    const effectsSummary: string[] = [];
    if (conditionAdded) effectsSummary.push(`causou ${conditionAdded}`);
    if (defenseDebuffed > 0) effectsSummary.push(`reduziu a defesa do alvo em ${defenseDebuffed}`);
    const effectsText = effectsSummary.length > 0 ? ` (${effectsSummary.join(" e ")}!)` : "";

    void logRolls([
      {
        characterId: attacker.character_id,
        characterName: attacker.name,
        label: `${option.name} em ${target.name}${
          !hit ? " — errou" : dodged ? " — esquivado" : ` — ${damage} de dano${effectsText}`
        }`,
        result: r,
        ...(masterBonus !== 0 ? { masterBonus } : {}),
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

    if (!hit) {
      if (consumeAction && state.active && state.current_combatant_id === attacker.id)
        advanceTurn();
      toast(`${attacker.name} errou; a ação foi consumida.`);
      return;
    }
    if (dodged) {
      toast(`${target.name} esquivou do ataque!`);
      if (consumeAction && state.active && state.current_combatant_id === attacker.id)
        advanceTurn();
      return;
    }

    const shieldAbsorbed = Math.min(target.temporary_shield, damage);
    const durationMap = conditionDurationsOf(target);
    if (conditionAdded && option.durationRounds != null && option.durationRounds > 0) {
      durationMap[conditionAdded] = option.durationRounds;
    }
    c.update.mutate([
      {
        id: target.id,
        patch: {
          hp_current: changeHp(target.hp_current, -(damage - shieldAbsorbed), target.hp_max),
          temporary_shield: Math.max(0, target.temporary_shield - shieldAbsorbed),
          conditions: nextConditions.filter((condition) => condition !== "Hostilidade Quebrada"),
          condition_durations: durationMap,
          ...(defenseDebuffed > 0 ? { defense: nextDefense } : {}),
        },
      },
    ]);

    toast.success(
      `${attacker.name} acertou ${target.name}: −${damage - shieldAbsorbed} PV${shieldAbsorbed ? ` (${shieldAbsorbed} absorvido pelo escudo)` : ""}${effectsText}.`,
    );
    if (consumeAction && state.active && state.current_combatant_id === attacker.id) advanceTurn();
  };

  const resolveIntimidation = async (attacker: Combatant, targetId: string) => {
    const target = combat.combatants.find((item) => item.id === targetId);
    if (
      !target ||
      attacker.kind !== "character" ||
      !attacker.character_id ||
      target.kind === attacker.kind
    ) {
      return;
    }
    const payment = await spendEnergy(attacker, 1);
    if (!payment.accepted) return;
    if (payment.hpCost > 0) {
      c.update.mutate([
        {
          id: attacker.id,
          patch: {
            hp_current: changeHp(attacker.hp_current ?? 0, -payment.hpCost, attacker.hp_max ?? 0),
          },
        },
      ]);
    }

    const attackerModifier =
      Math.max(
        skillValueFor(group, attacker.character_id, "autoridade"),
        skillValueFor(group, attacker.character_id, "ferramenta_fisica"),
      ) - conditionPenalty(attacker.conditions);
    const targetCharacterId = target.character_id;
    const defenderModifier =
      target.kind === "character" && targetCharacterId
        ? Math.max(
            skillValueFor(group, targetCharacterId, "vontade"),
            skillValueFor(group, targetCharacterId, "compostura"),
          ) - conditionPenalty(target.conditions)
        : (target.defense ?? 0);
    const attackerRoll = roll2d6(attackerModifier, null);
    const defenderRoll = roll2d6(defenderModifier, null);
    const succeeded =
      attackerRoll.outcome === "critical-success" || attackerRoll.total > defenderRoll.total;
    const targetName = target.name;

    if (!succeeded) {
      void logCombatEvent(attacker, `${attacker.name} tentou intimidar ${targetName}; falhou.`);
      void logRolls([
        {
          characterId: attacker.character_id,
          characterName: attacker.name,
          label: `${attacker.name} tentou intimidar ${targetName}, mas o alvo resistiu.`,
          result: attackerRoll,
        },
        {
          characterId: targetCharacterId,
          characterName: targetName,
          label: `${targetName} resistiu à intimidação.`,
          result: defenderRoll,
        },
      ]);
      if (state.active && state.current_combatant_id === attacker.id) advanceTurn();
      toast(`${targetName} resistiu à intimidação. A ação foi consumida.`);
      return;
    }

    const nextConditions = target.conditions.includes("Amedrontado")
      ? target.conditions
      : [...target.conditions, "Amedrontado"];
    let retreat: { x: number; y: number } | null = null;
    if (
      attacker.pos_x != null &&
      attacker.pos_y != null &&
      target.pos_x != null &&
      target.pos_y != null
    ) {
      const occupiedWithoutTarget = occupied();
      occupiedWithoutTarget.delete(cellKey(target.pos_x, target.pos_y));
      retreat = intimidationRetreatCell(
        { x: attacker.pos_x, y: attacker.pos_y },
        { x: target.pos_x, y: target.pos_y },
        map.cols,
        map.rows,
        terrain,
        occupiedWithoutTarget,
      );
    }
    const message = retreat
      ? `${attacker.name} intimidou ${targetName}, aplicando Amedrontado e forçando recuo!`
      : `${attacker.name} intimidou ${targetName}, aplicando Amedrontado; recuo bloqueado.`;
    void logCombatEvent(attacker, message);
    void logRolls([
      {
        characterId: attacker.character_id,
        characterName: attacker.name,
        label: message,
        result: attackerRoll,
      },
      {
        characterId: targetCharacterId,
        characterName: targetName,
        label: `${targetName} falhou ao resistir à intimidação.`,
        result: defenderRoll,
      },
    ]);
    c.update.mutate([
      {
        id: target.id,
        patch: {
          conditions: nextConditions,
          ...(retreat ? { pos_x: retreat.x, pos_y: retreat.y } : {}),
        },
      },
    ]);
    if (state.active && state.current_combatant_id === attacker.id) advanceTurn();
    toast.success(message);
  };

  const resolveConvince = async (attacker: Combatant, targetId: string) => {
    const target = combat.combatants.find((item) => item.id === targetId);
    if (
      !target ||
      attacker.kind !== "character" ||
      !attacker.character_id ||
      target.kind === attacker.kind ||
      target.hp_current <= 0
    )
      return;
    const payment = await spendEnergy(attacker, 2);
    if (!payment.accepted) return;
    if (payment.hpCost > 0) {
      c.update.mutate([
        {
          id: attacker.id,
          patch: {
            hp_current: changeHp(attacker.hp_current ?? 0, -payment.hpCost, attacker.hp_max ?? 0),
          },
        },
      ]);
    }
    const empathy = skillValueFor(group, attacker.character_id, "empatia");
    const suggestion = skillValueFor(group, attacker.character_id, "sugestao");
    const attackerRoll = roll2d6(
      empathy + suggestion - conditionPenalty(attacker.conditions),
      null,
    );
    const targetCharacterId = target.character_id;
    const defense =
      target.kind === "character" && targetCharacterId
        ? Math.max(
            skillValueFor(group, targetCharacterId, "vontade"),
            skillValueFor(group, targetCharacterId, "compostura"),
          ) - conditionPenalty(target.conditions)
        : (target.defense ?? 0);
    const defenderRoll = roll2d6(defense, null);
    const success =
      attackerRoll.outcome === "critical-success" || attackerRoll.total > defenderRoll.total;
    const critical = success && attackerRoll.outcome === "critical-success";
    const resultLabel = success
      ? critical
        ? `${attacker.name} convenceu ${target.name}; o alvo perdeu a intenção hostil até sofrer dano.`
        : `${attacker.name} deixou ${target.name} Hesitante por uma rodada.`
      : `${target.name} resistiu à tentativa de convencimento.`;
    void logRolls([
      {
        characterId: attacker.character_id,
        characterName: attacker.name,
        label: resultLabel,
        result: attackerRoll,
      },
      {
        characterId: targetCharacterId,
        characterName: target.name,
        label: `${target.name} contestou o convencimento.`,
        result: defenderRoll,
      },
    ]);
    if (success) {
      const appliedCondition = critical ? "Hostilidade Quebrada" : "Hesitante";
      if (!target.conditions.includes(appliedCondition)) {
        c.update.mutate([
          { id: target.id, patch: { conditions: [...target.conditions, appliedCondition] } },
        ]);
      }
      toast.success(resultLabel);
    } else {
      toast(`${resultLabel} Ação e energia consumidas.`);
    }
    void logCombatEvent(attacker, resultLabel);
    if (state.active && state.current_combatant_id === attacker.id) advanceTurn();
  };

  const defend = (x: Combatant) => {
    c.update.mutate([{ id: x.id, patch: { defending: true } }]);
    toast(`${x.name} se defende: +${DEFEND_BONUS} em defesa e esquiva até o próximo turno.`);
    if (state.active && state.current_combatant_id === x.id) advanceTurn();
  };

  /** Casas por turno: Motor do personagem; monstro sem Motor definido anda 3. */
  const moveRangeOf = (x: Combatant) => {
    if (x.kind !== "character")
      return monsterMoveRange(monsters.find((m) => m.id === x.monster_id)?.motor);
    const character = group.characters.find((ch) => ch.id === x.character_id);
    return Math.max(1, moveRangeFor(character?.motor) - (character?.energia_atual === 0 ? 1 : 0));
  };

  const recoverBreath = async (combatant: Combatant) => {
    if (combatant.kind !== "character" || !combatant.character_id) return;
    const character = group.characters.find((item) => item.id === combatant.character_id);
    if (!character) return;
    try {
      await persistEnergy(
        character.id,
        character.energia_atual + 3 + energyValue(character.id, "vigor"),
      );
      toast.success(`${character.name} recuperou o fôlego.`);
      void logCombatEvent(combatant, `${character.name} recuperou o fôlego.`);
      if (state.active && state.current_combatant_id === combatant.id) advanceTurn();
    } catch (error) {
      toast.error(
        `Não foi possível recuperar energia: ${error instanceof Error ? error.message : "erro desconhecido"}`,
      );
    }
  };

  const consumeItemInCombat = async (
    combatant: Combatant,
    item: (typeof group.backpack)[number],
  ) => {
    if (combatant.kind !== "character" || !combatant.character_id || item.quantity <= 0) return;
    const character = group.characters.find((entry) => entry.id === combatant.character_id);
    if (!character) return;
    const nextQuantity = item.quantity - 1;
    const inventoryUpdate =
      nextQuantity > 0
        ? await supabase
            .from("backpack_items")
            .update({ quantity: nextQuantity })
            .eq("id", item.id)
            .eq("quantity", item.quantity)
            .select("id")
            .maybeSingle()
        : await supabase
            .from("backpack_items")
            .delete()
            .eq("id", item.id)
            .eq("quantity", item.quantity)
            .select("id")
            .maybeSingle();
    if (inventoryUpdate.error) {
      toast.error(`Não foi possível consumir o item: ${inventoryUpdate.error.message}`);
      return;
    }
    if (!inventoryUpdate.data) {
      toast.error("O item já foi usado ou alterado; atualize o inventário.");
      void qc.invalidateQueries({ queryKey: ["group"] });
      return;
    }
    const energyMax = maxEnergy(character.id);
    const nextEnergy = Math.min(energyMax, character.energia_atual + item.restore_energy);
    const nextSanity = Math.min(
      character.sanity_max,
      character.sanity_current + (item.heal_sanity ?? 0),
    );
    const { error: characterError } = await supabase
      .from("characters")
      .update({
        energia_atual: nextEnergy,
        energia_maxima: energyMax,
        sanity_current: nextSanity,
      })
      .eq("id", character.id);
    if (characterError) {
      const restoreInventory =
        nextQuantity > 0
          ? await supabase
              .from("backpack_items")
              .update({ quantity: item.quantity })
              .eq("id", item.id)
          : await supabase.from("backpack_items").insert({ ...item, quantity: item.quantity });
      if (restoreInventory.error) {
        console.error(
          "Falha ao restaurar item após erro na aplicação do efeito.",
          restoreInventory.error,
        );
      }
      toast.error(`O efeito do consumível falhou: ${characterError.message}`);
      return;
    }
    const shield = Math.max(0, item.temp_shield ?? 0);
    c.update.mutate([
      {
        id: combatant.id,
        patch: {
          hp_current: changeHp(combatant.hp_current ?? 0, item.heal_hp ?? 0, combatant.hp_max ?? 0),
          temporary_shield: combatant.temporary_shield + shield,
        },
      },
    ]);
    void qc.invalidateQueries({ queryKey: ["group"] });
    void qc.invalidateQueries({ queryKey: ["sheet", character.id] });
    toast.success(`${character.name} usou ${item.name}.`);
    void logCombatEvent(combatant, `${character.name} usou ${item.name}.`);
    if (state.active && state.current_combatant_id === combatant.id) advanceTurn();
  };

  const placeCatalogItem = async () => {
    const item = catalogItems.find((entry) => entry.id === selectedCatalogItemId);
    if (!item) return;
    const unavailable = occupied();
    for (const mapItem of mapItems) unavailable.add(cellKey(mapItem.x, mapItem.y));
    const cell = findFreeCell(map.cols, map.rows, terrain, unavailable, "left");
    if (!cell) {
      toast.error("Não há casas livres para colocar o item.");
      return;
    }
    const { error } = await supabase.from("battle_map_items").insert({
      catalog_item_id: item.id,
      name: item.name,
      icon: "📦",
      x: cell.x,
      y: cell.y,
      movable: item.is_movable,
      collectible: item.category !== "scenery",
      collection_difficulty: item.requires_roll_to_interact ? item.interaction_difficulty : null,
      collection_skill_key: item.requires_roll_to_interact ? item.interaction_skill_key : null,
    });
    if (error) {
      toast.error(`Não foi possível colocar o item: ${error.message}`);
      return;
    }
    void qc.invalidateQueries({ queryKey: ["battle_map_items"] });
    toast.success(`${item.name} colocado no mapa.`);
  };

  const pickupMapItem = async (itemId: string, tokenId: string) => {
    const item = mapItems.find((entry) => entry.id === itemId);
    const combatant = combat.combatants.find((entry) => entry.id === tokenId);
    if (!item || !combatant || combatant.kind !== "character" || !combatant.character_id) return;
    if (
      combatant.pos_x == null ||
      combatant.pos_y == null ||
      gridDistance(combatant.pos_x, combatant.pos_y, item.x, item.y) > 1
    ) {
      toast.error("É preciso estar adjacente ao item para pegá-lo.");
      return;
    }
    if (!mine(combatant)) {
      toast.error("Você não pode pegar itens com esse personagem.");
      return;
    }
    if (state.active && !isMaster && state.current_combatant_id !== combatant.id) {
      toast.error("Aguarde seu turno para pegar itens.");
      return;
    }
    let catalogItem = catalogItems.find((entry) => entry.id === item.catalog_item_id);
    if (item.catalog_item_id && !catalogItem) {
      const { data, error } = await supabase
        .from("catalog_items")
        .select("*")
        .eq("id", item.catalog_item_id)
        .maybeSingle();
      if (error) {
        toast.error(`Não foi possível carregar o item: ${error.message}`);
        return;
      }
      catalogItem = data ?? undefined;
    }
    if (item.collection_difficulty != null) {
      const skill = skillValueFor(
        group,
        combatant.character_id,
        item.collection_skill_key ?? "instinto",
      );
      const roll = roll2d6(skill, item.collection_difficulty);
      await logRolls([
        {
          characterId: combatant.character_id,
          characterName: combatant.name,
          label: `Coleta de ${item.name}`,
          result: roll,
        },
      ]);
      if (roll.outcome !== "success" && roll.outcome !== "critical-success") {
        toast("O teste de coleta falhou; o item continua no mapa.");
        return;
      }
    }
    const { data: removedItem, error: removeError } = await supabase
      .from("battle_map_items")
      .delete()
      .eq("id", item.id)
      .select("id")
      .maybeSingle();
    if (removeError || !removedItem) {
      toast.error(
        removeError
          ? `Não foi possível pegar o item: ${removeError.message}`
          : "O item já foi coletado.",
      );
      return;
    }
    const { error: insertError } = await supabase.from("backpack_items").insert({
      character_id: combatant.character_id,
      catalog_item_id: catalogItem?.id ?? item.catalog_item_id,
      name: catalogItem?.name ?? item.name,
      notes: catalogItem?.description ?? "",
      category: catalogItem?.category ?? "equipment",
      quantity: 1,
      skill_bonuses: catalogItem?.skill_bonuses ?? {},
      heal_hp: catalogItem?.heal_hp ?? 0,
      heal_sanity: catalogItem?.heal_sanity ?? 0,
      restore_energy: catalogItem?.restore_energy ?? 0,
      temp_shield: catalogItem?.temp_shield ?? 0,
    });
    if (insertError) {
      const { error: restoreError } = await supabase.from("battle_map_items").insert(item);
      if (restoreError)
        console.error("Não foi possível restaurar item no mapa após falha.", restoreError);
      toast.error(`Não foi possível guardar o item: ${insertError.message}`);
      void qc.invalidateQueries({ queryKey: ["battle_map_items"] });
      return;
    }
    void qc.invalidateQueries({ queryKey: ["group"] });
    void qc.invalidateQueries({ queryKey: ["battle_map_items"] });
    toast.success(`${item.name} guardado na mochila.`);
    void logCombatEvent(combatant, `${combatant.name} pegou ${item.name}.`);
  };

  const pushMapItem = async (itemId: string, tokenId: string) => {
    const item = mapItems.find((entry) => entry.id === itemId);
    const combatant = combat.combatants.find((entry) => entry.id === tokenId);
    if (!item || !item.movable || !combatant?.character_id) return;
    if (!mine(combatant) || combatant.pos_x == null || combatant.pos_y == null) return;
    if (state.active && !isMaster && state.current_combatant_id !== combatant.id) {
      toast.error("Aguarde seu turno para empurrar objetos.");
      return;
    }
    if (gridDistance(combatant.pos_x, combatant.pos_y, item.x, item.y) > 1) {
      toast.error("É preciso estar adjacente ao objeto para empurrá-lo.");
      return;
    }
    const dx = Math.sign(item.x - combatant.pos_x);
    const dy = Math.sign(item.y - combatant.pos_y);
    if (dx === 0 && dy === 0) {
      toast.error("Afaste-se do objeto antes de empurrá-lo.");
      return;
    }
    const x = item.x + dx;
    const y = item.y + dy;
    const occupiedCells = occupied();
    for (const other of mapItems)
      if (other.id !== item.id) occupiedCells.add(cellKey(other.x, other.y));
    if (!canMoveTo(x, y, map.cols, map.rows, terrain, occupiedCells)) {
      toast.error("Não há espaço livre para empurrar o objeto.");
      return;
    }
    const payment = await spendEnergy(combatant, 1);
    if (!payment.accepted) return;
    if (payment.hpCost > 0) {
      c.update.mutate([
        {
          id: combatant.id,
          patch: {
            hp_current: changeHp(combatant.hp_current ?? 0, -payment.hpCost, combatant.hp_max ?? 0),
          },
        },
      ]);
    }
    const { error } = await supabase.from("battle_map_items").update({ x, y }).eq("id", item.id);
    if (error) {
      toast.error(`Não foi possível empurrar o objeto: ${error.message}`);
      return;
    }
    void qc.invalidateQueries({ queryKey: ["battle_map_items"] });
    toast.success(`${item.name} foi empurrado.`);
    void logCombatEvent(combatant, `${combatant.name} empurrou ${item.name}.`);
  };

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
            items={mapItems}
            onPickItem={(itemId, tokenId) => void pickupMapItem(itemId, tokenId)}
            onPushItem={(itemId, tokenId) => void pushMapItem(itemId, tokenId)}
          />
        </div>

        <aside className="space-y-2">
          {isMaster && (
            <div className="flex gap-2 rounded border border-border bg-card p-2">
              <select
                className="h-9 min-w-0 flex-1 rounded-md border border-border bg-background px-2 text-sm"
                value={selectedCatalogItemId}
                onChange={(event) => setSelectedCatalogItemId(event.target.value)}
                aria-label="Item para colocar no mapa"
              >
                <option value="">Escolha um item do catálogo</option>
                {catalogItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              <Button
                size="sm"
                variant="outline"
                disabled={!selectedCatalogItemId}
                onClick={() => void placeCatalogItem()}
              >
                Colocar
              </Button>
            </div>
          )}
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
          <section className="space-y-2 rounded-lg border border-border bg-card p-3">
            <h2 className="label-caps text-primary">Registro de combate</h2>
            {combatEvents.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhuma ação especial registrada.</p>
            ) : (
              <ol className="max-h-48 space-y-2 overflow-y-auto">
                {combatEvents.map((event) => (
                  <li key={event.id} className="border-l-2 border-primary/40 pl-2 text-xs">
                    <p className="font-semibold">{event.character_name}</p>
                    <p className="text-muted-foreground">{event.description}</p>
                  </li>
                ))}
              </ol>
            )}
          </section>
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
                isCollapsed(x) &&
                  "border-2 border-destructive/80 bg-destructive/5 shadow-[0_0_26px_rgba(127,29,29,0.28)] animate-pulse",
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
                          cd === "Amedrontado"
                            ? `${cd}: −2 em rolagens de combate`
                            : cd === "Hesitante"
                              ? `${cd}: −2 no próximo ataque e sem reações`
                              : cd === "Hostilidade Quebrada"
                                ? `${cd}: não age hostilmente até sofrer dano`
                                : cd === "Atordoado" || cd === "Caído"
                                  ? `${cd}: −2 em ataque e defesa`
                                  : cd
                        }
                      >
                        {conditionEmoji(cd)}
                      </span>
                    ))}
                    {x.kind === "character" &&
                      group.characters.find((character) => character.id === x.character_id)
                        ?.energia_atual === 0 && (
                        <span title="Exausto: −2 em testes e −1 quadrado de movimento">⚡</span>
                      )}
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
                  <>
                    <AttackDialog
                      attackerName={x.name}
                      options={attackOptionsOf(x)}
                      targets={attackTargetsOf(x)}
                      canIgnoreRange={isMaster}
                      disabledReason={attackBlockedReason(x)}
                      attackDisabledReason={
                        isCollapsed(x)
                          ? "Colapso total: ataques bloqueados até a sanidade voltar."
                          : null
                      }
                      onAttack={(option, targetId) => resolveAttack(x, option, targetId)}
                      onDefend={() => defend(x)}
                    />
                    {x.kind === "character" && x.character_id && (
                      <>
                        <IntimidateDialog
                          attackerName={x.name}
                          targets={intimidationTargetsOf(x)}
                          disabled={!!attackBlockedReason(x) || isCollapsed(x)}
                          onIntimidate={(targetId) => resolveIntimidation(x, targetId)}
                        />
                        <ConvinceDialog
                          attackerName={x.name}
                          targets={intimidationTargetsOf(x)}
                          disabled={!!attackBlockedReason(x) || isCollapsed(x)}
                          onConvince={(targetId) => resolveConvince(x, targetId)}
                        />
                      </>
                    )}
                  </>
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
              {isCollapsed(x) && (
                <p className="mt-2 text-xs font-bold uppercase text-destructive">
                  Colapso de Sanidade — ataques bloqueados
                </p>
              )}
              {x.kind === "character" &&
                x.character_id &&
                (() => {
                  const character = group.characters.find((entry) => entry.id === x.character_id);
                  if (!character) return null;
                  const maximum = maxEnergy(character.id);
                  const current = Math.min(maximum, character.energia_atual);
                  const consumables = group.backpack.filter(
                    (item) =>
                      item.character_id === character.id &&
                      item.category === "consumable" &&
                      item.quantity > 0,
                  );
                  return (
                    <div className="mt-2 space-y-2 rounded border border-sky-400/30 bg-sky-950/10 p-2">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="w-16 text-xs font-bold uppercase text-sky-300">
                          Energia
                        </span>
                        <div className="h-2 flex-1 overflow-hidden rounded bg-muted">
                          <div
                            className="h-full bg-sky-400"
                            style={{ width: `${(current / maximum) * 100}%` }}
                          />
                        </div>
                        <span className="w-16 text-right font-bold text-sky-200">
                          {current}/{maximum}
                        </span>
                      </div>
                      {mine(x) && (
                        <div className="flex flex-wrap gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 border-sky-400/30 text-xs"
                            disabled={!!attackBlockedReason(x)}
                            onClick={() => void recoverBreath(x)}
                          >
                            Recuperar Fôlego (+{3 + energyValue(character.id, "vigor")})
                          </Button>
                          {consumables.map((item) => (
                            <Button
                              key={item.id}
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              disabled={!!attackBlockedReason(x)}
                              onClick={() => void consumeItemInCombat(x, item)}
                            >
                              Usar {item.name} ×{item.quantity}
                            </Button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}
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

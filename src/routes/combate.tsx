import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Crown,
  Dices,
  Film,
  Ghost,
  Grid,
  Lock,
  Minus,
  PackageOpen,
  Plus,
  RotateCcw,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { AttackDialog, type AttackTarget } from "@/components/rpg/AttackDialog";
import { rotateQueue } from "@/lib/progression";
import {
  mentalReduction,
  painReduction,
  parseChestItems,
  removeChestEntry,
  type ChestEntry,
} from "@/lib/passives";
import { ChestDialog } from "@/components/rpg/ChestDialog";
import { giveCatalogItem } from "@/lib/give-item";
import { Avatar } from "@/components/rpg/AvatarUpload";
import { BattleMap, type MapToken } from "@/components/rpg/BattleMap";
import { IntimidateDialog } from "@/components/rpg/IntimidateDialog";
import { ConvinceDialog } from "@/components/rpg/ConvinceDialog";
import { MasterUnlockModal } from "@/components/rpg/MasterUnlockModal";
import { QuickRollPanel } from "@/components/rpg/QuickRollPanel";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useMasterAuth } from "@/context/MasterAuthContext";
import { useCombat } from "@/hooks/use-combat";
import { supabase } from "@/integrations/supabase/client";
import {
  ATTACK_SKILLS,
  BODY_TARGETS,
  armorPartForTarget,
  armorReductionForTarget,
  bodyTargetDefenseModifier,
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
  type BodyTarget,
  type Fog,
  type Terrain,
  tokenVisible,
} from "@/lib/combat";
import { EFFECT_TO_CONDITION_NAME, isCustomAttack } from "@/lib/custom-attacks";
import {
  appSettingsQuery,
  calculateDifficultyBonus,
  parseDifficultyModifiers,
} from "@/lib/difficulty";
import { getPlayerCharacterId } from "@/lib/player-character";
import { postCombatStartToDiscord } from "@/lib/discord-webhook";
import { logRolls } from "@/lib/roll-log";
import {
  defaultMonsterBodyParts,
  monsterBodyTargetOptions,
  monsterBodyType,
} from "@/lib/monster-body";
import { maxEnergyFor } from "@/lib/survival";
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
  const mapItemsWithIcons = useMemo(
    () =>
      mapItems.map((item) => {
        const catalogItem = catalogItems.find((candidate) => candidate.id === item.catalog_item_id);
        return item.image_url || !catalogItem?.image_url
          ? item
          : { ...item, image_url: catalogItem.image_url };
      }),
    [mapItems, catalogItems],
  );
  const { data: appSettings } = useQuery(appSettingsQuery);
  const { isMaster } = useMasterAuth();
  const c = useCombat();
  const qc = useQueryClient();
  const [hpDelta, setHpDelta] = useState(1);
  const [quickRollOpen, setQuickRollOpen] = useState(false);
  const [selectedCatalogItemId, setSelectedCatalogItemId] = useState("");
  const [chestView, setChestView] = useState<{ itemId: string; tokenId: string | null } | null>(
    null,
  );
  const [placing, setPlacing] = useState<{
    kind: "character" | "monster" | "item" | "chest";
    id: string;
    label: string;
  } | null>(null);
  const [reaction, setReaction] = useState<{ defenderId: string; attackerId: string } | null>(
    null,
  );
  const [turnEffect, setTurnEffect] = useState<{
    combatantId: string;
    name: string;
    conditions: string[];
    damageRolls: number[];
  } | null>(null);

  // Módulo 3 & 4: Teatro da Mente, Condições Post-it, Presença Perturbadora
  const [viewMode, setViewMode] = useState<"grid" | "theater">("grid");
  const [customConditionModal, setCustomConditionModal] = useState<{ combatantId: string; name: string } | null>(null);
  const [newConditionText, setNewConditionText] = useState("");
  const [disturbingPresenceOpen, setDisturbingPresenceOpen] = useState(false);
  const [disturbingPresenceDc, setDisturbingPresenceDc] = useState(12);
  const [presencePrompt, setPresencePrompt] = useState<{ promptId: string; dc: number } | null>(
    null,
  );
  const [presenceSkill, setPresenceSkill] = useState<"vigor" | "compostura">("vigor");
  const presenceChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const activePresencePromptId = useRef<string | null>(null);
  const processedPresenceResults = useRef(new Set<string>());
  const seenPresencePrompts = useRef(new Set<string>());

  const order = sortByInitiative(combat.combatants);
  const slots = order.map((x) => ({ id: x.id, out: x.kind === "monster" && x.hp_current <= 0 }));
  const { state } = combat;
  const terrain = (map.terrain ?? {}) as Terrain;
  const fog = (map.fog ?? {}) as Fog;
  const myId = getPlayerCharacterId();
  const presenceContext = useRef({
    isMaster,
    myId,
    combatants: combat.combatants,
    characters: group.characters,
  });
  presenceContext.current = {
    isMaster,
    myId,
    combatants: combat.combatants,
    characters: group.characters,
  };

  useEffect(() => {
    const channel = supabase
      .channel("combat-presence")
      .on("broadcast", { event: "PRESENCE_PROMPT" }, ({ payload }) => {
        const event = payload as { promptId?: unknown; dc?: unknown };
        if (
          typeof event.promptId !== "string" ||
          typeof event.dc !== "number" ||
          !Number.isFinite(event.dc)
        )
          return;
        const { isMaster: master, myId: characterId, combatants } = presenceContext.current;
        if (
          master ||
          !characterId ||
          !combatants.some((combatant) => combatant.character_id === characterId) ||
          seenPresencePrompts.current.has(event.promptId)
        )
          return;
        seenPresencePrompts.current.add(event.promptId);
        setPresenceSkill("vigor");
        setPresencePrompt({ promptId: event.promptId, dc: event.dc });
      })
      .on("broadcast", { event: "PRESENCE_RESULT" }, async ({ payload }) => {
        const event = payload as {
          promptId?: unknown;
          characterId?: unknown;
          skill?: unknown;
          total?: unknown;
          dc?: unknown;
          success?: unknown;
        };
        if (
          typeof event.promptId !== "string" ||
          typeof event.characterId !== "string" ||
          (event.skill !== "vigor" && event.skill !== "compostura") ||
          typeof event.total !== "number" ||
          typeof event.dc !== "number" ||
          typeof event.success !== "boolean" ||
          !presenceContext.current.isMaster ||
          event.promptId !== activePresencePromptId.current
        )
          return;
        const resultKey = `${event.promptId}:${event.characterId}`;
        if (processedPresenceResults.current.has(resultKey)) return;
        const { combatants, characters } = presenceContext.current;
        const combatant = combatants.find((item) => item.character_id === event.characterId);
        const character = characters.find((item) => item.id === event.characterId);
        if (!combatant || !character) return;
        processedPresenceResults.current.add(resultKey);

        try {
          const description = event.success
            ? `${character.name} resistiu à Presença Perturbadora (${event.skill}, ${event.total} vs CD ${event.dc}).`
            : `${character.name} falhou na Presença Perturbadora (${event.skill}, ${event.total} vs CD ${event.dc}) e ficou Abalado (-1 atk 1ª rodada).`;
          if (!event.success) {
            const conditions = Array.isArray(combatant.custom_conditions)
              ? combatant.custom_conditions.filter(
                  (condition): condition is string => typeof condition === "string",
                )
              : [];
            const shaken = "Abalado (-1 atk 1ª rodada)";
            if (!conditions.includes(shaken)) {
              const { error } = await supabase
                .from("combatants")
                .update({ custom_conditions: [...conditions, shaken] })
                .eq("id", combatant.id);
              if (error) throw error;
            }
          }
          const { error } = await supabase.from("combat_events").insert({
            character_id: character.id,
            character_name: character.name,
            description,
          });
          if (error) throw error;
          await Promise.all([
            qc.invalidateQueries({ queryKey: ["combat"] }),
            qc.invalidateQueries({ queryKey: ["combat_events"] }),
          ]);
          toast[event.success ? "success" : "warning"](description);
        } catch (error) {
          processedPresenceResults.current.delete(resultKey);
          toast.error(
            `Não foi possível registrar o teste: ${error instanceof Error ? error.message : "erro desconhecido"}`,
          );
        }
      })
      .subscribe((status, error) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.error("O canal de Presença Perturbadora falhou.", error);
          toast.error("Não foi possível conectar ao canal de Presença Perturbadora.");
        }
      });
    presenceChannelRef.current = channel;
    return () => {
      presenceChannelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [qc]);

  const energyValue = (characterId: string, key: "vigor" | "vontade") => {
    const character = group.characters.find((item) => item.id === characterId);
    if (!character) return 0;
    return skillValueFor(group, characterId, key) + (character.energia_atual <= 0 ? 2 : 0);
  };
  const maxEnergy = (
    characterId: string,
    survivalOverrides?: { hunger_state?: string | null; thirst_state?: string | null },
  ) => {
    const character = group.characters.find((item) => item.id === characterId);
    if (!character) return 1;
    const vigorBonus =
      group.skills.find((skill) => skill.character_id === characterId && skill.skill_key === "vigor")
        ?.bonus ?? 0;
    const willBonus =
      group.skills.find((skill) => skill.character_id === characterId && skill.skill_key === "vontade")
        ?.bonus ?? 0;
    return maxEnergyFor({ ...character, ...survivalOverrides }, vigorBonus, willBonus);
  };
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

  const addCharacter = (id: string, cell: { x: number; y: number }) => {
    const ch = group.characters.find((x) => x.id === id);
    if (!ch) return;
    const s = playerCombatStats(ch.fisico, ch.motor);
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
        pos_x: cell.x,
        pos_y: cell.y,
      },
    ]);
  };

  const addMonster = (id: string, cell: { x: number; y: number }) => {
    const m = monsters.find((x) => x.id === id);
    if (!m) return;
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
        pos_x: cell.x,
        pos_y: cell.y,
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
      .map((t) => {
        const monster = monsters.find((entry) => entry.id === t.monster_id);
        const bodyParts =
          monster?.body_parts ??
          defaultMonsterBodyParts(monsterBodyType(monster?.body_type ?? "human"));
        return {
          id: t.id,
          name: t.name,
          avatar: avatarOf(t),
          tone: t.kind === "monster" ? "monster" : "player",
          distance: distanceBetween(x, t),
          ...(t.kind === "monster" ? { bodyTargets: monsterBodyTargetOptions(bodyParts) } : {}),
        };
      });

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

  // Condições em post-it
  const addCustomCondition = async (combatantId: string, text: string) => {
    if (!text.trim()) return;
    const target = combat.combatants.find((item) => item.id === combatantId);
    if (!target) return;
    const current = Array.isArray(target.custom_conditions)
      ? target.custom_conditions.filter((condition): condition is string => typeof condition === "string")
      : [];
    const next = [...current, text.trim()];
    try {
      const { error } = await supabase
        .from("combatants")
        .update({ custom_conditions: next })
        .eq("id", combatantId);
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["combat"] });
      toast.success(`Condição "${text.trim()}" adicionada a ${target.name}!`);
      setCustomConditionModal(null);
      setNewConditionText("");
    } catch (error) {
      toast.error(
        `Não foi possível adicionar a condição: ${error instanceof Error ? error.message : "erro desconhecido"}`,
      );
    }
  };

  const removeCustomCondition = async (combatantId: string, index: number) => {
    const target = combat.combatants.find((item) => item.id === combatantId);
    if (!target) return;
    const current = Array.isArray(target.custom_conditions)
      ? target.custom_conditions.filter((condition): condition is string => typeof condition === "string")
      : [];
    const next = current.filter((_, i) => i !== index);
    try {
      const { error } = await supabase
        .from("combatants")
        .update({ custom_conditions: next })
        .eq("id", combatantId);
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["combat"] });
      toast.success(`Condição removida de ${target.name}.`);
    } catch (error) {
      toast.error(
        `Não foi possível remover a condição: ${error instanceof Error ? error.message : "erro desconhecido"}`,
      );
    }
  };

  // Rastreador de ações por turno
  const turnActions = (state.active_turn_actions ?? {}) as Record<string, { action?: boolean; move?: boolean }>;

  const toggleTurnAction = async (combatantId: string, type: "action" | "move") => {
    const nextState = { ...turnActions };
    const current = nextState[combatantId] ?? {};
    nextState[combatantId] = {
      ...current,
      [type]: !current[type],
    };
    try {
      const { error } = await supabase
        .from("combat_state")
        .update({ active_turn_actions: nextState })
        .eq("id", 1);
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["combat"] });
    } catch (error) {
      toast.error(
        `Não foi possível atualizar as ações do turno: ${error instanceof Error ? error.message : "erro desconhecido"}`,
      );
    }
  };

  const resetTurnActions = async () => {
    try {
      const { error } = await supabase
        .from("combat_state")
        .update({ active_turn_actions: {} })
        .eq("id", 1);
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["combat"] });
      toast.success("Ações da rodada resetadas!");
    } catch (error) {
      toast.error(
        `Não foi possível resetar a rodada: ${error instanceof Error ? error.message : "erro desconhecido"}`,
      );
    }
  };

  // Presença Perturbadora (Opcional do Mestre)
  const fireDisturbingPresence = async (dc: number) => {
    try {
      const channel = presenceChannelRef.current;
      if (!channel) throw new Error("Canal de Presença Perturbadora indisponível.");
      const promptId = crypto.randomUUID();
      activePresencePromptId.current = promptId;
      processedPresenceResults.current.clear();
      const response = await channel.send({
        type: "broadcast",
        event: "PRESENCE_PROMPT",
        payload: { promptId, dc },
      });
      if (response !== "ok") {
        activePresencePromptId.current = null;
        throw new Error(`O canal realtime respondeu: ${response}.`);
      }
      toast.success(`Teste de Presença Perturbadora enviado aos jogadores (CD ${dc}).`);
      setDisturbingPresenceOpen(false);
    } catch (error) {
      toast.error(
        `Não foi possível enviar Presença Perturbadora: ${error instanceof Error ? error.message : "erro desconhecido"}`,
      );
    }
  };

  const respondToPresencePrompt = async () => {
    if (!presencePrompt || !myId) return;
    const character = group.characters.find((item) => item.id === myId);
    const channel = presenceChannelRef.current;
    if (!character || !channel) {
      toast.error("Não foi possível iniciar o teste de Presença Perturbadora.");
      return;
    }

    const roll = roll2d6(skillValueFor(group, character.id, presenceSkill), presencePrompt.dc);
    const success = roll.outcome === "success" || roll.outcome === "critical-success";
    try {
      const response = await channel.send({
        type: "broadcast",
        event: "PRESENCE_RESULT",
        payload: {
          promptId: presencePrompt.promptId,
          characterId: character.id,
          skill: presenceSkill,
          total: roll.total,
          dc: presencePrompt.dc,
          success,
        },
      });
      if (response !== "ok") throw new Error(`O canal realtime respondeu: ${response}.`);
      void logRolls([
        {
          characterId: character.id,
          characterName: character.name,
          label: `Presença Perturbadora: ${presenceSkill === "vigor" ? "Vigor" : "Compostura"} (CD ${presencePrompt.dc})`,
          result: roll,
        },
      ]);
      toast[success ? "success" : "warning"](
        `Presença Perturbadora: ${roll.total} vs CD ${presencePrompt.dc}.`,
      );
      setPresencePrompt(null);
    } catch (error) {
      toast.error(
        `Não foi possível enviar o resultado: ${error instanceof Error ? error.message : "erro desconhecido"}`,
      );
    }
  };

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
    bodyTarget: BodyTarget = "general",
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
          bodyTarget,
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
      option.attributeKey ?? (option.kind === "basic" ? "fisico" : null),
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
          resistanceValue +
          target.temporary_shield +
          defendBonus -
          targetPenalty +
          masterBonus +
          bodyTargetDefenseModifier(bodyTarget),
        );
    if (attackerPenalty || targetPenalty) {
      toast(`Penalidades aplicadas: ataque −${attackerPenalty}, defesa do alvo −${targetPenalty}.`);
    }

    const r = rollHit(option.hitDice, option.hitBonus - attackerPenalty, defense);
    const crit = r.outcome === "critical-success";
    const hit = r.outcome === "success" || crit;
    const armorPart = armorPartForTarget(bodyTarget);
    const monsterArmor = target.monster_id
      ? monsters.find((monster) => monster.id === target.monster_id)
      : undefined;
    const armorReduction =
      option.damageType === "Mental"
        ? 0
        : target.character_id
          ? armorReductionForTarget(
            group.backpack.filter((item) => item.character_id === target.character_id),
            bodyTarget,
          )
          : armorPart && monsterArmor
            ? Math.max(
              0,
              monsterArmor[
              `armor_${armorPart}` as "armor_head" | "armor_torso" | "armor_arms" | "armor_legs"
              ],
            )
            : 0;
    const rolledDamage = hit
      ? rollDamage(option.damage) + (crit ? 3 + (bodyTarget === "head" ? 3 : 0) : 0)
      : 0;
    const mentalHit = option.damageType === "Mental" || option.damageType === "Social/Moral";
    const passiveReduction =
      hit && target.character_id
        ? mentalHit
          ? mentalReduction(
            skillValueFor(group, target.character_id, "vontade"),
            skillValueFor(group, target.character_id, "compostura"),
          )
          : option.damageType === "Mágico"
            ? 0
            : painReduction(skillValueFor(group, target.character_id, "limiar_dor"))
        : 0;
    const passiveText =
      passiveReduction > 0
        ? ` (−${passiveReduction} absorvido por ${mentalHit ? "defesa mental" : "Limiar da Dor"})`
        : "";
    const damage = hit
      ? Math.max(0, rolledDamage - armorReduction - passiveReduction)
      : 0;

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
        label: `${option.name} em ${target.name}${!hit
            ? " — errou"
            : dodged
              ? " — esquivado"
              : ` — ${damage} de dano${passiveText}${effectsText}`
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
      if (target.kind === "character" && consumeAction && !areaSubattack)
        setReaction({ defenderId: target.id, attackerId: attacker.id });
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
          hp_current: changeHp(
            target.hp_current,
            -(damage - shieldAbsorbed),
            target.hp_max,
          ),
          temporary_shield: Math.max(0, target.temporary_shield - shieldAbsorbed),
          conditions: nextConditions.filter((condition) => condition !== "Hostilidade Quebrada"),
          condition_durations: durationMap,
          ...(defenseDebuffed > 0 ? { defense: nextDefense } : {}),
        },
      },
    ]);

    const struckHand =
      bodyTarget === "right_arm" ? "right" : bodyTarget === "left_arm" ? "left" : null;
    const disarmedWeapon =
      hit &&
        !dodged &&
        (damage - shieldAbsorbed >= 5 ||
          conditionAdded === "Atordoado" ||
          conditionAdded === "Caído") &&
        struckHand &&
        target.character_id &&
        target.pos_x != null &&
        target.pos_y != null
        ? group.weapons.find(
          (weapon) =>
            weapon.character_id === target.character_id &&
            !isCustomAttack(weapon) &&
            (weapon.hand_slot === struckHand || weapon.hand_slot === "two_hands"),
        )
        : undefined;
    if (disarmedWeapon) {
      const { data: droppedItem, error: dropError } = await supabase
        .from("battle_map_items")
        .insert({
          weapon_id: disarmedWeapon.id,
          name: disarmedWeapon.name,
          icon: "⚔️",
          image_url: disarmedWeapon.image_url,
          hand_slot: disarmedWeapon.hand_slot,
          x: target.pos_x!,
          y: target.pos_y!,
          movable: false,
          collectible: true,
        })
        .select("id")
        .single();
      if (dropError) {
        toast.error(`Não foi possível derrubar ${disarmedWeapon.name}: ${dropError.message}`);
      } else {
        const { data: heldWeapon, error: handError } = await supabase
          .from("weapons")
          .update({ hand_slot: "ground" })
          .eq("id", disarmedWeapon.id)
          .neq("hand_slot", "ground")
          .select("id")
          .maybeSingle();
        if (handError || !heldWeapon) {
          const { error: rollbackError } = await supabase
            .from("battle_map_items")
            .delete()
            .eq("id", droppedItem.id);
          if (rollbackError) {
            console.error(
              "Não foi possível remover arma do mapa após falha ao desarmar.",
              rollbackError,
            );
            toast.error(`Arma duplicada no mapa: ${rollbackError.message}`);
          }
          toast.error(
            handError
              ? `Não foi possível desarmar ${target.name}: ${handError.message}`
              : `${disarmedWeapon.name} já não estava na mão do alvo.`,
          );
        } else {
          void qc.invalidateQueries({ queryKey: ["group"] });
          void qc.invalidateQueries({ queryKey: ["sheet", disarmedWeapon.character_id] });
          void qc.invalidateQueries({ queryKey: ["battle_map_items"] });
          toast(`${target.name} derrubou ${disarmedWeapon.name} no próprio quadrado.`);
        }
      }
    }

    toast.success(
      `${attacker.name} acertou ${target.name} em ${BODY_TARGETS.find((part) => part.key === bodyTarget)?.label ?? "Geral"}: −${damage - shieldAbsorbed} PV${armorReduction ? ` (${armorReduction} RD)` : ""}${shieldAbsorbed ? ` (${shieldAbsorbed} absorvido pelo escudo)` : ""}${effectsText}.`,
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
    const hunger_state =
      item.survival_tag === "Ração" ? "satisfeito" : character.hunger_state;
    const thirst_state =
      item.survival_tag === "Hidratação" ? "satisfeito" : character.thirst_state;
    const energyMax = maxEnergy(character.id, { hunger_state, thirst_state });
    const nextEnergy = Math.min(energyMax, character.energia_atual + item.restore_energy);
    const { error: characterError } = await supabase
      .from("characters")
      .update({
        energia_atual: nextEnergy,
        energia_maxima: energyMax,
        hunger_state,
        thirst_state,
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
    const survivalEffect =
      item.survival_tag === "Ração"
        ? " Fome saciada."
        : item.survival_tag === "Hidratação"
          ? " Sede saciada."
          : "";
    void logCombatEvent(combatant, `${character.name} usou ${item.name}.${survivalEffect}`);
    if (state.active && state.current_combatant_id === combatant.id) advanceTurn();
  };

  const placeCatalogItem = async (itemId: string, cell: { x: number; y: number }) => {
    const item = catalogItems.find((entry) => entry.id === itemId);
    if (!item) return;
    const { error } = await supabase.from("battle_map_items").insert({
      catalog_item_id: item.id,
      name: item.name,
      icon: item.category === "weapon" ? "⚔️" : "🔹",
      image_url: item.image_url,
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
    if (item.is_chest) {
      setChestView({ itemId: item.id, tokenId: combatant.id });
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
    if (item.weapon_id) {
      const previousOwnerId = group.weapons.find(
        (weapon) => weapon.id === item.weapon_id,
      )?.character_id;
      const { data: reclaimedWeapon, error: weaponError } = await supabase
        .from("weapons")
        .update({
          character_id: combatant.character_id,
          hand_slot: item.hand_slot === "none" ? "right" : item.hand_slot,
        })
        .eq("id", item.weapon_id)
        .eq("hand_slot", "ground")
        .select("id")
        .maybeSingle();
      if (weaponError || !reclaimedWeapon) {
        const { error: restoreError } = await supabase.from("battle_map_items").insert(item);
        if (restoreError)
          console.error("Não foi possível restaurar arma no mapa após falha.", restoreError);
        toast.error(
          weaponError
            ? `Não foi possível pegar a arma: ${weaponError.message}`
            : "Essa arma já não está mais disponível no chão.",
        );
        void qc.invalidateQueries({ queryKey: ["battle_map_items"] });
        return;
      }
      void qc.invalidateQueries({ queryKey: ["group"] });
      void qc.invalidateQueries({ queryKey: ["sheet", combatant.character_id] });
      if (previousOwnerId) void qc.invalidateQueries({ queryKey: ["sheet", previousOwnerId] });
      void qc.invalidateQueries({ queryKey: ["battle_map_items"] });
      toast.success(`${item.name} voltou para a mão principal de ${combatant.name}.`);
      void logCombatEvent(combatant, `${combatant.name} pegou ${item.name} do chão.`);
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
      restore_energy: catalogItem?.restore_energy ?? 0,
      temp_shield: catalogItem?.temp_shield ?? 0,
      survival_tag: catalogItem?.survival_tag ?? "",
      image_url: catalogItem?.image_url ?? item.image_url,
      armor_part: catalogItem?.armor_part ?? "",
      armor_reduction: catalogItem?.armor_reduction ?? 0,
      hand_slot: catalogItem?.hand_slot ?? "none",
      equipped: false,
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

  // ---------- Baús ----------
  const placeChest = async (cell: { x: number; y: number }) => {
    const { data, error } = await supabase
      .from("battle_map_items")
      .insert({
        name: "Baú",
        icon: "🧰",
        x: cell.x,
        y: cell.y,
        is_chest: true,
        collectible: true,
        movable: false,
        chest_items: [],
      })
      .select("id")
      .single();
    if (error) {
      toast.error(`Não foi possível colocar o baú: ${error.message}`);
      return;
    }
    void qc.invalidateQueries({ queryKey: ["battle_map_items"] });
    setChestView({ itemId: data.id, tokenId: null });
  };

  const openChest = (itemId: string, tokenId: string | null) => {
    const item = mapItems.find((entry) => entry.id === itemId);
    if (!item) return;
    if (isMaster) {
      setChestView({ itemId, tokenId });
      return;
    }
    const combatant = combat.combatants.find((entry) => entry.id === tokenId);
    if (!combatant || combatant.kind !== "character" || !mine(combatant)) {
      toast.error("Selecione o seu personagem no mapa para abrir o baú.");
      return;
    }
    if (
      combatant.pos_x == null ||
      combatant.pos_y == null ||
      gridDistance(combatant.pos_x, combatant.pos_y, item.x, item.y) > 1
    ) {
      toast.error("Chegue ao lado do baú para abri-lo.");
      return;
    }
    setChestView({ itemId, tokenId });
  };

  const saveChestItems = async (chestId: string, next: ChestEntry[]) => {
    const { error } = await supabase
      .from("battle_map_items")
      .update({ chest_items: next })
      .eq("id", chestId);
    if (error) throw error;
    void qc.invalidateQueries({ queryKey: ["battle_map_items"] });
  };

  const addToChest = async (chestId: string, catalogItemId: string) => {
    const chest = mapItems.find((entry) => entry.id === chestId);
    const catalogItem = catalogItems.find((entry) => entry.id === catalogItemId);
    if (!chest || !catalogItem) return;
    const entry: ChestEntry = {
      uid: crypto.randomUUID(),
      catalog_item_id: catalogItem.id,
      name: catalogItem.name,
    };
    try {
      await saveChestItems(chestId, [...parseChestItems(chest.chest_items), entry]);
    } catch (error) {
      toast.error(`Não foi possível guardar o item: ${(error as Error).message}`);
    }
  };

  const takeFromChest = async (chestId: string, entry: ChestEntry, characterId: string) => {
    const tokenId = chestView?.tokenId ?? null;
    const combatant = combat.combatants.find((x) => x.id === tokenId);
    if (
      !isMaster &&
      state.active &&
      (!combatant || state.current_combatant_id !== combatant.id)
    ) {
      toast.error("Aguarde seu turno para pegar itens do baú.");
      return;
    }
    // Lê o baú direto do banco para não entregar o mesmo item duas vezes.
    const { data: fresh, error: readError } = await supabase
      .from("battle_map_items")
      .select("chest_items")
      .eq("id", chestId)
      .maybeSingle();
    if (readError || !fresh) {
      toast.error("Esse baú não existe mais.");
      return;
    }
    const current = parseChestItems(fresh.chest_items);
    if (!current.some((x) => x.uid === entry.uid)) {
      toast("Alguém já pegou esse item.");
      void qc.invalidateQueries({ queryKey: ["battle_map_items"] });
      return;
    }
    let catalogItem = catalogItems.find((x) => x.id === entry.catalog_item_id);
    if (!catalogItem) {
      const { data } = await supabase
        .from("catalog_items")
        .select("*")
        .eq("id", entry.catalog_item_id)
        .maybeSingle();
      catalogItem = data ?? undefined;
    }
    if (!catalogItem) {
      toast.error("Esse item foi apagado do catálogo.");
      return;
    }
    try {
      await saveChestItems(chestId, removeChestEntry(current, entry.uid));
      const where = await giveCatalogItem(catalogItem, characterId);
      const who = group.characters.find((x) => x.id === characterId)?.name ?? "Personagem";
      void qc.invalidateQueries({ queryKey: ["group"] });
      void qc.invalidateQueries({ queryKey: ["sheet", characterId] });
      toast.success(`${entry.name} foi para ${where === "weapon" ? "as armas" : "a mochila"} de ${who}.`);
      if (combatant) void logCombatEvent(combatant, `${who} pegou ${entry.name} do baú.`);
    } catch (error) {
      toast.error(`Não foi possível pegar o item: ${(error as Error).message}`);
    }
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
    if (x !== null && y !== null) {
      const occupiedCells = occupied();
      if (who?.pos_x != null && who.pos_y != null)
        occupiedCells.delete(cellKey(who.pos_x, who.pos_y));
      for (const mapItem of mapItems) occupiedCells.add(cellKey(mapItem.x, mapItem.y));
      if (!canMoveTo(x, y, map.cols, map.rows, terrain, occupiedCells)) {
        toast.error("Essa casa está fora do mapa, bloqueada ou ocupada.");
        return;
      }
    }
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
  const customConditionsOf = (x: Combatant) =>
    Array.isArray(x.custom_conditions)
      ? x.custom_conditions.filter((condition): condition is string => typeof condition === "string")
      : [];
  const renderCustomConditions = (x: Combatant) => {
    const conditions = customConditionsOf(x);
    return (
      <div className="mt-1 flex flex-wrap items-center justify-center gap-1">
        {conditions.map((condition, index) => (
          <span
            key={`${condition}-${index}`}
            className="inline-flex items-center gap-1 rounded-full border border-amber-400/50 bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-200"
          >
            {condition}
            {mine(x) && (
              <button
                type="button"
                aria-label={`Remover condição ${condition} de ${x.name}`}
                className="font-bold text-amber-100 hover:text-white"
                onClick={() => void removeCustomCondition(x.id, index)}
              >
                ×
              </button>
            )}
          </span>
        ))}
        {mine(x) && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-6 gap-1 px-2 text-[10px] text-muted-foreground"
            onClick={() => {
              setNewConditionText("");
              setCustomConditionModal({ combatantId: x.id, name: x.name });
            }}
          >
            <Tag className="size-3" /> Adicionar Condição
          </Button>
        )}
      </div>
    );
  };
  const renderTurnActionBadges = (x: Combatant) => (
    <div className="mt-2 flex justify-center gap-1">
      {(
        [
          ["action", "Ação", "border-emerald-500/60 bg-emerald-500/20 text-emerald-200"],
          ["move", "Movimento", "border-sky-500/60 bg-sky-500/20 text-sky-200"],
        ] as const
      ).map(([type, label, activeClass]) => {
        const active = turnActions[x.id]?.[type];
        return (
          <button
            key={type}
            type="button"
            disabled={!mine(x)}
            onClick={() => void toggleTurnAction(x.id, type)}
            className={cn(
              "rounded border px-2 py-0.5 text-[10px] font-bold uppercase disabled:cursor-default",
              active
                ? activeClass
                : "border-border bg-white/5 text-muted-foreground disabled:opacity-70",
            )}
          >
            [{label}] {active ? "✓" : "○"}
          </button>
        );
      })}
    </div>
  );

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
                onChange={(e) => {
                  const ch = group.characters.find((x) => x.id === e.target.value);
                  if (ch) setPlacing({ kind: "character", id: ch.id, label: ch.name });
                }}
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
                onChange={(e) => {
                  const m = monsters.find((x) => x.id === e.target.value);
                  if (m) setPlacing({ kind: "monster", id: m.id, label: m.name });
                }}
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
                variant={viewMode === "theater" ? "secondary" : "outline"}
                onClick={() => setViewMode((m) => (m === "theater" ? "grid" : "theater"))}
                className="gap-1 text-xs"
              >
                {viewMode === "theater" ? (
                  <>
                    <Grid className="size-3.5" /> Grade
                  </>
                ) : (
                  <>
                    <Film className="size-3.5 text-amber-400" /> Teatro da Mente
                  </>
                )}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1 text-xs"
                onClick={resetTurnActions}
                title="Resetar toggles de Ação e Movimento para a próxima rodada"
              >
                <RotateCcw className="size-3.5" /> Resetar Rodada
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1 text-xs border-amber-500/50 text-amber-300 hover:bg-amber-500/10"
                onClick={() => setDisturbingPresenceOpen(true)}
              >
                <Ghost className="size-3.5" /> Disparar Presença Perturbadora
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
          {viewMode === "theater" ? (
            <div className="relative min-h-[560px] overflow-hidden rounded-lg bg-zinc-950 p-6 flex flex-col justify-between">
              {map.background_url ? (
                <div
                  className="absolute inset-0 bg-cover bg-center opacity-40 filter blur-xs pointer-events-none"
                  style={{ backgroundImage: `url(${map.background_url})` }}
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-b from-zinc-900 via-zinc-950 to-black opacity-90 pointer-events-none" />
              )}
              <div className="relative z-10 flex items-center justify-between border-b border-white/10 pb-3">
                <div>
                  <span className="font-display text-xs font-bold uppercase tracking-widest text-amber-400">
                    🎭 Teatro da Mente
                  </span>
                  <h2 className="font-display text-2xl font-bold uppercase text-white drop-shadow">
                    Cena de Combate — Rodada {state.round}
                  </h2>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1 text-xs border-white/20 text-white hover:bg-white/10"
                  onClick={() => setViewMode("grid")}
                >
                  <Grid className="size-3.5" /> Grade Tática
                </Button>
              </div>

              {/* Combatentes na Cena */}
              <div className="relative z-10 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 my-6">
                {order.map((x) => (
                  <div
                    key={x.id}
                    className={cn(
                      "flex flex-col items-center rounded-xl border p-3 text-center backdrop-blur-md transition-all",
                      x.id === state.current_combatant_id
                        ? "border-primary bg-primary/20 ring-2 ring-primary shadow-[0_0_20px_rgba(234,179,8,0.3)] scale-105"
                        : "border-white/10 bg-black/60",
                      x.hp_current <= 0 && "opacity-40 grayscale",
                    )}
                  >
                    <Avatar
                      src={avatarOf(x)}
                      name={x.name}
                      tone={x.kind === "monster" ? "monster" : "player"}
                      className="size-14 text-sm mb-2 shadow-lg"
                    />
                    <span className="font-display text-sm font-bold uppercase truncate max-w-full text-white">
                      {x.name}
                    </span>
                    <span className="text-[11px] font-semibold text-emerald-400">
                      HP {x.hp_current}/{x.hp_max}
                    </span>
                    {x.kind === "character" &&
                      x.character_id &&
                      (() => {
                        const character = group.characters.find(
                          (entry) => entry.id === x.character_id,
                        );
                        if (!character) return null;
                        const maximum = maxEnergy(character.id);
                        return (
                          <span className="text-[11px] font-semibold text-sky-300">
                            Energia {Math.min(maximum, character.energia_atual)}/{maximum}
                          </span>
                        );
                      })()}
                    {renderCustomConditions(x)}
                    {renderTurnActionBadges(x)}
                  </div>
                ))}
              </div>

              <div className="relative z-10 border-t border-white/10 pt-3 text-xs text-white/60">
                Visualização narrativa focada na imaginação e descrição. Realize ataques e ações no painel lateral.
              </div>
            </div>
          ) : (
            <BattleMap
              map={map}
              tokens={tokens}
              combatActive={state.active}
              currentCombatantId={state.current_combatant_id}
              onMove={moveCombatant}
              items={mapItemsWithIcons}
              onPickItem={(itemId, tokenId) => void pickupMapItem(itemId, tokenId)}
              onPushItem={(itemId, tokenId) => void pushMapItem(itemId, tokenId)}
              onOpenChest={openChest}
              placement={
                isMaster && placing
                  ? {
                    label: placing.label,
                    onCancel: () => setPlacing(null),
                    onPlace: (x, y) => {
                      const cell = { x, y };
                      if (placing.kind === "character") addCharacter(placing.id, cell);
                      else if (placing.kind === "monster") addMonster(placing.id, cell);
                      else if (placing.kind === "chest") void placeChest(cell);
                      else void placeCatalogItem(placing.id, cell);
                      setPlacing(null);
                    },
                  }
                  : null
              }
            />
          )}
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
                onClick={() => {
                  const item = catalogItems.find((entry) => entry.id === selectedCatalogItemId);
                  if (item) setPlacing({ kind: "item", id: item.id, label: item.name });
                }}
              >
                Adicionar item
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPlacing({ kind: "chest", id: "", label: "o baú" })}
              >
                <PackageOpen /> Baú
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
          {(state.active ? rotateQueue(order, state.current_combatant_id) : order).map((x, i) => (
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
                  {state.active && (
                    <p className="label-caps text-[10px] text-muted-foreground">
                      {i === 0 ? "Agindo agora" : i === 1 ? "Próximo" : `${i + 1}º na fila`}
                    </p>
                  )}
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
                  {renderCustomConditions(x)}
                  {renderTurnActionBadges(x)}
                </div>
                {mine(x) && (
                  <>
                    <AttackDialog
                      attackerName={x.name}
                      options={attackOptionsOf(x)}
                      targets={attackTargetsOf(x)}
                      canIgnoreRange={isMaster}
                      disabledReason={attackBlockedReason(x)}
                      getSkillValue={(skillKey) =>
                        x.character_id
                          ? skillValueFor(group, x.character_id, skillKey)
                          : x.attack_bonus
                      }
                      onAttack={(option, targetId, bodyTarget) =>
                        resolveAttack(x, option, targetId, bodyTarget)
                      }
                      onDefend={() => defend(x)}
                    />
                    {x.kind === "character" && x.character_id && (
                      <>
                        <IntimidateDialog
                          attackerName={x.name}
                          targets={intimidationTargetsOf(x)}
                          disabled={!!attackBlockedReason(x)}
                          onIntimidate={(targetId) => resolveIntimidation(x, targetId)}
                        />
                        <ConvinceDialog
                          attackerName={x.name}
                          targets={intimidationTargetsOf(x)}
                          disabled={!!attackBlockedReason(x)}
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
              {isMaster && (
                <PositionEditor
                  key={`${x.pos_x ?? "none"}-${x.pos_y ?? "none"}`}
                  x={x.pos_x}
                  y={x.pos_y}
                  cols={map.cols}
                  rows={map.rows}
                  onSave={(posX, posY) => moveCombatant(x.id, posX, posY)}
                />
              )}
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
      <Dialog
        open={Boolean(presencePrompt)}
        onOpenChange={(open) => {
          if (!open) setPresencePrompt(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Presença Perturbadora</DialogTitle>
            <DialogDescription>
              Escolha Vigor ou Compostura e faça o teste contra CD {presencePrompt?.dc}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2">
            {(["vigor", "compostura"] as const).map((skill) => (
              <Button
                key={skill}
                type="button"
                variant={presenceSkill === skill ? "default" : "outline"}
                onClick={() => setPresenceSkill(skill)}
              >
                {skill === "vigor" ? "Vigor" : "Compostura"}
                {myId && ` (+${skillValueFor(group, myId, skill)})`}
              </Button>
            ))}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPresencePrompt(null)}>
              Ignorar
            </Button>
            <Button type="button" onClick={() => void respondToPresencePrompt()}>
              <Dices className="mr-1 size-4" /> Rolar teste
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {customConditionModal && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/70 p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="custom-condition-title"
            className="w-full max-w-sm space-y-4 rounded-xl border border-amber-400/40 bg-card p-5 shadow-paint"
          >
            <div>
              <p className="label-caps text-amber-300">Post-it no avatar</p>
              <h2
                id="custom-condition-title"
                className="font-display text-2xl font-bold uppercase"
              >
                Adicionar Condição
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Escreva uma condição para {customConditionModal.name}.
              </p>
            </div>
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                void addCustomCondition(customConditionModal.combatantId, newConditionText);
              }}
            >
              <input
                autoFocus
                className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                value={newConditionText}
                onChange={(event) => setNewConditionText(event.target.value)}
                placeholder="Ex.: Braço Quebrado -2"
                aria-label="Texto da condição"
                maxLength={120}
              />
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCustomConditionModal(null)}
                >
                  Cancelar
                </Button>
                <Button type="submit" variant="paint" disabled={!newConditionText.trim()}>
                  Adicionar
                </Button>
              </div>
            </form>
          </section>
        </div>
      )}
      {reaction &&
        (() => {
          const defender = combat.combatants.find((x) => x.id === reaction.defenderId);
          const foe = combat.combatants.find((x) => x.id === reaction.attackerId);
          if (!defender || !foe || !mine(defender)) return null;
          const dist = distanceBetween(defender, foe);
          const options = attackOptionsOf(defender).filter(
            (o) => o.reach !== "area" && (dist === null || dist <= o.range),
          );
          const retreat =
            defender.pos_x != null && defender.pos_y != null && foe.pos_x != null && foe.pos_y != null
              ? (() => {
                const occ = occupied();
                for (const mapItem of mapItems) occ.add(cellKey(mapItem.x, mapItem.y));
                return intimidationRetreatCell(
                  { x: foe.pos_x, y: foe.pos_y },
                  { x: defender.pos_x, y: defender.pos_y },
                  map.cols,
                  map.rows,
                  terrain,
                  occ,
                );
              })()
              : null;
          return (
            <div className="fixed inset-0 z-[70] grid place-items-center bg-black/70 p-4" role="presentation">
              <section
                role="dialog"
                aria-modal="true"
                aria-labelledby="reaction-title"
                className="w-full max-w-sm space-y-3 rounded-xl border border-primary/50 bg-card p-5 shadow-paint"
              >
                <p className="label-caps text-primary">Reação</p>
                <h2 id="reaction-title" className="font-display text-2xl font-bold uppercase">
                  {defender.name} esquivou!
                </h2>
                <p className="text-sm text-muted-foreground">
                  Escolha uma reação contra {foe.name}: contra-atacar ou recuar 1 casa.
                </p>
                <div className="space-y-2">
                  {options.map((o) => (
                    <Button
                      key={o.id}
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => {
                        setReaction(null);
                        void resolveAttack(defender, o, foe.id, "general", false, false, false);
                      }}
                    >
                      Contra-atacar: {o.name}
                    </Button>
                  ))}
                  {options.length === 0 && (
                    <p className="text-xs text-muted-foreground">Nenhum ataque alcança {foe.name}.</p>
                  )}
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    disabled={!retreat}
                    onClick={() => {
                      if (!retreat) return;
                      setReaction(null);
                      c.update.mutate([
                        { id: defender.id, patch: { pos_x: retreat.x, pos_y: retreat.y } },
                      ]);
                      toast(`${defender.name} recuou 1 casa.`);
                    }}
                  >
                    Recuar 1 casa{retreat ? "" : " (sem espaço)"}
                  </Button>
                  <Button variant="ghost" className="w-full" onClick={() => setReaction(null)}>
                    Não reagir
                  </Button>
                </div>
              </section>
            </div>
          );
        })()}
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
      {(() => {
        const chest = chestView ? (mapItemsWithIcons.find((x) => x.id === chestView.itemId) ?? null) : null;
        const tokenCharacterId =
          combat.combatants.find((x) => x.id === chestView?.tokenId)?.character_id ?? null;
        const takers = isMaster
          ? [...group.characters]
            .sort((a, b) => Number(b.id === tokenCharacterId) - Number(a.id === tokenCharacterId))
            .map((ch) => ({ id: ch.id, name: ch.name }))
          : group.characters
            .filter((ch) => ch.id === tokenCharacterId)
            .map((ch) => ({ id: ch.id, name: ch.name }));
        return (
          <ChestDialog
            key={chestView?.itemId ?? "none"}
            chest={chest}
            entries={chest ? parseChestItems(chest.chest_items) : []}
            open={!!chest}
            onOpenChange={(open) => !open && setChestView(null)}
            isMaster={isMaster}
            catalogItems={catalogItems}
            takers={takers}
            onTake={(entry, characterId) =>
              chest && void takeFromChest(chest.id, entry, characterId)
            }
            onAdd={(catalogItemId) => chest && void addToChest(chest.id, catalogItemId)}
            onRemove={(uid) =>
              chest &&
              void saveChestItems(
                chest.id,
                removeChestEntry(parseChestItems(chest.chest_items), uid),
              ).catch((error: Error) => toast.error(error.message))
            }
            onUpdate={async (patch) => {
              if (!chest) return;
              const { error } = await supabase
                .from("battle_map_items")
                .update(patch)
                .eq("id", chest.id);
              if (error) toast.error(`Não foi possível salvar o baú: ${error.message}`);
              void qc.invalidateQueries({ queryKey: ["battle_map_items"] });
            }}
            onDelete={async () => {
              if (!chest) return;
              const { error } = await supabase.from("battle_map_items").delete().eq("id", chest.id);
              if (error) toast.error(`Não foi possível remover o baú: ${error.message}`);
              setChestView(null);
              void qc.invalidateQueries({ queryKey: ["battle_map_items"] });
            }}
          />
        );
      })()}
    </div>
  );
}

function PositionEditor({
  x,
  y,
  cols,
  rows,
  onSave,
}: {
  x: number | null;
  y: number | null;
  cols: number;
  rows: number;
  onSave: (x: number, y: number) => void;
}) {
  const [coordinates, setCoordinates] = useState({ x: x ?? 0, y: y ?? 0 });
  return (
    <form
      className="mt-2 flex items-center gap-2 text-xs"
      onSubmit={(event) => {
        event.preventDefault();
        const nextX = Math.max(0, Math.min(cols - 1, coordinates.x));
        const nextY = Math.max(0, Math.min(rows - 1, coordinates.y));
        setCoordinates({ x: nextX, y: nextY });
        onSave(nextX, nextY);
      }}
    >
      <span className="label-caps text-muted-foreground">Grid X/Y</span>
      <input
        aria-label="Coordenada X do token"
        className="h-7 w-14 rounded border border-border bg-background px-1 text-center"
        type="number"
        min={0}
        max={cols - 1}
        value={coordinates.x}
        onChange={(event) =>
          setCoordinates((current) => ({ ...current, x: Number(event.target.value) || 0 }))
        }
      />
      <input
        aria-label="Coordenada Y do token"
        className="h-7 w-14 rounded border border-border bg-background px-1 text-center"
        type="number"
        min={0}
        max={rows - 1}
        value={coordinates.y}
        onChange={(event) =>
          setCoordinates((current) => ({ ...current, y: Number(event.target.value) || 0 }))
        }
      />
      <Button type="submit" size="sm" variant="outline" className="h-7">
        Posicionar
      </Button>
    </form>
  );
}

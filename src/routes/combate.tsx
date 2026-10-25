import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Dices, Minus, Plus, Swords, Trash2, X } from "lucide-react";
import { useState } from "react";

import { Avatar } from "@/components/rpg/AvatarUpload";
import { BattleMap, type MapToken } from "@/components/rpg/BattleMap";
import { Button } from "@/components/ui/button";
import { useCombat } from "@/hooks/use-combat";
import {
  ATTACK_SKILLS,
  CONDITIONS,
  INITIATIVE_SKILL,
  changeHp,
  findFreeCell,
  nextTurn,
  playerCombatStats,
  previousTurn,
  skillValueFor,
  sortByInitiative,
  uniqueName,
  cellKey,
  type Terrain,
} from "@/lib/combat";
import { logRolls } from "@/lib/roll-log";
import { battleMapQuery, combatQuery, groupQuery, monstersQuery, type Combatant } from "@/lib/rpg-queries";
import { roll2d6 } from "@/lib/skills";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/combate")({
  head: () => ({
    meta: [
      { title: "Combate — Eco dos Caídos" },
      { name: "description", content: "Mapa de batalha, iniciativa e turnos ao vivo para a mesa." },
      { property: "og:title", content: "Combate — Eco dos Caídos" },
      { property: "og:description", content: "Mapa de batalha, iniciativa e turnos ao vivo para a mesa." },
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
  const combat = { ...raw, combatants: raw.combatants.map((x) => ({ ...x, hp_current: x.hp_current ?? 0, hp_max: x.hp_max ?? 0 })) };
  const { data: group } = useSuspenseQuery(groupQuery);
  const { data: monsters } = useSuspenseQuery(monstersQuery);
  const { data: map } = useSuspenseQuery(battleMapQuery);
  const c = useCombat();
  const [hpDelta, setHpDelta] = useState(1);

  const order = sortByInitiative(combat.combatants);
  const slots = order.map((x) => ({ id: x.id, out: x.kind === "monster" && x.hp_current <= 0 }));
  const { state } = combat;
  const terrain = (map.terrain ?? {}) as Terrain;

  const occupied = () =>
    new Set(combat.combatants.filter((x) => x.pos_x != null && x.pos_y != null).map((x) => cellKey(x.pos_x!, x.pos_y!)));

  const avatarOf = (x: Pick<Combatant, "kind" | "character_id" | "monster_id">) =>
    x.kind === "character"
      ? group.characters.find((ch) => ch.id === x.character_id)?.avatar_url ?? ""
      : monsters.find((m) => m.id === x.monster_id)?.avatar_url ?? "";

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
        attack_bonus: Math.max(
          ...ATTACK_SKILLS.map((a) => skillValueFor(group, ch.id, a.key)),
        ),
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
        name: uniqueName(m.name, combat.combatants.map((x) => x.name)),
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
      combat.combatants.map((x) => ({ ...x, initiative: results.find((y) => y.x.id === x.id)!.r.total })),
    );
    c.setState.mutate({ active: true, round: 1, current_combatant_id: sorted[0]?.id ?? null });
  };

  const attack = (x: Combatant) => {
    const target = order.find((t) => t.id !== x.id && t.kind !== x.kind && t.hp_current > 0);
    const r = roll2d6(x.attack_bonus, target?.defense ?? null);
    void logRolls([
      {
        characterId: x.character_id,
        characterName: x.name,
        label: target ? `Ataque em ${target.name}` : "Ataque",
        result: r,
      },
    ]);
  };

  const tokens: MapToken[] = order.map((x) => ({
    id: x.id,
    name: x.name,
    avatar: avatarOf(x),
    tone: x.kind === "monster" ? "monster" : "player",
    x: x.pos_x,
    y: x.pos_y,
    hpPct: x.hp_max ? x.hp_current / x.hp_max : null,
    out: x.hp_current <= 0,
    current: x.id === state.current_combatant_id,
  }));

  const inCombat = new Set(combat.combatants.map((x) => x.character_id));

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-3 md:p-6">
      <header className="flex flex-wrap items-center gap-2">
        <h1 className="font-display text-3xl font-bold uppercase">Combate</h1>
        {state.active && <span className="label-caps text-primary">Rodada {state.round}</span>}
        <div className="ml-auto flex flex-wrap gap-2">
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
          <Button size="sm" variant="outline" onClick={() => { const p = previousTurn(slots, state.current_combatant_id, state.round); c.setState.mutate({ current_combatant_id: p.currentId, round: p.round }); }}>
            <ChevronLeft />
          </Button>
          <Button size="sm" variant="outline" onClick={() => { const n = nextTurn(slots, state.current_combatant_id, state.round); c.setState.mutate({ active: true, current_combatant_id: n.currentId, round: n.round }); }}>
            Próximo <ChevronRight />
          </Button>
          <Button size="sm" variant="destructive" onClick={() => confirm("Encerrar combate?") && c.end.mutate()}>
            <X /> Encerrar
          </Button>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="overflow-auto rounded-lg border border-border bg-card p-2">
          <BattleMap
            map={map}
            tokens={tokens}
            onMove={(id, x, y) => c.update.mutate([{ id, patch: { pos_x: x, pos_y: y } }])}
          />
        </div>

        <aside className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <span className="label-caps">Dano/cura:</span>
            <Button size="icon" variant="outline" className="size-7" onClick={() => setHpDelta((d) => Math.max(1, d - 1))}><Minus /></Button>
            <span className="w-6 text-center font-bold">{hpDelta}</span>
            <Button size="icon" variant="outline" className="size-7" onClick={() => setHpDelta((d) => d + 1)}><Plus /></Button>
          </div>
          {order.length === 0 && (
            <p className="text-sm text-muted-foreground">Adicione jogadores e monstros para começar.</p>
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
                <Avatar src={avatarOf(x)} name={x.name} tone={x.kind === "monster" ? "monster" : "player"} className="size-10" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{x.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Inic. {x.initiative ?? "—"} · Def {x.defense} · Atq +{x.attack_bonus}
                  </p>
                </div>
                <Button size="icon" variant="ghost" className="size-8" onClick={() => attack(x)} aria-label="Atacar">
                  <Swords />
                </Button>
                <Button size="icon" variant="ghost" className="size-8" onClick={() => c.remove.mutate(x.id)} aria-label="Remover">
                  <Trash2 />
                </Button>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <Button size="sm" variant="outline" className="h-7" onClick={() => c.update.mutate([{ id: x.id, patch: { hp_current: changeHp(x.hp_current, -hpDelta, x.hp_max) } }])}>
                  −{hpDelta}
                </Button>
                <div className="h-2 flex-1 overflow-hidden rounded bg-muted">
                  <div className="h-full bg-destructive" style={{ width: `${(x.hp_current / Math.max(1, x.hp_max)) * 100}%` }} />
                </div>
                <span className="w-14 text-right text-sm font-bold">{x.hp_current}/{x.hp_max}</span>
                <Button size="sm" variant="outline" className="h-7" onClick={() => c.update.mutate([{ id: x.id, patch: { hp_current: changeHp(x.hp_current, hpDelta, x.hp_max) } }])}>
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
                        c.update.mutate([{ id: x.id, patch: { conditions: on ? x.conditions.filter((k) => k !== cond) : [...x.conditions, cond] } }])
                      }
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-[11px]",
                        on ? "border-destructive bg-destructive/20 text-destructive" : "border-border text-muted-foreground",
                      )}
                    >
                      {cond}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </aside>
      </div>
    </div>
  );
}

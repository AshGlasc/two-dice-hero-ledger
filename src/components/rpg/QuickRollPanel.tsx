import { Dices } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { useMasterAuth } from "@/context/MasterAuthContext";
import { ATTRIBUTE_THEME } from "@/lib/attribute-theme";
import { skillValueFor } from "@/lib/combat";
import { usePlayerCharacterId } from "@/lib/player-character";
import { logRolls } from "@/lib/roll-log";
import type { GroupData } from "@/lib/rpg-queries";
import {
  ATTRIBUTES,
  DIFFICULTIES,
  OUTCOME_CLASS,
  OUTCOME_TEXT,
  roll2d6,
  type RollResult,
} from "@/lib/skills";
import { cn } from "@/lib/utils";

type Result = { name: string; result: RollResult };

/**
 * Rolagem rápida: 4 linhas (uma por atributo) com as skills em texto pequeno e a dificuldade.
 * Jogador rola o próprio personagem; o mestre escolhe quem rola (rolagem em grupo).
 */
export function QuickRollPanel({ group }: { group: GroupData }) {
  const { isMaster } = useMasterAuth();
  const myId = usePlayerCharacterId();
  const [difficulty, setDifficulty] = useState<number | null>(10);
  const [picked, setPicked] = useState<string[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [title, setTitle] = useState("");

  const rollers = isMaster
    ? group.characters.filter((c) => picked.includes(c.id))
    : group.characters.filter((c) => c.id === myId);

  const roll = (key: string, name: string) => {
    if (rollers.length === 0) {
      toast(isMaster ? "Escolha quem vai rolar." : "Você ainda não tem personagem neste aparelho.");
      return;
    }
    const rolled = rollers
      .map((c) => ({ id: c.id, name: c.name, result: roll2d6(skillValueFor(group, c.id, key), difficulty) }))
      .sort((a, b) => b.result.total - a.result.total);
    setResults(rolled);
    setTitle(name);
    void logRolls(
      rolled.map((r) => ({
        characterId: r.id,
        characterName: r.name,
        label: rolled.length > 1 ? `Teste em grupo: ${name}` : name,
        result: r.result,
      })),
    );
  };

  return (
    <section className="space-y-2 rounded-lg border border-border bg-card p-3 text-xs">
      <div className="flex flex-wrap items-center gap-1.5">
        <Dices className="size-4 text-primary" />
        <span className="label-caps text-primary">Rolagem rápida</span>
        {!isMaster && rollers[0] && (
          <span className="text-muted-foreground">· {rollers[0].name}</span>
        )}
      </div>

      {isMaster && (
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-muted-foreground">Quem rola:</span>
          {group.characters.map((c) => {
            const on = picked.includes(c.id);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setPicked((p) => (on ? p.filter((x) => x !== c.id) : [...p, c.id]))}
                className={cn(
                  "rounded-full border px-2 py-0.5",
                  on ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground",
                )}
              >
                {on ? "✓ " : ""}
                {c.name}
              </button>
            );
          })}
          <button
            type="button"
            className="ml-1 underline text-muted-foreground"
            onClick={() =>
              setPicked((p) =>
                p.length === group.characters.length ? [] : group.characters.map((c) => c.id),
              )
            }
          >
            {picked.length === group.characters.length ? "nenhum" : "todos"}
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1">
        <span className="text-muted-foreground">Dificuldade:</span>
        <button
          type="button"
          onClick={() => setDifficulty(null)}
          className={cn(
            "rounded border px-1.5 py-0.5",
            difficulty === null ? "border-primary bg-primary/15 text-primary" : "border-border",
          )}
        >
          Livre
        </button>
        {DIFFICULTIES.map((d) => (
          <button
            key={d.value}
            type="button"
            onClick={() => setDifficulty(d.value)}
            className={cn(
              "rounded border px-1.5 py-0.5",
              difficulty === d.value ? "border-primary bg-primary/15 text-primary" : "border-border",
            )}
            title={`${d.name} — ${d.value}`}
          >
            {d.name} {d.value}
          </button>
        ))}
      </div>

      <div className="space-y-1">
        {ATTRIBUTES.map((a) => {
          const theme = ATTRIBUTE_THEME[a.key];
          return (
            <div key={a.key} className="flex flex-wrap items-center gap-1">
              <span className={cn("w-16 shrink-0 font-bold uppercase", theme.text)}>{a.name}</span>
              {a.skills.map((s) => {
                const value =
                  !isMaster && rollers[0] ? skillValueFor(group, rollers[0].id, s.key) : null;
                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => roll(s.key, s.name)}
                    className={cn("rounded border px-1.5 py-0.5 hover:bg-muted", theme.border)}
                  >
                    {s.name}
                    {value !== null && <span className="ml-1 font-bold">{value}</span>}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>

      {results.length > 0 && (
        <div className="border-t border-border pt-2">
          <p className="mb-1 text-muted-foreground">{title}</p>
          <ul className="space-y-0.5">
            {results.map((r) => (
              <li key={r.name} className="flex items-center justify-between gap-2">
                <span className="font-semibold">{r.name}</span>
                <span className="tabular">
                  {r.result.dice[0]}+{r.result.dice[1]}+{r.result.modifier} ={" "}
                  <b className="text-sm">{r.result.total}</b>{" "}
                  <span className={OUTCOME_CLASS[r.result.outcome]}>
                    {OUTCOME_TEXT[r.result.outcome]}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

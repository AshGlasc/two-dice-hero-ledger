import { Dices } from "lucide-react";
import { useState } from "react";

import { DiceFace } from "@/components/rpg/DiceFace";
import { Stepper } from "@/components/rpg/Stepper";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CharacterSheet } from "@/lib/rpg-queries";
import {
  ATTRIBUTES,
  ATTRIBUTE_MAX,
  ATTRIBUTE_MIN,
  BONUS_MAX,
  BONUS_MIN,
  DIFFICULTIES,
  roll2d6,
  skillTotal,
  type RollResult,
} from "@/lib/skills";
import { cn } from "@/lib/utils";
import type { useSheetMutations } from "@/hooks/use-sheet-mutations";

type Mutations = ReturnType<typeof useSheetMutations>;
type LoggedRoll = RollResult & { id: number; label: string };

const OUTCOME_TEXT: Record<RollResult["outcome"], string> = {
  "critical-success": "Sucesso crítico",
  "critical-failure": "Falha crítica",
  success: "Sucesso",
  failure: "Falha",
  none: "Resultado",
};

const OUTCOME_CLASS: Record<RollResult["outcome"], string> = {
  "critical-success": "text-success",
  success: "text-success",
  "critical-failure": "text-destructive",
  failure: "text-destructive",
  none: "text-muted-foreground",
};

export function SkillsSection({ sheet, mutations }: { sheet: CharacterSheet; mutations: Mutations }) {
  const [difficulty, setDifficulty] = useState<string>("none");
  const [rolls, setRolls] = useState<LoggedRoll[]>([]);
  const { character, skills } = sheet;

  const bonusOf = (key: string) => skills.find((s) => s.skill_key === key)?.bonus ?? 0;

  const doRoll = (label: string, modifier: number) => {
    const dc = difficulty === "none" ? null : Number(difficulty);
    const result = roll2d6(modifier, dc);
    setRolls((prev) => [{ ...result, id: Date.now(), label }, ...prev].slice(0, 8));
  };

  const last = rolls[0];

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-6">
        {ATTRIBUTES.map((attr) => {
          const attrValue = character[attr.key];
          return (
            <section
              key={attr.key}
              className="overflow-hidden rounded-lg border border-intellect/40 bg-intellect-panel shadow-paint"
            >
              <header className="flex flex-wrap items-center justify-between gap-4 border-b border-intellect/30 px-5 py-4">
                <div>
                  <p className="label-caps text-intellect">Atributo</p>
                  <h2 className="text-4xl font-bold uppercase text-intellect">{attr.name}</h2>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="label-caps text-muted-foreground">Pontos</span>
                  <Stepper
                    size="lg"
                    label={attr.name}
                    value={attrValue}
                    min={ATTRIBUTE_MIN}
                    max={ATTRIBUTE_MAX}
                    onChange={(v) => mutations.updateCharacter.mutate({ [attr.key]: v })}
                  />
                </div>
              </header>

              <ul className="divide-y divide-border">
                {attr.skills.map((skill) => {
                  const bonus = bonusOf(skill.key);
                  const total = skillTotal(attrValue, bonus);
                  return (
                    <li
                      key={skill.key}
                      className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-3 px-5 py-4 md:grid-cols-[1fr_auto_auto_auto]"
                    >
                      <div className="col-span-2 md:col-span-1">
                        <h3 className="text-xl font-semibold uppercase text-foreground">
                          {skill.name}
                        </h3>
                        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                          {skill.description}
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-center">
                          <p className="label-caps text-muted-foreground">Base</p>
                          <p className="tabular font-display text-lg font-semibold text-intellect">
                            {attrValue}
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="label-caps text-muted-foreground">Extra</p>
                          <Stepper
                            label={`pontos extras de ${skill.name}`}
                            value={bonus}
                            min={BONUS_MIN}
                            max={BONUS_MAX}
                            onChange={(v) =>
                              mutations.setSkillBonus.mutate({ skillKey: skill.key, bonus: v })
                            }
                          />
                        </div>
                      </div>
                      <div className="text-center">
                        <p className="label-caps text-muted-foreground">Total</p>
                        <p className="tabular font-display text-3xl font-bold text-foreground">
                          {total}
                        </p>
                      </div>
                      <Button
                        variant="intellect"
                        onClick={() => doRoll(skill.name, total)}
                        aria-label={`Rolar ${skill.name}`}
                      >
                        <Dices /> Rolar
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>

      <aside className="h-fit space-y-4 rounded-lg border border-border bg-card p-5 shadow-paint lg:sticky lg:top-6">
        <div>
          <p className="label-caps text-primary">Mesa de dados</p>
          <h2 className="text-2xl font-bold uppercase">2d6 + skill</h2>
        </div>

        <div className="space-y-1.5">
          <span className="label-caps text-muted-foreground">Dificuldade</span>
          <Select value={difficulty} onValueChange={setDifficulty}>
            <SelectTrigger aria-label="Dificuldade">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sem dificuldade</SelectItem>
              {DIFFICULTIES.map((d) => (
                <SelectItem key={d.value} value={String(d.value)}>
                  {d.name} — {d.value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-md border border-dashed border-border bg-muted/50 p-4">
          {last ? (
            <div key={last.id} className="animate-fade-up space-y-3 text-center">
              <p className="label-caps text-muted-foreground">{last.label}</p>
              <div className="flex justify-center gap-3">
                <DiceFace value={last.dice[0]} />
                <DiceFace value={last.dice[1]} />
              </div>
              <p className="tabular text-sm text-muted-foreground">
                {last.dice[0]} + {last.dice[1]} + {last.modifier}
              </p>
              <p className="tabular font-display text-6xl font-bold leading-none">{last.total}</p>
              <p className={cn("label-caps text-sm", OUTCOME_CLASS[last.outcome])}>
                {OUTCOME_TEXT[last.outcome]}
                {last.difficulty !== null && ` (precisa ${last.difficulty})`}
              </p>
            </div>
          ) : (
            <p className="py-8 text-center text-sm italic text-muted-foreground">
              Escolha uma skill e role os dados.
            </p>
          )}
        </div>

        <Button variant="outline" className="w-full" onClick={() => doRoll("2d6 puro", 0)}>
          <Dices /> Rolar 2d6 puro
        </Button>

        {rolls.length > 1 && (
          <div>
            <p className="label-caps mb-2 text-muted-foreground">Últimas rolagens</p>
            <ul className="space-y-1 text-sm">
              {rolls.slice(1).map((r) => (
                <li key={r.id} className="flex justify-between gap-2 border-b border-border/60 py-1">
                  <span className="truncate">{r.label}</span>
                  <span className={cn("tabular font-display font-semibold", OUTCOME_CLASS[r.outcome])}>
                    {r.total}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </aside>
    </div>
  );
}

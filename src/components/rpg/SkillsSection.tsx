import { Dices } from "lucide-react";
import { useState } from "react";

import { BodyMap } from "@/components/rpg/BodyMap";
import { DiceFace } from "@/components/rpg/DiceFace";
import { SkillIcon } from "@/components/rpg/SkillIcon";
import { Stepper } from "@/components/rpg/Stepper";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { useSheetMutations } from "@/hooks/use-sheet-mutations";
import { ATTRIBUTE_THEME } from "@/lib/attribute-theme";
import { logRolls } from "@/lib/roll-log";
import type { CharacterSheet } from "@/lib/rpg-queries";
import {
  ATTRIBUTES,
  ATTRIBUTE_MAX,
  ATTRIBUTE_MIN,
  BONUS_MAX,
  BONUS_MIN,
  DIFFICULTIES,
  OUTCOME_CLASS,
  OUTCOME_TEXT,
  roll2d6,
  skillTotal,
  type RollResult,
} from "@/lib/skills";
import { cn } from "@/lib/utils";

type Mutations = ReturnType<typeof useSheetMutations>;
type LoggedRoll = RollResult & { id: number; label: string };

export function SkillsSection({ sheet, mutations }: { sheet: CharacterSheet; mutations: Mutations }) {
  const [difficulty, setDifficulty] = useState<string>("none");
  const [rolls, setRolls] = useState<LoggedRoll[]>([]);
  const { character, skills } = sheet;

  const bonusOf = (key: string) => skills.find((s) => s.skill_key === key)?.bonus ?? 0;

  const doRoll = (label: string, modifier: number) => {
    const dc = difficulty === "none" ? null : Number(difficulty);
    const result = roll2d6(modifier, dc);
    setRolls((prev) => [{ ...result, id: Date.now(), label }, ...prev].slice(0, 8));
    void logRolls([
      { characterId: character.id, characterName: character.name, label, result },
    ]);
  };

  const last = rolls[0];

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        {/* Celular: dificuldade sempre à mão, sem precisar descer até a mesa de dados */}
        <div className="sticky top-14 z-30 -mx-4 flex items-center gap-2 border-b border-border bg-background/95 px-4 py-2 backdrop-blur lg:hidden">
          <Select value={difficulty} onValueChange={setDifficulty}>
            <SelectTrigger aria-label="Dificuldade" className="h-9 flex-1">
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
          <Button variant="outline" size="sm" onClick={() => doRoll("2d6 puro", 0)}>
            <Dices /> 2d6
          </Button>
        </div>
        <nav className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Atributos">
          {ATTRIBUTES.map((attr) => {
            const theme = ATTRIBUTE_THEME[attr.key];
            return (
              <a
                key={attr.key}
                href={`#attr-${attr.key}`}
                className={cn(
                  "rounded-md border px-3 py-2 transition-colors hover:bg-muted",
                  theme.border,
                  theme.panel,
                )}
              >
                <span className={cn("label-caps", theme.text)}>{attr.name}</span>
                <span className="tabular block font-display text-3xl font-bold">
                  {character[attr.key]}
                </span>
              </a>
            );
          })}
        </nav>

        {ATTRIBUTES.map((attr) => {
          const attrValue = character[attr.key];
          const theme = ATTRIBUTE_THEME[attr.key];
          return (
            <section
              key={attr.key}
              id={`attr-${attr.key}`}
              className={cn("scroll-mt-20 overflow-hidden rounded-lg border shadow-paint", theme.border, theme.panel)}
            >
              <header className={cn("flex flex-wrap items-center justify-between gap-4 border-b px-5 py-4", theme.border)}>
                <div>
                  <p className={cn("label-caps", theme.text)}>Atributo</p>
                  <h2 className={cn("text-4xl font-bold uppercase", theme.text)}>{attr.name}</h2>
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
                      className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-3 px-4 py-4 md:grid-cols-[auto_1fr_auto_auto_auto] md:px-5"
                    >
                      <SkillIcon skillKey={skill.key} attribute={attr.key} name={skill.name} />
                      <div>
                        <h3 className="text-xl font-semibold uppercase text-foreground">
                          {skill.name}
                        </h3>
                        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                          {skill.description}
                        </p>
                      </div>
                      <div className="col-span-2 flex items-center justify-between gap-4 md:col-span-1">
                        <div className="text-center">
                          <p className="label-caps text-muted-foreground">Base</p>
                          <p className={cn("tabular font-display text-lg font-semibold", theme.text)}>
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
                        <div className="text-center md:hidden">
                          <p className="label-caps text-muted-foreground">Total</p>
                          <p className="tabular font-display text-3xl font-bold">{total}</p>
                        </div>
                        <Button
                          variant={theme.button}
                          className="md:hidden"
                          onClick={() => doRoll(skill.name, total)}
                        >
                          <Dices /> Rolar
                        </Button>
                      </div>
                      <div className="hidden text-center md:block">
                        <p className="label-caps text-muted-foreground">Total</p>
                        <p className="tabular font-display text-3xl font-bold text-foreground">
                          {total}
                        </p>
                      </div>
                      <Button
                        variant={theme.button}
                        className="hidden md:inline-flex"
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

      <aside className="h-fit space-y-6 lg:sticky lg:top-20">
        <div className="hidden space-y-4 rounded-lg border border-border bg-card p-5 shadow-paint lg:block">
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
        </div>

        <div className="rounded-lg border border-border bg-card p-5 shadow-paint">
          <p className="label-caps text-primary">Corpo</p>
          <h2 className="mb-1 text-2xl font-bold uppercase">Estado dos membros</h2>
          <p className="mb-4 text-xs text-muted-foreground">
            Clique num membro: amarelo = ferido, vermelho = grave, de novo = normal.
          </p>
          <BodyMap characterId={character.id} body={sheet.body} />
        </div>
      </aside>
    </div>
  );
}

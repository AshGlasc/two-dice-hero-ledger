import { useEffect, useState } from "react";

import { DiceFace } from "@/components/rpg/DiceFace";
import { onRolls, playDiceSound, type BurstRoll } from "@/lib/roll-burst";
import { OUTCOME_CLASS, OUTCOME_TEXT, type RollOutcome } from "@/lib/skills";
import { cn } from "@/lib/utils";

const FLASH: Partial<Record<RollOutcome, string>> = {
  "critical-success": "bg-success/30",
  "critical-failure": "bg-destructive/40",
  success: "bg-success/10",
  failure: "bg-destructive/15",
};

/** Aviso grande, no meio da tela de todo mundo, quando alguém rola os dados. */
export function RollBurst() {
  const [shown, setShown] = useState<{ id: number; rolls: BurstRoll[] } | null>(null);

  useEffect(
    () =>
      onRolls((rolls) => {
        const dramatic = rolls.some((r) => r.outcome.startsWith("critical"));
        playDiceSound(dramatic);
        setShown({ id: Date.now(), rolls });
      }),
    [],
  );

  useEffect(() => {
    if (!shown) return;
    const ms = shown.rolls.length > 1 ? 5500 : 3800;
    const t = setTimeout(() => setShown(null), ms);
    return () => clearTimeout(t);
  }, [shown]);

  if (!shown) return null;
  const { rolls } = shown;
  const single = rolls.length === 1 ? rolls[0] : null;
  const outcome = (single?.outcome ?? "none") as RollOutcome;
  const crit = outcome.startsWith("critical");

  return (
    <div
      key={shown.id}
      role="status"
      aria-live="assertive"
      onClick={() => setShown(null)}
      className="fixed inset-0 z-[100] grid cursor-pointer place-items-center bg-background/70 p-4 backdrop-blur-sm"
    >
      <div className={cn("pointer-events-none absolute inset-0 animate-flash", FLASH[outcome] ?? "")} />
      {single ? (
        <div className={cn("relative w-full max-w-md animate-burst-in text-center", crit && "animate-shake")}>
          {single.hidden && (
            <p className="mx-auto mb-2 w-fit rounded-full border border-primary/50 px-3 py-0.5 text-xs font-bold uppercase tracking-wider text-primary">
              🤫 Rolagem silenciosa
            </p>
          )}
          <p className="label-caps text-primary">{single.label}</p>
          <p className="mt-1 truncate font-display text-4xl font-bold uppercase leading-none md:text-5xl">
            {single.name || "Alguém"}
          </p>
          <div className="mt-6 flex justify-center gap-5">
            <DiceFace value={single.die1} className="h-20 w-20 animate-tumble md:h-24 md:w-24" />
            <DiceFace
              value={single.die2}
              className="h-20 w-20 animate-tumble [animation-delay:90ms] md:h-24 md:w-24"
            />
          </div>
          <p className="tabular mt-4 text-muted-foreground">
            {single.die1} + {single.die2} + {single.modifier}
          </p>
          <p className="tabular animate-slam font-display text-[7rem] font-bold leading-none md:text-[9rem]">
            {single.total}
          </p>
          {outcome !== "none" && (
            <p
              className={cn(
                "animate-slam font-display text-3xl font-bold uppercase tracking-widest md:text-4xl",
                OUTCOME_CLASS[outcome],
              )}
            >
              {OUTCOME_TEXT[outcome]}
              {single.difficulty !== null && (
                <span className="block text-sm tracking-normal text-muted-foreground">
                  precisava {single.difficulty}
                </span>
              )}
            </p>
          )}
        </div>
      ) : (
        <div className="relative w-full max-w-md animate-burst-in rounded-lg border border-border bg-card p-5 shadow-paint">
          <p className="label-caps text-primary">{rolls[0]?.label}</p>
          <p className="font-display text-3xl font-bold uppercase">
            {rolls.every((r) => r.hidden) ? "🤫 Rolagem silenciosa" : "A mesa rolou!"}
          </p>
          <ol className="mt-3 divide-y divide-border">
            {[...rolls]
              .sort((a, b) => b.total - a.total)
              .map((r, i) => (
                <li key={i} className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0 truncate font-display text-xl font-semibold uppercase">
                    {r.name}
                  </span>
                  <span className="flex shrink-0 items-baseline gap-2">
                    <span className="tabular text-xs text-muted-foreground">
                      {r.die1}+{r.die2}+{r.modifier}
                    </span>
                    <span
                      className={cn(
                        "tabular animate-slam font-display text-3xl font-bold",
                        OUTCOME_CLASS[r.outcome as RollOutcome],
                      )}
                    >
                      {r.total}
                    </span>
                  </span>
                </li>
              ))}
          </ol>
        </div>
      )}
      <p className="absolute bottom-6 text-xs text-muted-foreground">Toque para fechar</p>
    </div>
  );
}

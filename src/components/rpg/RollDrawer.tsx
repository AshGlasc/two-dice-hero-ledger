import { useQuery } from "@tanstack/react-query";
import { Dices, Lock, Volume2, VolumeX } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useMasterAuth } from "@/context/MasterAuthContext";
import { setSoundEnabled, soundEnabled } from "@/lib/roll-burst";
import { publicRollsQuery, rollsQuery } from "@/lib/rpg-queries";
import { OUTCOME_CLASS, OUTCOME_TEXT, type RollOutcome } from "@/lib/skills";
import { cn } from "@/lib/utils";

/** Histórico de rolagens da mesa, aberto de qualquer página. */
export function RollDrawer({ trigger }: { trigger?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [sound, setSound] = useState(true);
  const [showHidden, setShowHidden] = useState(false);
  const { isMaster } = useMasterAuth();
  useEffect(() => setSound(soundEnabled()), []);
  const { data: rolls = [] } = useQuery({
    ...(isMaster ? rollsQuery : publicRollsQuery),
    enabled: open,
  });
  const visibleRolls = rolls.filter((r) => (showHidden ? r.hidden && isMaster : !r.hidden));

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm">
            <Dices /> Rolagens
          </Button>
        )}
      </SheetTrigger>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-sm">
        <SheetHeader>
          <p className="label-caps text-success">Ao vivo</p>
          <SheetTitle className="font-display text-3xl font-bold uppercase">
            Rolagens da mesa
          </SheetTitle>
        </SheetHeader>
        <Button
          variant="ghost"
          size="sm"
          className="self-start"
          onClick={() => {
            setSoundEnabled(!sound);
            setSound(!sound);
          }}
        >
          {sound ? <Volume2 /> : <VolumeX />} Som dos dados: {sound ? "ligado" : "desligado"}
        </Button>
        {isMaster && (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={!showHidden ? "secondary" : "outline"}
              onClick={() => setShowHidden(false)}
            >
              Rolagens da mesa
            </Button>
            <Button
              size="sm"
              variant={showHidden ? "secondary" : "outline"}
              onClick={() => setShowHidden(true)}
            >
              <Lock /> 🤫 Rolagens Ocultas ({rolls.filter((r) => r.hidden).length})
            </Button>
          </div>
        )}
        {visibleRolls.length === 0 ? (
          <p className="py-10 text-center text-sm italic text-muted-foreground">
            {showHidden ? "Nenhuma rolagem oculta." : "Ninguém rolou ainda."}
          </p>
        ) : (
          <ul className="-mr-2 flex-1 space-y-1 overflow-y-auto pr-2 text-sm">
            {visibleRolls.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-2 border-b border-border/60 py-2"
              >
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 font-display text-base font-semibold uppercase">
                    <span className="truncate">{r.character_name || "—"}</span>
                    {r.hidden && (
                      <span className="flex items-center gap-0.5 rounded bg-destructive/15 px-1.5 py-0.2 text-[10px] font-bold text-destructive">
                        <Lock className="size-2.5" /> Oculto
                      </span>
                    )}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {r.label} ·{" "}
                    {new Date(r.created_at).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </span>
                <span className="flex shrink-0 items-baseline gap-2">
                  <span className="tabular text-xs text-muted-foreground">
                    {r.die1}+{r.die2}+{r.modifier}
                  </span>
                  <span
                    className={cn(
                      "tabular font-display text-2xl font-bold",
                      OUTCOME_CLASS[r.outcome as RollOutcome],
                    )}
                    title={OUTCOME_TEXT[r.outcome as RollOutcome]}
                  >
                    {r.total}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </SheetContent>
    </Sheet>
  );
}

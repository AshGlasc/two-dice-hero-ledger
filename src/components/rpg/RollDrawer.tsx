import { useQuery } from "@tanstack/react-query";
import { Dices, Volume2, VolumeX } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { setSoundEnabled, soundEnabled } from "@/lib/roll-burst";
import { rollsQuery } from "@/lib/rpg-queries";
import { OUTCOME_CLASS, OUTCOME_TEXT, type RollOutcome } from "@/lib/skills";
import { cn } from "@/lib/utils";

/** Histórico de rolagens da mesa, aberto de qualquer página. */
export function RollDrawer({ trigger }: { trigger?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [sound, setSound] = useState(true);
  useEffect(() => setSound(soundEnabled()), []);
  const { data: rolls = [] } = useQuery({ ...rollsQuery, enabled: open });

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
          <SheetTitle className="font-display text-3xl font-bold uppercase">Rolagens da mesa</SheetTitle>
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
        {rolls.length === 0 ? (
          <p className="py-10 text-center text-sm italic text-muted-foreground">Ninguém rolou ainda.</p>
        ) : (
          <ul className="-mr-2 flex-1 space-y-1 overflow-y-auto pr-2 text-sm">
            {rolls.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 border-b border-border/60 py-2">
                <span className="min-w-0">
                  <span className="block truncate font-display text-base font-semibold uppercase">
                    {r.character_name || "—"}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {r.label} ·{" "}
                    {new Date(r.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </span>
                <span className="flex shrink-0 items-baseline gap-2">
                  <span className="tabular text-xs text-muted-foreground">
                    {r.die1}+{r.die2}+{r.modifier}
                  </span>
                  <span
                    className={cn("tabular font-display text-2xl font-bold", OUTCOME_CLASS[r.outcome as RollOutcome])}
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

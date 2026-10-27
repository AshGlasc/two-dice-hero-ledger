import { Shield, Swords } from "lucide-react";
import { useState } from "react";

import { Avatar } from "@/components/rpg/AvatarUpload";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { AttackOption } from "@/lib/combat";
import { cn } from "@/lib/utils";

export type AttackTarget = {
  id: string;
  name: string;
  avatar: string;
  tone: "player" | "monster";
  distance: number | null;
};

const dmgText = (d: AttackOption["damage"]) =>
  `${d.count > 0 ? `${d.count}d${d.sides}` : ""}${d.bonus ? `${d.bonus > 0 && d.count > 0 ? "+" : ""}${d.bonus}` : ""}`;

/** Menu do ⚔️: escolhe o ataque e um alvo dentro do alcance. */
export function AttackDialog({
  attackerName,
  options,
  targets,
  canIgnoreRange,
  disabledReason,
  onAttack,
  onDefend,
}: {
  attackerName: string;
  options: AttackOption[];
  targets: AttackTarget[];
  canIgnoreRange: boolean;
  disabledReason?: string | null;
  onAttack: (option: AttackOption, targetId: string) => void;
  onDefend: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [optId, setOptId] = useState(options[0]?.id ?? "");
  const opt = options.find((o) => o.id === optId) ?? options[0];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost" className="size-8" aria-label={`Atacar com ${attackerName}`}>
          <Swords />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ação de {attackerName}</DialogTitle>
          <DialogDescription>
            Escolha o ataque e toque num alvo dentro do alcance.
          </DialogDescription>
        </DialogHeader>
        {disabledReason ? (
          <p className="rounded border border-border bg-muted/40 p-3 text-sm">{disabledReason}</p>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-1.5">
              {options.map((o) => {
                const empty = (o.usesMax ?? 0) > 0 && (o.usesCurrent ?? 0) <= 0;
                return (
                  <button
                    key={o.id}
                    type="button"
                    disabled={empty}
                    onClick={() => setOptId(o.id)}
                    className={cn(
                      "flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-sm",
                      opt?.id === o.id ? "border-primary bg-primary/10" : "border-border",
                      empty && "opacity-50",
                    )}
                  >
                    <span>
                      <b>{o.name}</b>
                      {o.note && <span className="ml-1 text-xs text-muted-foreground">{o.note}</span>}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      +{o.hitBonus} · {dmgText(o.damage)} · {o.range} casa{o.range > 1 ? "s" : ""}
                      {(o.usesMax ?? 0) > 0 && (
                        <span className={cn("ml-1", empty && "text-destructive")}>
                          · {o.usesCurrent}/{o.usesMax}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>

            {opt && (
              <div className="space-y-1.5">
                <p className="label-caps text-muted-foreground">Alvo</p>
                {targets.length === 0 && (
                  <p className="text-sm text-muted-foreground">Ninguém para atacar.</p>
                )}
                {targets.map((t) => {
                  const inRange = t.distance !== null && t.distance <= opt.range;
                  const allowed = inRange || canIgnoreRange;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      disabled={!allowed}
                      onClick={() => {
                        onAttack(opt, t.id);
                        setOpen(false);
                      }}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-left text-sm",
                        inRange ? "border-destructive/60 hover:bg-destructive/10" : "border-border",
                        !allowed && "cursor-not-allowed opacity-40",
                      )}
                    >
                      <Avatar src={t.avatar} name={t.name} tone={t.tone} className="size-7 text-[10px]" />
                      <span className="flex-1 font-semibold">{t.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {t.distance === null
                          ? "fora do mapa"
                          : inRange
                            ? `${t.distance} casa${t.distance > 1 ? "s" : ""}`
                            : `${t.distance} casas — longe${canIgnoreRange ? " (mestre)" : ""}`}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                onDefend();
                setOpen(false);
              }}
            >
              <Shield /> Defender (+2 defesa e esquiva até a próxima vez)
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

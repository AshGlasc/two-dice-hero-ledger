import { MessageCircle } from "lucide-react";
import { useState } from "react";

import { Avatar } from "@/components/rpg/AvatarUpload";
import type { AttackTarget } from "@/components/rpg/AttackDialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function ConvinceDialog({
  attackerName,
  targets,
  disabled,
  onConvince,
}: {
  attackerName: string;
  targets: AttackTarget[];
  disabled: boolean;
  onConvince: (targetId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className="size-8 text-sky-300 hover:bg-sky-900/30"
          aria-label={`Convencer alvo com ${attackerName}`}
          disabled={disabled}
          title={disabled ? "Ação indisponível neste momento." : "Convencer um alvo (2 energia)"}
        >
          <MessageCircle />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Convencer — {attackerName}</DialogTitle>
          <DialogDescription>
            Custa 2 de energia. Empatia + Sugestão contra Vontade/Compostura; um sucesso deixa o
            alvo Hesitante por uma rodada.
          </DialogDescription>
        </DialogHeader>
        {targets.length === 0 ? (
          <p className="rounded border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
            Nenhum adversário visível ao alcance.
          </p>
        ) : (
          <div className="space-y-2">
            {targets.map((target) => (
              <Button
                key={target.id}
                variant="outline"
                className="h-auto w-full justify-start gap-2 py-2"
                onClick={() => {
                  onConvince(target.id);
                  setOpen(false);
                }}
              >
                <Avatar
                  src={target.avatar}
                  name={target.name}
                  tone={target.tone}
                  className="size-8 text-[10px]"
                />
                <span className="flex-1 text-left">{target.name}</span>
                <span className="text-xs text-muted-foreground">
                  {target.distance === null ? "sem posição" : `${target.distance} casas`}
                </span>
              </Button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

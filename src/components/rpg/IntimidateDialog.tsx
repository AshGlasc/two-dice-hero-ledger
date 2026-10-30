import { Skull } from "lucide-react";
import { useState } from "react";

import { Avatar } from "@/components/rpg/AvatarUpload";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { AttackTarget } from "@/components/rpg/AttackDialog";

export function IntimidateDialog({
  attackerName,
  targets,
  disabled,
  onIntimidate,
}: {
  attackerName: string;
  targets: AttackTarget[];
  disabled: boolean;
  onIntimidate: (targetId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className="size-8 text-warning hover:bg-warning/10 hover:text-warning"
          aria-label={`Intimidar com ${attackerName}`}
          disabled={disabled}
          title={disabled ? "Ação indisponível neste momento." : "Intimidar um alvo próximo"}
        >
          <Skull />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Intimidar — {attackerName}</DialogTitle>
          <DialogDescription>
            Escolha um adversário visível a até 6 casas. Autoridade/Ferramenta Física contra
            Vontade/Compostura.
          </DialogDescription>
        </DialogHeader>
        {targets.length === 0 ? (
          <p className="rounded border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
            Nenhum adversário visível ao alcance.
          </p>
        ) : (
          <div className="space-y-2">
            {targets.map((target) => (
              <button
                key={target.id}
                type="button"
                onClick={() => {
                  onIntimidate(target.id);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded-md border border-warning/40 px-3 py-2 text-left text-sm hover:bg-warning/10"
              >
                <Avatar
                  src={target.avatar}
                  name={target.name}
                  tone={target.tone}
                  className="size-8 text-[10px]"
                />
                <span className="flex-1 font-semibold">{target.name}</span>
                <span className="text-xs text-muted-foreground">{target.distance} casas</span>
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

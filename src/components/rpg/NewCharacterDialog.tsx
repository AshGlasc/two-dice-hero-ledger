import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { UserPlus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Stepper } from "@/components/rpg/Stepper";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { ATTRIBUTE_THEME } from "@/lib/attribute-theme";
import { ATTRIBUTES, ATTRIBUTE_MAX, ATTRIBUTE_MIN, type AttributeKey } from "@/lib/skills";
import { cn } from "@/lib/utils";

const START: Record<AttributeKey, number> = { intelecto: 2, psique: 2, fisico: 2, motor: 2 };

export function NewCharacterDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [player, setPlayer] = useState("");
  const [concept, setConcept] = useState("");
  const [attrs, setAttrs] = useState(START);
  const qc = useQueryClient();
  const navigate = useNavigate();

  const create = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("characters")
        .insert({
          name: name.trim(),
          player_name: player.trim(),
          concept: concept.trim(),
          ...attrs,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: async (id) => {
      await qc.invalidateQueries({ queryKey: ["characters"] });
      qc.invalidateQueries({ queryKey: ["group"] });
      setOpen(false);
      setName("");
      setPlayer("");
      setConcept("");
      setAttrs(START);
      navigate({ to: "/personagem/$id", params: { id } });
    },
    onError: (e) => {
      console.error(e);
      toast.error("Não foi possível criar o personagem.");
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (name.trim()) create.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="paint" size="lg">
          <UserPlus /> Novo personagem
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <form onSubmit={submit} className="space-y-5">
          <DialogHeader>
            <DialogTitle className="font-display text-3xl uppercase">Novo personagem</DialogTitle>
            <DialogDescription>
              As subskills começam com os mesmos pontos do atributo. Você adiciona extras depois.
            </DialogDescription>
          </DialogHeader>
          <label className="block space-y-1.5">
            <span className="label-caps text-muted-foreground">Nome do personagem</span>
            <Input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="label-caps text-muted-foreground">Jogador</span>
              <Input value={player} onChange={(e) => setPlayer(e.target.value)} />
            </label>
            <label className="block space-y-1.5">
              <span className="label-caps text-muted-foreground">Conceito</span>
              <Input
                placeholder="Ex.: Detetive amnésico"
                value={concept}
                onChange={(e) => setConcept(e.target.value)}
              />
            </label>
          </div>
          <div className="space-y-2">
            {ATTRIBUTES.map((a) => {
              const theme = ATTRIBUTE_THEME[a.key];
              return (
                <div
                  key={a.key}
                  className={cn("flex items-center justify-between rounded-md border px-4 py-2", theme.border, theme.soft)}
                >
                  <span className={cn("font-display text-xl font-bold uppercase", theme.text)}>
                    {a.name}
                  </span>
                  <Stepper
                    label={a.name}
                    value={attrs[a.key]}
                    min={ATTRIBUTE_MIN}
                    max={ATTRIBUTE_MAX}
                    onChange={(v) => setAttrs((s) => ({ ...s, [a.key]: v }))}
                  />
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button type="submit" variant="paint" disabled={create.isPending || !name.trim()}>
              Criar ficha
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

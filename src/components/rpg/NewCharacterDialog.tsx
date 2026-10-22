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
import { ATTRIBUTE_MAX, ATTRIBUTE_MIN } from "@/lib/skills";

export function NewCharacterDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [player, setPlayer] = useState("");
  const [concept, setConcept] = useState("");
  const [intelecto, setIntelecto] = useState(2);
  const qc = useQueryClient();
  const navigate = useNavigate();

  const create = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("characters")
        .insert({ name: name.trim(), player_name: player.trim(), concept: concept.trim(), intelecto })
        .select("id")
        .single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: async (id) => {
      await qc.invalidateQueries({ queryKey: ["characters"] });
      setOpen(false);
      setName("");
      setPlayer("");
      setConcept("");
      setIntelecto(2);
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
      <DialogContent>
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
          <div className="flex items-center justify-between rounded-md border border-intellect/40 bg-intellect-soft px-4 py-3">
            <span className="font-display text-xl font-bold uppercase text-intellect">Intelecto</span>
            <Stepper
              size="lg"
              label="Intelecto"
              value={intelecto}
              min={ATTRIBUTE_MIN}
              max={ATTRIBUTE_MAX}
              onChange={setIntelecto}
            />
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

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { Crown, Lock, User, UserPlus } from "lucide-react";
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
import { useMasterAuth } from "@/context/MasterAuthContext";
import { supabase } from "@/integrations/supabase/client";
import { ATTRIBUTE_THEME } from "@/lib/attribute-theme";
import { checkCanCreateCharacter, setPlayerCharacterId } from "@/lib/player-character";
import { charactersQuery } from "@/lib/rpg-queries";
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

  const { isMaster } = useMasterAuth();
  const { data: characters = [] } = useQuery(charactersQuery);
  const check = checkCanCreateCharacter(characters, isMaster);

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
      if (!isMaster) {
        setPlayerCharacterId(id);
      }
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

  // Se o jogador comum já possui um personagem ativo
  if (!check.allowed && check.existingCharacter) {
    const existing = check.existingCharacter;
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="paint" size="lg" className="gap-2">
            <User className="size-5" /> Meu Personagem: {existing.name}
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <div className="flex items-center gap-2 text-warning">
              <Lock className="size-5" />
              <DialogTitle className="font-display text-2xl uppercase">Limite de Personagem</DialogTitle>
            </div>
            <DialogDescription className="space-y-2 pt-2 text-sm text-foreground/90">
              <p>
                Jogadores podem criar apenas <strong>1 personagem por vez</strong> nesta mesa. O mestre da mesa não possui essa restrição.
              </p>
              <div className="rounded-lg border border-border bg-card p-3">
                <span className="text-xs uppercase text-muted-foreground">Seu personagem ativo:</span>
                <p className="font-display text-xl font-bold uppercase text-primary">{existing.name}</p>
                {existing.concept && <p className="text-xs italic text-muted-foreground">{existing.concept}</p>}
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Fechar
            </Button>
            <Button asChild variant="paint" onClick={() => setOpen(false)}>
              <Link to="/personagem/$id" params={{ id: existing.id }}>
                Abrir Minha Ficha
              </Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="paint" size="lg" className="gap-2">
          {isMaster ? <Crown className="size-5 text-warning" /> : <UserPlus className="size-5" />}
          Novo personagem {isMaster && "(Mestre)"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <form onSubmit={submit} className="space-y-5">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="font-display text-3xl uppercase">Novo personagem</DialogTitle>
              {isMaster && (
                <span className="flex items-center gap-1 rounded bg-primary/10 px-2 py-0.5 text-xs font-bold uppercase text-primary">
                  <Crown className="size-3" /> Mestre (Sem limites)
                </span>
              )}
            </div>
            <DialogDescription>
              As subskills começam com os mesmos pontos do atributo. Você adiciona extras depois.
              {!isMaster && " (Jogadores possuem 1 personagem por vez)."}
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

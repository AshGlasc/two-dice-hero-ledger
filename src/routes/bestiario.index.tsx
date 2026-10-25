import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ChevronRight, Crown, Heart, Lock, Plus, Shield, Skull, Swords } from "lucide-react";
import { useState } from "react";

import { Avatar } from "@/components/rpg/AvatarUpload";
import { MasterUnlockModal } from "@/components/rpg/MasterUnlockModal";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useMasterAuth } from "@/context/MasterAuthContext";
import { useMonsters } from "@/hooks/use-monsters";
import { monstersQuery } from "@/lib/rpg-queries";

export const Route = createFileRoute("/bestiario/")({
  head: () => ({
    meta: [
      { title: "Bestiário — Eco dos Caídos" },
      {
        name: "description",
        content: "Bestiário do Eco dos Caídos: perfis dos monstros, quem eles eram antes, PV, defesa, ataques e habilidades.",
      },
      { property: "og:title", content: "Bestiário — Eco dos Caídos" },
      { property: "og:description", content: "Os monstros da mesa — e quem eles eram antes da transformação." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(monstersQuery),
  component: BestiaryPage,
});

function NewMonsterDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const { create } = useMonsters();
  const navigate = useNavigate();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    create.mutate(name.trim(), {
      onSuccess: (m) => {
        setOpen(false);
        setName("");
        navigate({ to: "/bestiario/$id", params: { id: m.id } });
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="paint">
          <Plus /> Novo monstro
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle className="font-display text-3xl uppercase">Novo monstro</DialogTitle>
          </DialogHeader>
          <Input autoFocus placeholder="Ex.: O Afogado do Cais" value={name} onChange={(e) => setName(e.target.value)} />
          <DialogFooter>
            <Button type="submit" variant="paint" disabled={!name.trim() || create.isPending}>
              Criar e editar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function BestiaryPage() {
  const { data: monsters } = useSuspenseQuery(monstersQuery);
  const { isMaster } = useMasterAuth();

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 md:px-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="label-caps text-destructive">Os que se perderam</span>
            {isMaster ? (
              <span className="flex items-center gap-1 text-xs text-primary" title="Você tem permissão de mestre">
                <Crown className="size-3" /> Mestre Ativo
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-muted-foreground" title="Apenas o mestre pode criar e editar monstros">
                <Lock className="size-3" /> Visualização
              </span>
            )}
          </div>
          <h1 className="text-6xl font-bold uppercase leading-none md:text-7xl">Bestiário</h1>
          <p className="mt-2 max-w-xl text-muted-foreground">
            Cada monstro já foi alguém. Guarde quem eram, o que viraram e como lutam.
          </p>
        </div>
        {isMaster ? (
          <NewMonsterDialog />
        ) : (
          <MasterUnlockModal
            trigger={
              <Button variant="outline" className="gap-2">
                <Lock className="size-4 text-muted-foreground" /> Novo monstro (Mestre)
              </Button>
            }
          />
        )}
      </header>

      {monsters.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-border py-16 text-center text-muted-foreground">
          <Skull className="size-10" />
          <p className="italic">Nenhum monstro ainda. Crie o primeiro para o combate.</p>
          {isMaster ? (
            <NewMonsterDialog />
          ) : (
            <MasterUnlockModal
              trigger={
                <Button variant="outline" className="gap-2">
                  <Lock className="size-4 text-muted-foreground" /> Criar monstro (Mestre)
                </Button>
              }
            />
          )}
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {monsters.map((m) => (
            <li key={m.id}>
              <Link
                to="/bestiario/$id"
                params={{ id: m.id }}
                className="group flex h-full flex-col justify-between gap-4 rounded-lg border border-border bg-card p-5 shadow-paint transition-colors hover:border-destructive"
              >
                <div className="flex items-start gap-4">
                  <Avatar src={m.avatar_url} name={m.name} tone="monster" className="size-14 text-lg" />
                  <div className="min-w-0">
                    <h2 className="truncate text-3xl font-bold uppercase leading-none group-hover:text-destructive">
                      {m.name}
                    </h2>
                    <p className="mt-1 line-clamp-2 text-sm italic text-muted-foreground">
                      {m.former_life ? `Antes: ${m.former_life}` : "Quem era antes? Ninguém lembra."}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="tabular flex gap-4 font-display text-lg font-semibold">
                    <span className="flex items-center gap-1 text-destructive" title="PV">
                      <Heart className="size-4" /> {m.hp_max}
                    </span>
                    <span className="flex items-center gap-1 text-intellect" title="Defesa">
                      <Shield className="size-4" /> {m.defense}
                    </span>
                    <span className="flex items-center gap-1 text-primary" title="Ataque">
                      <Swords className="size-4" /> +{m.attack_bonus}
                    </span>
                  </div>
                  <ChevronRight className="size-5 text-muted-foreground transition-transform group-hover:translate-x-1" />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

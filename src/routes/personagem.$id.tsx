import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Backpack, Brain, Crosshair, Swords, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AttacksSection } from "@/components/rpg/AttacksSection";
import { AvatarUpload } from "@/components/rpg/AvatarUpload";
import { BackpackSection } from "@/components/rpg/BackpackSection";
import { SetPinDialog } from "@/components/rpg/CharacterPinDialogs";
import { InlineField } from "@/components/rpg/InlineField";
import { MoneyField } from "@/components/rpg/MoneyField";
import { SkillsSection } from "@/components/rpg/SkillsSection";
import { WeaponsSection } from "@/components/rpg/WeaponsSection";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMasterAuth } from "@/context/MasterAuthContext";
import { useSheetMutations } from "@/hooks/use-sheet-mutations";
import { supabase } from "@/integrations/supabase/client";
import { clearPlayerCharacterId, getPlayerCharacterId } from "@/lib/player-character";
import { sheetQuery } from "@/lib/rpg-queries";

export const Route = createFileRoute("/personagem/$id")({
  loader: async ({ context, params }) => {
    const sheet = await context.queryClient.ensureQueryData(sheetQuery(params.id));
    if (!sheet) throw notFound();
    return { name: sheet.character.name };
  },
  head: ({ loaderData }) => {
    const title = loaderData ? `${loaderData.name} — Ficha de personagem` : "Ficha de personagem";
    return {
      meta: [
        { title },
        {
          name: "description",
          content: "Atributos, skills, arsenal e mochila deste personagem.",
        },
        { property: "og:title", content: title },
        {
          property: "og:description",
          content: "Atributos, skills, arsenal e mochila deste personagem.",
        },
        { property: "og:type", content: "profile" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  notFoundComponent: () => (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-5xl font-bold uppercase">Ficha não encontrada</h1>
      <p className="text-muted-foreground">Esse personagem não existe ou foi apagado.</p>
      <Button asChild variant="paint">
        <Link to="/">Voltar ao arquivo</Link>
      </Button>
    </main>
  ),
  component: CharacterPage,
});

function CharacterPage() {
  const { id } = Route.useParams();
  const { data: sheet } = useSuspenseQuery(sheetQuery(id));
  const mutations = useSheetMutations(id);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isMaster, isLoading: masterAuthLoading } = useMasterAuth();
  const [playerCharacterId, setPlayerCharacterId] = useState<string | null>(null);
  const ownsCharacter = playerCharacterId === id;

  useEffect(() => {
    const ownerId = getPlayerCharacterId();
    setPlayerCharacterId(ownerId);
    if (!masterAuthLoading && !isMaster && ownerId !== id) {
      toast.error("Essa ficha não é sua. Use \"Entrar com PIN\" na página inicial.");
      navigate({ to: "/" });
    }
  }, [id, isMaster, masterAuthLoading, navigate, playerCharacterId]);

  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("characters").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      if (getPlayerCharacterId() === id) {
        clearPlayerCharacterId();
      }
      await qc.invalidateQueries({ queryKey: ["characters"] });
      toast.success("Personagem apagado.");
      navigate({ to: "/" });
    },
    onError: () => toast.error("Não foi possível apagar."),
  });

  if (!sheet) return null;
  if (!isMaster && (!ownsCharacter || masterAuthLoading)) return null;
  const { character } = sheet;

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-8">
      <div className="mb-6 flex items-center justify-between">
        <Button asChild variant="ghost" size="sm">
          <Link to="/">
            <ArrowLeft /> Arquivo
          </Link>
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive">
              <Trash2 /> Apagar ficha
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Apagar {character.name}?</AlertDialogTitle>
              <AlertDialogDescription>
                A ficha, as armas e a mochila serão apagadas para sempre.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => remove.mutate()}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Apagar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <header className="mb-8 border-b border-border pb-6">
        <div className="flex items-center gap-4 md:gap-6">
          <AvatarUpload
            src={character.avatar_url}
            name={character.name}
            onChange={(v) => mutations.updateCharacter.mutate({ avatar_url: v })}
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="label-caps px-1 text-muted-foreground">Rosto aparece no mapa de combate</p>
              {(character.skill_points ?? 0) > 0 && (
                <Badge
                  variant="outline"
                  className="animate-pulse border-primary/60 bg-primary/20 text-xs font-semibold text-primary shadow-sm"
                >
                  ✨ Nível {character.level ?? 1} — {character.skill_points}{" "}
                  {character.skill_points === 1
                    ? "Ponto de Habilidade Disponível"
                    : "Pontos de Habilidade Disponíveis"}
                </Badge>
              )}
            </div>
            <InlineField
              label="Nome do personagem"
              value={character.name}
              required
              onSave={(v) => mutations.updateCharacter.mutate({ name: v })}
              className="h-auto px-1 font-display text-4xl font-bold uppercase leading-none md:text-7xl"
            />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <MoneyField
            value={character.money}
            canEdit={isMaster}
            onSave={(v) => mutations.updateCharacter.mutate({ money: v })}
          />
          <Button asChild variant="outline" size="sm">
            <Link to="/celular">📱 Abrir celular</Link>
          </Button>
          <SetPinDialog characterId={character.id} hasPin={!!character.pin_hash} />
          {!character.pin_hash && (
            <span className="text-xs text-muted-foreground">
              Crie um PIN para abrir esta ficha em outro aparelho.
            </span>
          )}
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <label className="block">
            <span className="label-caps px-1 text-muted-foreground">Jogador</span>
            <InlineField
              label="Jogador"
              value={character.player_name}
              placeholder="Quem joga com essa ficha?"
              onSave={(v) => mutations.updateCharacter.mutate({ player_name: v })}
              className="px-1"
            />
          </label>
          <label className="block">
            <span className="label-caps px-1 text-muted-foreground">Conceito</span>
            <InlineField
              label="Conceito"
              value={character.concept}
              placeholder="Ex.: Detetive amnésico"
              onSave={(v) => mutations.updateCharacter.mutate({ concept: v })}
              className="px-1 italic"
            />
          </label>
        </div>
      </header>

      <Tabs defaultValue="ficha">
        <TabsList className="mb-6 h-auto w-full justify-start gap-1 rounded-md border border-border bg-card p-1 sm:w-auto">
          <TabsTrigger value="ficha" className="font-display uppercase tracking-wider data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Brain /> Ficha
          </TabsTrigger>
          <TabsTrigger value="armas" className="font-display uppercase tracking-wider data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Crosshair /> Armas ({sheet.weapons.length})
          </TabsTrigger>
          <TabsTrigger value="ataques" className="font-display uppercase tracking-wider data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Swords className="mr-1.5 size-4" /> Ataques
          </TabsTrigger>
          <TabsTrigger value="mochila" className="font-display uppercase tracking-wider data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Backpack /> Mochila ({sheet.backpack.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ficha" className="space-y-6">
          <SkillsSection sheet={sheet} mutations={mutations} />
          <section className="rounded-lg border border-border bg-card p-5 shadow-paint">
            <p className="label-caps mb-2 text-muted-foreground">Anotações</p>
            <InlineField
              multiline
              label="Anotações do personagem"
              value={character.notes}
              placeholder="História, pistas, pensamentos internalizados…"
              onSave={(v) => mutations.updateCharacter.mutate({ notes: v })}
            />
          </section>
        </TabsContent>
        <TabsContent value="armas">
          <WeaponsSection sheet={sheet} mutations={mutations} />
        </TabsContent>
        <TabsContent value="ataques">
          <AttacksSection sheet={sheet} mutations={mutations} />
        </TabsContent>
        <TabsContent value="mochila">
          <BackpackSection sheet={sheet} mutations={mutations} />
        </TabsContent>
      </Tabs>
    </main>
  );
}

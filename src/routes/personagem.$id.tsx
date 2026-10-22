import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Backpack, Brain, Crosshair, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { BackpackSection } from "@/components/rpg/BackpackSection";
import { InlineField } from "@/components/rpg/InlineField";
import { SkillsSection } from "@/components/rpg/SkillsSection";
import { WeaponsSection } from "@/components/rpg/WeaponsSection";
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
import { useSheetMutations } from "@/hooks/use-sheet-mutations";
import { supabase } from "@/integrations/supabase/client";
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

  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("characters").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["characters"] });
      toast.success("Personagem apagado.");
      navigate({ to: "/" });
    },
    onError: () => toast.error("Não foi possível apagar."),
  });

  if (!sheet) return null;
  const { character } = sheet;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 md:px-6">
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
        <InlineField
          label="Nome do personagem"
          value={character.name}
          required
          onSave={(v) => mutations.updateCharacter.mutate({ name: v })}
          className="h-auto px-1 font-display text-5xl font-bold uppercase leading-none md:text-7xl"
        />
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
        <TabsContent value="mochila">
          <BackpackSection sheet={sheet} mutations={mutations} />
        </TabsContent>
      </Tabs>
    </main>
  );
}

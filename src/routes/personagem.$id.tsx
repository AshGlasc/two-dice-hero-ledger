import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Backpack, Brain, Crosshair, Swords, Trash2, X } from "lucide-react";
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
import { Stepper } from "@/components/rpg/Stepper";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMasterAuth } from "@/context/MasterAuthContext";
import { useSheetMutations } from "@/hooks/use-sheet-mutations";
import { supabase } from "@/integrations/supabase/client";
import { clearPlayerCharacterId, getPlayerCharacterId } from "@/lib/player-character";
import { sheetQuery } from "@/lib/rpg-queries";
import { isSanityCritical } from "@/lib/sanity";
import { cn } from "@/lib/utils";

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
  const [whisper, setWhisper] = useState<string | null>(null);
  const ownsCharacter = playerCharacterId === id;
  const canAccessSheet = isMaster || ownsCharacter;
  const sanityCurrent = sheet?.character.sanity_current ?? 10;
  const sanityMax = sheet?.character.sanity_max ?? 10;
  const collapsed = sanityCurrent === 0;
  const [collapseReaction, setCollapseReaction] = useState<string | null>(null);

  useEffect(() => {
    const ownerId = getPlayerCharacterId();
    setPlayerCharacterId(ownerId);
    if (!masterAuthLoading && !isMaster && ownerId !== id) {
      toast.error('Essa ficha não é sua. Use "Entrar com PIN" na página inicial.');
      navigate({ to: "/" });
    }
  }, [id, isMaster, masterAuthLoading, navigate, playerCharacterId]);

  useEffect(() => {
    if (!canAccessSheet || masterAuthLoading) return;
    const channel = supabase
      .channel(`sanity-whispers-${id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "sanity_whispers",
          filter: `character_id=eq.${id}`,
        },
        (payload) => {
          const row = payload.new as { message?: unknown };
          if (typeof row.message === "string" && row.message.trim()) setWhisper(row.message);
        },
      )
      .subscribe((status, error) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.error("A conexão com os sussurros do mestre falhou.", error);
        }
      });
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [canAccessSheet, id, masterAuthLoading]);

  useEffect(() => {
    setCollapseReaction(
      sanityCurrent === 0
        ? ["Paranoia", "Ataque de Pânico", "Catatonia"][Math.floor(Math.random() * 3)]!
        : null,
    );
  }, [sanityCurrent]);

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
  const sanityCritical = isSanityCritical(sanityCurrent, sanityMax);

  return (
    <main
      className={cn(
        "mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-8",
        sanityCritical &&
          "relative rounded-xl border-2 border-purple-900/70 shadow-[0_0_38px_rgba(88,28,135,0.28)]",
      )}
    >
      {sanityCritical && (
        <>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-10 rounded-xl border-2 border-purple-500/30 animate-pulse"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none fixed inset-0 z-30"
            style={{
              background:
                "radial-gradient(ellipse at center, transparent 52%, rgba(76, 29, 89, 0.22) 100%)",
            }}
          />
        </>
      )}
      {whisper && (
        <div
          role="alert"
          className="fixed left-1/2 top-16 z-50 flex w-[min(92vw,36rem)] -translate-x-1/2 items-start gap-3 rounded-lg border border-purple-500/60 bg-purple-950/95 p-4 text-purple-100 shadow-[0_0_36px_rgba(88,28,135,0.55)] animate-in fade-in slide-in-from-top-3"
        >
          <Brain className="mt-0.5 size-5 shrink-0 text-purple-300" />
          <div className="min-w-0 flex-1">
            <p className="label-caps text-purple-300">Um sussurro no escuro</p>
            <p className="mt-1 italic">{whisper}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-purple-200 hover:bg-purple-900"
            aria-label="Dispensar sussurro"
            onClick={() => setWhisper(null)}
          >
            <X className="size-4" />
          </Button>
        </div>
      )}
      <div className="mb-6 flex items-center justify-between">
        <Button asChild variant="ghost" size="sm">
          <Link to="/">
            <ArrowLeft /> Arquivo
          </Link>
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-destructive"
            >
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
              <p className="label-caps px-1 text-muted-foreground">
                Rosto aparece no mapa de combate
              </p>
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

      {collapsed && (
        <section
          role="alert"
          className="mb-6 rounded-lg border-2 border-destructive/70 bg-destructive/10 p-4 shadow-[0_0_28px_rgba(127,29,29,0.3)]"
        >
          <p className="label-caps text-destructive">Colapso total</p>
          <h2 className="font-display text-2xl font-bold uppercase text-destructive">
            {character.name} sucumbiu à própria mente
          </h2>
          <p className="mt-1 text-sm text-foreground">
            Reação: <strong>{collapseReaction}</strong>. Ataques bloqueados até a sanidade voltar.
          </p>
        </section>
      )}

      <SanityBar
        current={sanityCurrent}
        max={sanityMax}
        isMaster={isMaster}
        onChange={(sanity_current) => mutations.updateCharacter.mutate({ sanity_current })}
        onMaxChange={(sanity_max) =>
          mutations.updateCharacter.mutate({
            sanity_max,
            sanity_current: Math.min(sanityCurrent, sanity_max),
          })
        }
      />

      <Tabs defaultValue="ficha">
        <TabsList className="mb-6 h-auto w-full justify-start gap-1 rounded-md border border-border bg-card p-1 sm:w-auto">
          <TabsTrigger
            value="ficha"
            className="font-display uppercase tracking-wider data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            <Brain /> Ficha
          </TabsTrigger>
          <TabsTrigger
            value="armas"
            className="font-display uppercase tracking-wider data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            <Crosshair /> Armas ({sheet.weapons.length})
          </TabsTrigger>
          <TabsTrigger
            value="ataques"
            className="font-display uppercase tracking-wider data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            <Swords className="mr-1.5 size-4" /> Ataques
          </TabsTrigger>
          <TabsTrigger
            value="mochila"
            className="font-display uppercase tracking-wider data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
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
          <AttacksSection sheet={sheet} mutations={mutations} collapsed={collapsed} />
        </TabsContent>
        <TabsContent value="mochila">
          <BackpackSection sheet={sheet} mutations={mutations} />
        </TabsContent>
      </Tabs>
    </main>
  );
}

function SanityBar({
  current,
  max,
  isMaster,
  onChange,
  onMaxChange,
}: {
  current: number;
  max: number;
  isMaster: boolean;
  onChange: (value: number) => void;
  onMaxChange: (value: number) => void;
}) {
  const critical = isSanityCritical(current, max);
  const percent = Math.max(0, Math.min(100, (current / Math.max(1, max)) * 100));
  return (
    <section
      className={cn(
        "mb-6 rounded-lg border bg-card p-4 shadow-paint",
        critical ? "border-purple-700/80 bg-purple-950/20" : "border-border",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Brain className="size-5 text-purple-400" />
          <div>
            <h2 className="font-display text-lg font-bold uppercase text-purple-300">Sanidade</h2>
            <p className="tabular-nums text-sm text-muted-foreground">
              {current} / {max}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="size-8 border-purple-700/60"
            aria-label="Reduzir sanidade"
            disabled={current <= 0}
            onClick={() => onChange(Math.max(0, current - 1))}
          >
            −
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-8 border-purple-700/60"
            aria-label="Aumentar sanidade"
            disabled={current >= max}
            onClick={() => onChange(Math.min(max, current + 1))}
          >
            +
          </Button>
          {isMaster && (
            <div className="ml-2">
              <span className="label-caps text-muted-foreground">Máximo</span>
              <Stepper
                label="sanidade máxima"
                value={max}
                min={1}
                max={99}
                onChange={onMaxChange}
              />
            </div>
          )}
        </div>
      </div>
      <div
        className="mt-3 h-3 overflow-hidden rounded-full bg-purple-950"
        role="progressbar"
        aria-label="Sanidade atual"
        aria-valuenow={current}
        aria-valuemin={0}
        aria-valuemax={max}
      >
        <div
          className={cn(
            "h-full rounded-full transition-all",
            critical ? "bg-fuchsia-500 shadow-[0_0_14px_rgba(217,70,239,0.65)]" : "bg-purple-500",
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
      {critical && (
        <Badge
          variant="outline"
          className="mt-3 border-purple-500/70 bg-purple-950/60 text-purple-200"
        >
          Mente Instável (−2 em testes de Intelecto e Psique)
        </Badge>
      )}
    </section>
  );
}

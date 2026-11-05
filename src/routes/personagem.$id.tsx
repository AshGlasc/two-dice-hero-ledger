import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { Backpack, Brain, Crosshair, Printer, Swords, Trash2, Users, X } from "lucide-react";
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
import { maxEnergyFor } from "@/lib/survival";
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
  const characterVigor = sheet?.skills.find((skill) => skill.skill_key === "vigor")?.bonus ?? 0;
  const characterWill = sheet?.skills.find((skill) => skill.skill_key === "vontade")?.bonus ?? 0;
  const energyMax = sheet
    ? maxEnergyFor(sheet.character, characterVigor, characterWill)
    : 10;
  const energyCurrent = Math.min(sheet?.character.energia_atual ?? 10, energyMax);

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
  const updateSurvival = (patch: { hunger_state?: string; thirst_state?: string }) => {
    const nextCharacter = { ...character, ...patch };
    const nextMax = maxEnergyFor(nextCharacter, characterVigor, characterWill);
    mutations.updateCharacter.mutate({
      ...patch,
      energia_atual: Math.min(character.energia_atual, nextMax),
      energia_maxima: nextMax,
    });
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-8 print:p-2 print:max-w-none">
      <style>{`
        @media print {
          @page { size: A4; margin: 12mm; }
          html, body { background: #fff !important; color: #111 !important; }
          main { max-width: none !important; padding: 0 !important; }
          nav, header.sticky, .print\\:hidden, button:not(.print\\:inline) { display: none !important; }
          [role="tablist"] { display: none !important; }
          [role="tabpanel"], [role="tabpanel"][hidden] {
            display: block !important;
            break-inside: avoid-page;
          }
          [role="dialog"], [data-radix-popper-content-wrapper] { display: none !important; }
          .shadow-paint, .shadow-sm { box-shadow: none !important; }
          .border-border { border-color: #cbd5e1 !important; }
          .bg-card { background: #fff !important; border: 1px solid #cbd5e1 !important; }
          * { color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      {whisper && (
        <div
          role="alert"
          className="fixed left-1/2 top-16 z-50 flex w-[min(92vw,36rem)] -translate-x-1/2 items-start gap-3 rounded-lg border border-purple-500/60 bg-purple-950/95 p-4 text-purple-100 shadow-[0_0_36px_rgba(88,28,135,0.55)] animate-in fade-in slide-in-from-top-3 print:hidden"
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

      <div className="mb-6 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm" className="gap-2 border-border/80 text-xs font-semibold text-muted-foreground hover:text-foreground">
            <Link to="/">
              <Users className="size-3.5" /> Abrir fichas / Trocar de personagem
            </Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            className="gap-2 border-border/80 text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            <Printer className="size-3.5" /> Imprimir / PDF
          </Button>
        </div>
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

      <header className="mb-8 border-b border-border pb-6 print:border-b-2 print:pb-4">
        <div className="flex items-center gap-4 md:gap-6">
          <AvatarUpload
            src={character.avatar_url}
            name={character.name}
            onChange={(v) => mutations.updateCharacter.mutate({ avatar_url: v })}
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="label-caps px-1 text-muted-foreground print:hidden">
                Rosto aparece no mapa de combate
              </p>
              {(character.skill_points ?? 0) > 0 && (
                <Badge
                  variant="outline"
                  className="animate-pulse border-primary/60 bg-primary/20 text-xs font-semibold text-primary shadow-sm print:hidden"
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
        <div className="mt-3 flex flex-wrap items-center gap-2 print:hidden">
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
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <label className="block rounded-md border border-border/60 bg-card/60 p-2.5">
            <span className="label-caps px-1 text-amber-500 font-semibold">🚬 Meu Vício</span>
            <InlineField
              label="Meu Vício"
              value={character.vicio ?? ""}
              placeholder="Ex.: Cigarros Astra, café amargo..."
              onSave={(v) => mutations.updateCharacter.mutate({ vicio: v })}
              className="px-1 italic text-sm"
            />
          </label>
          <label className="block rounded-md border border-border/60 bg-card/60 p-2.5">
            <span className="label-caps px-1 text-emerald-500 font-semibold">🛋️ Meu Conforto</span>
            <InlineField
              label="Meu Conforto"
              value={character.conforto ?? ""}
              placeholder="Ex.: Música lo-fi, foto amassada..."
              onSave={(v) => mutations.updateCharacter.mutate({ conforto: v })}
              className="px-1 italic text-sm"
            />
          </label>
        </div>
      </header>

      <SurvivalStatusBars
        hunger={character.hunger_state ?? "satisfeito"}
        thirst={character.thirst_state ?? "satisfeito"}
        onHungerChange={(hunger_state) => updateSurvival({ hunger_state })}
        onThirstChange={(thirst_state) => updateSurvival({ thirst_state })}
      />

      <EnergyBar
        current={energyCurrent}
        max={energyMax}
        onChange={(energia_atual) =>
          mutations.updateCharacter.mutate({ energia_atual, energia_maxima: energyMax })
        }
      />

      <Tabs defaultValue="ficha">
        <TabsList className="mb-6 h-auto w-full justify-start gap-1 rounded-md border border-border bg-card p-1 sm:w-auto">
          <TabsTrigger
            value="ficha"
            className="font-display uppercase tracking-wider data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            <Brain className="mr-1.5 size-4" /> Atributos & Skills
          </TabsTrigger>
          <TabsTrigger
            value="armas"
            className="font-display uppercase tracking-wider data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            <Crosshair className="mr-1.5 size-4" /> Armas ({sheet.weapons.length})
          </TabsTrigger>
          <TabsTrigger
            value="ataques"
            className="font-display uppercase tracking-wider data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            <Swords className="mr-1.5 size-4" /> Ataques e Ações
          </TabsTrigger>
          <TabsTrigger
            value="mochila"
            className="font-display uppercase tracking-wider data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            <Backpack className="mr-1.5 size-4" /> Mochila ({sheet.backpack.length})
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

function SurvivalStatusBars({
  hunger,
  thirst,
  onHungerChange,
  onThirstChange,
}: {
  hunger: string;
  thirst: string;
  onHungerChange: (v: string) => void;
  onThirstChange: (v: string) => void;
}) {
  return (
    <section className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div className="rounded-lg border border-border/80 bg-card p-3 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <span className="font-display text-sm font-bold uppercase tracking-wider text-foreground">
            🍲 Fome
          </span>
          <span
            className={cn(
              "rounded border px-2 py-0.5 text-xs font-semibold",
              hunger === "satisfeito"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                : hunger === "amarelo"
                  ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                  : "border-red-500/30 bg-red-500/10 text-red-400",
            )}
          >
            {hunger === "satisfeito"
              ? "Alimentado"
              : hunger === "amarelo"
                ? "Faminto (-1 En, -1 Fís/Mot)"
                : "Desnutrido (-2 En, -2 Fís/Mot)"}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          <button
            type="button"
            onClick={() => onHungerChange("satisfeito")}
            className={cn(
              "rounded border px-2 py-1 text-xs font-semibold transition-colors",
              hunger === "satisfeito"
                ? "border-emerald-500 bg-emerald-500/20 text-emerald-300"
                : "border-transparent bg-muted/40 text-muted-foreground hover:bg-muted",
            )}
          >
            Alimentado
          </button>
          <button
            type="button"
            onClick={() => onHungerChange("amarelo")}
            className={cn(
              "rounded border px-2 py-1 text-xs font-semibold transition-colors",
              hunger === "amarelo"
                ? "border-amber-500 bg-amber-500/20 text-amber-300"
                : "border-transparent bg-muted/40 text-muted-foreground hover:bg-muted",
            )}
          >
            Faminto
          </button>
          <button
            type="button"
            onClick={() => onHungerChange("vermelho")}
            className={cn(
              "rounded border px-2 py-1 text-xs font-semibold transition-colors",
              hunger === "vermelho"
                ? "border-red-500 bg-red-500/20 text-red-300"
                : "border-transparent bg-muted/40 text-muted-foreground hover:bg-muted",
            )}
          >
            Desnutrido
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-border/80 bg-card p-3 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <span className="font-display text-sm font-bold uppercase tracking-wider text-foreground">
            💧 Sede
          </span>
          <span
            className={cn(
              "rounded border px-2 py-0.5 text-xs font-semibold",
              thirst === "satisfeito"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                : thirst === "amarelo"
                  ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                  : "border-red-500/30 bg-red-500/10 text-red-400",
            )}
          >
            {thirst === "satisfeito"
              ? "Hidratado"
              : thirst === "amarelo"
                ? "Com Sede (-1 En, -1 Fís/Mot)"
                : "Desidratado (-2 En, -2 Fís/Mot)"}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          <button
            type="button"
            onClick={() => onThirstChange("satisfeito")}
            className={cn(
              "rounded border px-2 py-1 text-xs font-semibold transition-colors",
              thirst === "satisfeito"
                ? "border-emerald-500 bg-emerald-500/20 text-emerald-300"
                : "border-transparent bg-muted/40 text-muted-foreground hover:bg-muted",
            )}
          >
            Hidratado
          </button>
          <button
            type="button"
            onClick={() => onThirstChange("amarelo")}
            className={cn(
              "rounded border px-2 py-1 text-xs font-semibold transition-colors",
              thirst === "amarelo"
                ? "border-amber-500 bg-amber-500/20 text-amber-300"
                : "border-transparent bg-muted/40 text-muted-foreground hover:bg-muted",
            )}
          >
            Com Sede
          </button>
          <button
            type="button"
            onClick={() => onThirstChange("vermelho")}
            className={cn(
              "rounded border px-2 py-1 text-xs font-semibold transition-colors",
              thirst === "vermelho"
                ? "border-red-500 bg-red-500/20 text-red-300"
                : "border-transparent bg-muted/40 text-muted-foreground hover:bg-muted",
            )}
          >
            Desidratado
          </button>
        </div>
      </div>
    </section>
  );
}

function EnergyBar({
  current,
  max,
  onChange,
}: {
  current: number;
  max: number;
  onChange: (value: number) => void;
}) {
  const percent = Math.max(0, Math.min(100, (current / Math.max(1, max)) * 100));
  return (
    <section className="mb-6 rounded-lg border border-sky-500/40 bg-card p-4 shadow-paint">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold uppercase text-sky-300">Energia</h2>
          <p className="tabular-nums text-sm text-muted-foreground">
            {current} / {max} · Exausto quando chega a zero
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <span className="label-caps text-muted-foreground">Ajuste rápido</span>
          <input
            type="number"
            min={0}
            max={max}
            value={current}
            onChange={(event) =>
              onChange(Math.max(0, Math.min(max, Number(event.target.value) || 0)))
            }
            aria-label="Energia atual"
            className="h-9 w-20 rounded-md border border-sky-500/40 bg-background px-2 text-right tabular-nums"
          />
        </label>
      </div>
      <div
        className="mt-3 h-3 overflow-hidden rounded-full bg-sky-950"
        role="progressbar"
        aria-label="Energia atual"
        aria-valuenow={current}
        aria-valuemin={0}
        aria-valuemax={max}
      >
        <div
          className="h-full rounded-full bg-sky-400 transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>
    </section>
  );
}

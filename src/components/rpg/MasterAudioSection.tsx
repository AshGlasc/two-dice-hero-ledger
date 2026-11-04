import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Volume2,
  VolumeX,
  Play,
  Pause,
  Plus,
  Trash2,
  CloudRain,
  Wind,
  Flame,
  Zap,
  Square,
  Music,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { appSettingsQuery } from "@/lib/rpg-queries";
import type { AmbienceType } from "@/lib/audio";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type MusicTrack = {
  id: string;
  title: string;
  url: string;
  category: string;
};

const DEFAULT_TRACK_CATEGORIES = [
  "Combate Tenso",
  "Investigação Fria",
  "Fuga & Perseguição",
  "Sobrenatural / Caos",
  "Descanso & Seguro",
] as const;

export function MasterAudioSection() {
  const qc = useQueryClient();
  const { data: settings } = useQuery(appSettingsQuery);

  const [newTitle, setNewTitle] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newCategory, setNewCategory] = useState<string>("Investigação Fria");
  const [showAddTrack, setShowAddTrack] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const audioSettings = (settings?.audio_settings ?? {}) as {
    ambience?: AmbienceType;
    ambience_volume?: number;
    track_url?: string;
    track_title?: string;
    track_playing?: boolean;
    track_volume?: number;
  };

  const musicTracks = (settings?.music_tracks ?? []) as MusicTrack[];

  // Mutação para atualizar configurações de áudio globais
  const updateAudioMutation = useMutation({
    mutationFn: async (patch: Partial<typeof audioSettings>) => {
      const current = (settings?.audio_settings ?? {}) as Record<string, unknown>;
      const next = { ...current, ...patch };
      const { error } = await supabase
        .from("app_settings")
        .update({ audio_settings: next })
        .eq("id", 1);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["app_settings"] });
    },
    onError: (err: Error) => toast.error(`Erro ao atualizar áudio: ${err.message}`),
  });

  // Mutação para salvar / excluir trilhas
  const updateTracksMutation = useMutation({
    mutationFn: async (tracks: MusicTrack[]) => {
      const { error } = await supabase
        .from("app_settings")
        .update({ music_tracks: tracks })
        .eq("id", 1);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["app_settings"] });
    },
    onError: (err: Error) => toast.error(`Erro ao atualizar trilhas: ${err.message}`),
  });

  const handleSetAmbience = (type: AmbienceType) => {
    updateAudioMutation.mutate({ ambience: type });
    toast.success(
      type === "none"
        ? "Ambiência desligada para todos."
        : `Ambiência alterada para ${type.toUpperCase()}.`,
    );
  };

  const handleAddTrack = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newUrl.trim()) {
      toast.error("Preencha título e URL da música.");
      return;
    }

    const newTrack: MusicTrack = {
      id: Math.random().toString(36).slice(2),
      title: newTitle.trim(),
      url: newUrl.trim(),
      category: newCategory,
    };

    updateTracksMutation.mutate([...musicTracks, newTrack], {
      onSuccess: () => {
        setNewTitle("");
        setNewUrl("");
        setShowAddTrack(false);
        toast.success("Trilha pré-salva no painel!");
      },
    });
  };

  const handleDeleteTrack = (id: string) => {
    const next = musicTracks.filter((t) => t.id !== id);
    updateTracksMutation.mutate(next, {
      onSuccess: () => toast.success("Trilha removida."),
    });
  };

  const handlePlayTrack = (track: MusicTrack) => {
    updateAudioMutation.mutate({
      track_url: track.url,
      track_title: track.title,
      track_playing: true,
    });
    toast.success(`Tocando "${track.title}" para a mesa toda!`);
  };

  const handleTogglePlay = () => {
    updateAudioMutation.mutate({
      track_playing: !audioSettings.track_playing,
    });
  };

  const filteredTracks =
    categoryFilter === "all"
      ? musicTracks
      : musicTracks.filter((t) => t.category === categoryFilter);

  return (
    <section className="space-y-6 rounded-lg border border-border bg-card p-5 shadow-paint">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <Music className="size-5 text-primary" />
          <h2 className="text-2xl font-bold uppercase">Clima & Áudio da Mesa</h2>
        </div>
        <span className="text-xs text-muted-foreground">
          Sincronizado ao vivo com todos os jogadores
        </span>
      </div>

      {/* 1. AMBIÊNCIAS NATURAIS */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="label-caps text-muted-foreground">Ambiências Naturais em Loop</p>
          <span className="font-mono text-xs text-primary uppercase">
            Ativo: {audioSettings.ambience || "Nenhum"}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <Button
            type="button"
            variant={audioSettings.ambience === "rain" ? "default" : "outline"}
            className="h-10 gap-1.5 text-xs font-semibold"
            onClick={() => handleSetAmbience("rain")}
          >
            <CloudRain className="size-4" /> Chuva Torrencial
          </Button>

          <Button
            type="button"
            variant={audioSettings.ambience === "wind" ? "default" : "outline"}
            className="h-10 gap-1.5 text-xs font-semibold"
            onClick={() => handleSetAmbience("wind")}
          >
            <Wind className="size-4" /> Vento / Fumaça
          </Button>

          <Button
            type="button"
            variant={audioSettings.ambience === "fire" ? "default" : "outline"}
            className="h-10 gap-1.5 text-xs font-semibold"
            onClick={() => handleSetAmbience("fire")}
          >
            <Flame className="size-4" /> Fogo Crepitante
          </Button>

          <Button
            type="button"
            variant={audioSettings.ambience === "electricity" ? "default" : "outline"}
            className="h-10 gap-1.5 text-xs font-semibold"
            onClick={() => handleSetAmbience("electricity")}
          >
            <Zap className="size-4" /> Eletricidade
          </Button>

          <Button
            type="button"
            variant={!audioSettings.ambience || audioSettings.ambience === "none" ? "secondary" : "outline"}
            className="h-10 gap-1.5 text-xs"
            onClick={() => handleSetAmbience("none")}
          >
            <Square className="size-3.5" /> Silêncio
          </Button>
        </div>

        {audioSettings.ambience && audioSettings.ambience !== "none" && (
          <div className="flex items-center gap-3 pt-1">
            <span className="text-xs text-muted-foreground">Volume da Ambiência:</span>
            <Slider
              value={[Math.round((audioSettings.ambience_volume ?? 0.5) * 100)]}
              max={100}
              step={5}
              onValueChange={([val]) =>
                updateAudioMutation.mutate({ ambience_volume: val / 100 })
              }
              className="max-w-xs cursor-pointer"
            />
            <span className="font-mono text-xs text-muted-foreground">
              {Math.round((audioSettings.ambience_volume ?? 0.5) * 100)}%
            </span>
          </div>
        )}
      </div>

      {/* 2. TRILHAS PRÉ-SALVAS E PLAYER DO MESTRE */}
      <div className="space-y-3 border-t border-border/60 pt-4">
        <div className="flex items-center justify-between">
          <p className="label-caps text-muted-foreground">Trilhas Sonoras & Músicas de Cena</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowAddTrack(!showAddTrack)}
            className="h-7 gap-1 text-xs"
          >
            <Plus className="size-3.5" /> Adicionar Trilha
          </Button>
        </div>

        {/* Player ativo */}
        {audioSettings.track_url && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/40 bg-primary/10 p-3 shadow-inner">
            <div className="flex items-center gap-2.5 min-w-0">
              <Button
                type="button"
                variant="paint"
                size="icon"
                className="size-8 shrink-0"
                onClick={handleTogglePlay}
                aria-label={audioSettings.track_playing ? "Pausar música" : "Tocar música"}
              >
                {audioSettings.track_playing ? <Pause className="size-4" /> : <Play className="size-4" />}
              </Button>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-foreground">
                  {audioSettings.track_title || "Trilha Ativa"}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {audioSettings.track_playing ? "Tocando para toda a mesa" : "Pausada"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Volume da Música:</span>
              <Slider
                value={[Math.round((audioSettings.track_volume ?? 0.5) * 100)]}
                max={100}
                step={5}
                onValueChange={([val]) =>
                  updateAudioMutation.mutate({ track_volume: val / 100 })
                }
                className="w-24 sm:w-32 cursor-pointer"
              />
              <span className="font-mono text-xs text-muted-foreground">
                {Math.round((audioSettings.track_volume ?? 0.5) * 100)}%
              </span>
            </div>
          </div>
        )}

        {/* Formulário para cadastrar trilha */}
        {showAddTrack && (
          <form
            onSubmit={handleAddTrack}
            className="space-y-3 rounded-lg border border-border bg-background p-3.5 animate-in fade-in"
          >
            <p className="text-xs font-semibold text-primary uppercase tracking-wide">
              Cadastrar Nova Trilha Sonora
            </p>
            <div className="grid gap-2 sm:grid-cols-3">
              <Input
                placeholder="Título da música (ex: Confronto no Armazém)"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="text-xs"
                required
              />
              <Input
                placeholder="URL do arquivo de áudio (mp3/stream)"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                className="text-xs"
                required
              />
              <Select value={newCategory} onValueChange={setNewCategory}>
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  {DEFAULT_TRACK_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat} className="text-xs">
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowAddTrack(false)}
                className="h-7 text-xs"
              >
                Cancelar
              </Button>
              <Button type="submit" size="sm" className="h-7 text-xs">
                Salvar Trilha
              </Button>
            </div>
          </form>
        )}

        {/* Filtro por categoria */}
        {musicTracks.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1 text-xs">
            <button
              type="button"
              onClick={() => setCategoryFilter("all")}
              className={`rounded-full border px-2.5 py-0.5 text-xs transition ${
                categoryFilter === "all"
                  ? "border-primary bg-primary/10 font-bold text-primary"
                  : "border-border text-muted-foreground hover:bg-muted/40"
              }`}
            >
              Todas ({musicTracks.length})
            </button>
            {DEFAULT_TRACK_CATEGORIES.map((cat) => {
              const count = musicTracks.filter((t) => t.category === cat).length;
              if (count === 0) return null;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategoryFilter(cat)}
                  className={`rounded-full border px-2.5 py-0.5 text-xs transition ${
                    categoryFilter === cat
                      ? "border-primary bg-primary/10 font-bold text-primary"
                      : "border-border text-muted-foreground hover:bg-muted/40"
                  }`}
                >
                  {cat} ({count})
                </button>
              );
            })}
          </div>
        )}

        {/* Lista de trilhas salvas */}
        {musicTracks.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border py-4 text-center text-xs italic text-muted-foreground">
            Nenhuma trilha pré-salva. Adicione links de áudio para tocar para a mesa.
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {filteredTracks.map((track) => {
              const isPlayingThis =
                audioSettings.track_url === track.url && audioSettings.track_playing;
              return (
                <div
                  key={track.id}
                  className={`flex items-center justify-between gap-2 rounded-lg border p-2.5 transition ${
                    isPlayingThis
                      ? "border-primary bg-primary/10 shadow-sm"
                      : "border-border bg-background hover:border-border/80"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold">{track.title}</p>
                    <span className="rounded bg-muted px-1.5 py-0.2 font-mono text-[9px] uppercase text-muted-foreground">
                      {track.category}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant={isPlayingThis ? "default" : "outline"}
                      className="h-7 gap-1 px-2 text-xs"
                      onClick={() =>
                        isPlayingThis ? handleTogglePlay() : handlePlayTrack(track)
                      }
                    >
                      {isPlayingThis ? (
                        <>
                          <Pause className="size-3" /> Pausar
                        </>
                      ) : (
                        <>
                          <Play className="size-3" /> Tocar
                        </>
                      )}
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="size-7 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDeleteTrack(track.id)}
                      aria-label="Excluir trilha"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}


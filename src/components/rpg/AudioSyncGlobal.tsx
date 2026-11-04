import { useEffect, useState, useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { Volume2, VolumeX } from "lucide-react";
import { appSettingsQuery } from "@/lib/rpg-queries";
import {
  setAmbience,
  syncBackgroundMusic,
  getAudioPrefs,
  setMuted,
  setVolume,
  subscribeAudioPrefs,
  type AmbienceType,
} from "@/lib/audio";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export function AudioSyncGlobal() {
  const { data: settings } = useQuery(appSettingsQuery);

  const audioPrefs = useSyncExternalStore(
    subscribeAudioPrefs,
    getAudioPrefs,
    () => ({ muted: false, volume: 0.7 }),
  );

  // Sincroniza ambiente e música ditados pelo mestre
  useEffect(() => {
    if (!settings?.audio_settings) return;
    const audio = settings.audio_settings as {
      ambience?: AmbienceType;
      ambience_volume?: number;
      track_url?: string;
      track_playing?: boolean;
      track_volume?: number;
    };

    setAmbience(audio.ambience ?? "none", audio.ambience_volume ?? 0.5);
    syncBackgroundMusic(
      audio.track_url ?? "",
      Boolean(audio.track_playing),
      audio.track_volume ?? 0.5,
    );
  }, [settings?.audio_settings]);

  return null;
}

export function AudioControlPill() {
  const audioPrefs = useSyncExternalStore(
    subscribeAudioPrefs,
    getAudioPrefs,
    () => ({ muted: false, volume: 0.7 }),
  );

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 text-muted-foreground hover:text-foreground"
          aria-label={audioPrefs.muted ? "Ativar som" : "Silenciar som"}
          title={audioPrefs.muted ? "Som desativado" : `Volume: ${Math.round(audioPrefs.volume * 100)}%`}
        >
          {audioPrefs.muted || audioPrefs.volume === 0 ? (
            <VolumeX className="size-4 text-muted-foreground" />
          ) : (
            <Volume2 className="size-4 text-primary" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-3 shadow-lg">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-display text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Volume do Jogo
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-1.5 text-[10px] uppercase font-semibold text-primary"
              onClick={() => setMuted(!audioPrefs.muted)}
            >
              {audioPrefs.muted ? "Desmutar" : "Mutar"}
            </Button>
          </div>
          <div className="flex items-center gap-2.5">
            <Volume2 className="size-4 shrink-0 text-muted-foreground" />
            <Slider
              value={[audioPrefs.muted ? 0 : Math.round(audioPrefs.volume * 100)]}
              max={100}
              step={5}
              onValueChange={([val]) => {
                if (audioPrefs.muted) setMuted(false);
                setVolume(val / 100);
              }}
              className="flex-1 cursor-pointer"
            />
            <span className="w-7 text-right font-mono text-[11px] text-muted-foreground">
              {audioPrefs.muted ? "0%" : `${Math.round(audioPrefs.volume * 100)}%`}
            </span>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}


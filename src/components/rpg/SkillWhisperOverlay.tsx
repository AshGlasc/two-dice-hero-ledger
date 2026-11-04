import { useEffect, useState, useCallback } from "react";
import { X, Sparkles, Brain, Eye, Zap, Flame, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePlayerCharacterId } from "@/lib/player-character";
import { ALL_SKILLS, type AttributeKey } from "@/lib/skills";
import { SKILL_ICONS } from "@/lib/attribute-theme";
import { Button } from "@/components/ui/button";

export type SkillWhisper = {
  id: string;
  message: string;
  skill_key?: string | null;
  skill_name?: string | null;
  created_at: string;
};

function playWhisperSound() {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    // Tom principal (voz interior mística)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(520, now);
    osc1.frequency.exponentialRampToValueAtTime(760, now + 0.12);
    osc1.frequency.exponentialRampToValueAtTime(460, now + 0.45);

    gain1.gain.setValueAtTime(0.001, now);
    gain1.gain.linearRampToValueAtTime(0.09, now + 0.04);
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);

    // Harmônico etéreo
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "triangle";
    osc2.frequency.setValueAtTime(880, now);
    osc2.frequency.exponentialRampToValueAtTime(1020, now + 0.18);

    gain2.gain.setValueAtTime(0.001, now);
    gain2.gain.linearRampToValueAtTime(0.04, now + 0.06);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.52);
    osc2.stop(now + 0.58);
    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 700);
  } catch {
    // Autoplay bloqueado pelo navegador antes de interação do usuário
  }
}

const ATTRIBUTE_METAS: Record<
  AttributeKey | "default",
  {
    name: string;
    icon: typeof Brain;
    border: string;
    bg: string;
    badge: string;
    accent: string;
    shadow: string;
  }
> = {
  intelecto: {
    name: "Intelecto",
    icon: Brain,
    border: "border-sky-500/70",
    bg: "bg-slate-950/95",
    badge: "border-sky-500/40 bg-sky-500/15 text-sky-300",
    accent: "text-sky-400",
    shadow: "shadow-[0_0_30px_rgba(14,165,233,0.35)]",
  },
  psique: {
    name: "Psique",
    icon: Eye,
    border: "border-purple-500/70",
    bg: "bg-slate-950/95",
    badge: "border-purple-500/40 bg-purple-500/15 text-purple-300",
    accent: "text-purple-400",
    shadow: "shadow-[0_0_30px_rgba(168,85,247,0.35)]",
  },
  fisico: {
    name: "Físico",
    icon: Flame,
    border: "border-rose-500/70",
    bg: "bg-slate-950/95",
    badge: "border-rose-500/40 bg-rose-500/15 text-rose-300",
    accent: "text-rose-400",
    shadow: "shadow-[0_0_30px_rgba(244,63,94,0.35)]",
  },
  motor: {
    name: "Motor",
    icon: Zap,
    border: "border-amber-500/70",
    bg: "bg-slate-950/95",
    badge: "border-amber-500/40 bg-amber-500/15 text-amber-300",
    accent: "text-amber-400",
    shadow: "shadow-[0_0_30px_rgba(245,158,11,0.35)]",
  },
  default: {
    name: "Voz Interior",
    icon: Sparkles,
    border: "border-purple-500/70",
    bg: "bg-slate-950/95",
    badge: "border-purple-500/40 bg-purple-500/15 text-purple-300",
    accent: "text-purple-400",
    shadow: "shadow-[0_0_30px_rgba(168,85,247,0.35)]",
  },
};

export function SkillWhisperOverlay() {
  const primaryCharId = usePlayerCharacterId();
  const [fallbackCharId, setFallbackCharId] = useState<string | null>(null);
  const [whispers, setWhispers] = useState<SkillWhisper[]>([]);
  const [dismissingId, setDismissingId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("eco_caidos_character_id");
      if (stored) setFallbackCharId(stored);
    }
  }, []);

  const activeCharacterId = primaryCharId || fallbackCharId;

  // Escuta novos sussurros inseridos para este personagem
  useEffect(() => {
    if (!activeCharacterId) return;

    const channel = supabase
      .channel(`skill-whisper-overlay-${activeCharacterId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "sanity_whispers",
          filter: `character_id=eq.${activeCharacterId}`,
        },
        (payload) => {
          const row = payload.new as {
            id?: string;
            message?: string;
            skill_key?: string | null;
            skill_name?: string | null;
            created_at?: string;
          };
          if (!row.message || !row.id) return;

          const item: SkillWhisper = {
            id: row.id,
            message: row.message,
            skill_key: row.skill_key ?? null,
            skill_name: row.skill_name ?? null,
            created_at: row.created_at ?? new Date().toISOString(),
          };

          setWhispers((prev) => {
            // Evita duplicatas se o evento disparar mais de uma vez
            if (prev.some((w) => w.id === item.id)) return prev;
            return [item, ...prev];
          });
          playWhisperSound();
        },
      )
      .subscribe((status, error) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.error("Falha ao escutar sussurros de habilidades.", error);
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [activeCharacterId]);

  const dismissCurrent = useCallback(() => {
    const current = whispers[0];
    if (!current) return;
    setDismissingId(current.id);
    setTimeout(() => {
      setWhispers((prev) => prev.filter((w) => w.id !== current.id));
      setDismissingId(null);
    }, 240);
  }, [whispers]);

  const dismissAll = useCallback(() => {
    const current = whispers[0];
    if (!current) return;
    setDismissingId(current.id);
    setTimeout(() => {
      setWhispers([]);
      setDismissingId(null);
    }, 240);
  }, [whispers]);

  const current = whispers[0];
  if (!current) return null;
  const isDismissing = dismissingId === current.id;

  // Resolve skill, atributo e portrait
  const matchedSkill = current.skill_key
    ? ALL_SKILLS.find((s) => s.key === current.skill_key)
    : undefined;

  const attributeKey: AttributeKey | "default" = matchedSkill?.attribute ?? "default";
  const meta = ATTRIBUTE_METAS[attributeKey] ?? ATTRIBUTE_METAS.default;
  const portraitUrl = current.skill_key ? SKILL_ICONS[current.skill_key] : undefined;
  const displayName = current.skill_name || matchedSkill?.name || "Voz Interior";
  const IconComponent = meta.icon;

  return (
    <div
      role="region"
      aria-label="Sussurro de Habilidade"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-end p-4 sm:p-6"
    >
      <div
        className={`pointer-events-auto relative flex w-full max-w-md flex-col overflow-hidden rounded-xl border backdrop-blur-md transition-all duration-300 ease-out ${
          meta.border
        } ${meta.bg} ${meta.shadow} ${
          isDismissing
            ? "translate-y-4 scale-95 opacity-0"
            : "translate-y-0 scale-100 opacity-100 animate-in fade-in slide-in-from-bottom-5"
        }`}
      >
        {/* Faixa decorativa superior com gradiente sutil do atributo */}
        <div className="flex items-center justify-between border-b border-border/40 bg-zinc-900/60 px-3.5 py-2">
          <div className="flex items-center gap-2">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
            </span>
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Sussurro do Inconsciente
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {whispers.length > 1 && (
              <span className="rounded-full bg-zinc-800/80 px-2 py-0.5 font-mono text-[10px] text-zinc-300">
                1 de {whispers.length}
              </span>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="size-6 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
              onClick={dismissCurrent}
              aria-label="Dispensar sussurro"
            >
              <X className="size-3.5" />
            </Button>
          </div>
        </div>

        {/* Corpo principal do pensamento estilo Disco Elysium */}
        <div className="flex gap-3.5 p-4">
          {/* Avatar da skill ou ícone temático */}
          <div className="relative shrink-0">
            {portraitUrl ? (
              <img
                src={portraitUrl}
                alt={displayName}
                className="size-14 rounded-lg border border-border object-cover shadow-inner"
              />
            ) : (
              <div
                className={`flex size-14 items-center justify-center rounded-lg border ${meta.border} bg-zinc-900/80 shadow-inner`}
              >
                <IconComponent className={`size-7 ${meta.accent}`} />
              </div>
            )}
            <div className="absolute -bottom-1 -right-1 rounded-full border border-zinc-900 bg-zinc-950 p-0.5">
              <IconComponent className={`size-3 ${meta.accent}`} />
            </div>
          </div>

          {/* Conteúdo textual */}
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex flex-wrap items-center gap-1.5">
              <span className={`font-display text-base font-bold tracking-wide ${meta.accent}`}>
                {displayName}
              </span>
              <span
                className={`rounded border px-1.5 py-0.2 font-mono text-[10px] uppercase font-semibold ${meta.badge}`}
              >
                {matchedSkill?.attributeName ?? meta.name}
              </span>
            </div>

            {/* Texto do sussurro em itálico e fonte imersiva */}
            <p className="font-serif text-sm italic leading-relaxed text-zinc-200">
              "{current.message}"
            </p>
          </div>
        </div>

        {/* Rodapé interativo */}
        <div className="flex items-center justify-between border-t border-border/30 bg-zinc-900/40 px-3.5 py-2">
          {whispers.length > 1 ? (
            <button
              type="button"
              onClick={dismissAll}
              className="text-xs text-muted-foreground transition hover:text-zinc-200"
            >
              Dispensar todos ({whispers.length})
            </button>
          ) : (
            <span className="text-[11px] text-muted-foreground">Clique para dispensar</span>
          )}

          <Button
            size="sm"
            variant="ghost"
            onClick={dismissCurrent}
            className="h-7 gap-1 px-2.5 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white"
          >
            <span>{whispers.length > 1 ? "Próximo" : "Entendido"}</span>
            <ChevronRight className="size-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}

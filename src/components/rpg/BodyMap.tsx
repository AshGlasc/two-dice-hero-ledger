import { HeartPulse } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useBodyPart } from "@/hooks/use-body-part";
import type { BodyPart } from "@/lib/rpg-queries";
import { BODY_PARTS, BODY_STATES, nextBodyState, type BodyPartKey } from "@/lib/skills";
import { cn } from "@/lib/utils";

// Personagem de frente: o braço direito dele fica à esquerda de quem olha.
const SHAPES: Record<BodyPartKey, React.ReactNode> = {
  cabeca: <ellipse cx="60" cy="24" rx="15" ry="18" />,
  tronco: <path d="M38 48 Q60 42 82 48 L84 120 Q60 128 36 120 Z" />,
  braco_dir: <path d="M34 50 L22 56 L12 118 L22 121 L34 76 Z" />,
  braco_esq: <path d="M86 50 L98 56 L108 118 L98 121 L86 76 Z" />,
  perna_dir: <path d="M38 124 Q48 128 58 128 L56 226 L42 226 Z" />,
  perna_esq: <path d="M62 128 Q72 128 82 124 L78 226 L64 226 Z" />,
};

const FILL = ["fill-muted", "fill-warning", "fill-destructive"];
const DOT = ["bg-muted-foreground/40", "bg-warning", "bg-destructive"];
const TEXT = ["text-muted-foreground", "text-warning", "text-destructive"];

export function stateOf(body: BodyPart[], characterId: string, key: string) {
  return body.find((b) => b.character_id === characterId && b.part_key === key)?.state ?? 0;
}

export function BodyMap({
  characterId,
  body,
  compact = false,
}: {
  characterId: string;
  body: BodyPart[];
  compact?: boolean;
}) {
  const mutation = useBodyPart();
  const cycle = (key: string) =>
    mutation.mutate([
      { characterId, partKey: key, state: nextBodyState(stateOf(body, characterId, key)) },
    ]);
  const healAll = () =>
    mutation.mutate(BODY_PARTS.map((p) => ({ characterId, partKey: p.key, state: 0 })));
  const anyHurt = BODY_PARTS.some((p) => stateOf(body, characterId, p.key) > 0);

  return (
    <div className={cn("flex gap-4", compact ? "items-center" : "flex-col items-center")}>
      <svg
        viewBox="0 0 120 232"
        className={cn("shrink-0", compact ? "h-36 w-auto" : "h-64 w-auto")}
        role="group"
        aria-label="Corpo do personagem"
      >
        {BODY_PARTS.map((p) => {
          const state = stateOf(body, characterId, p.key);
          return (
            <g
              key={p.key}
              role="button"
              tabIndex={0}
              aria-label={`${p.name}: ${BODY_STATES[state]}`}
              onClick={() => cycle(p.key)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  cycle(p.key);
                }
              }}
              className={cn(
                "cursor-pointer stroke-border stroke-[1.5] outline-none transition-colors hover:stroke-foreground focus-visible:stroke-primary",
                FILL[state],
              )}
            >
              <title>{`${p.name}: ${BODY_STATES[state]}`}</title>
              {SHAPES[p.key]}
            </g>
          );
        })}
      </svg>

      <div className={cn("w-full space-y-1", compact && "text-xs")}>
        {BODY_PARTS.map((p) => {
          const state = stateOf(body, characterId, p.key);
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => cycle(p.key)}
              className="flex w-full items-center justify-between gap-2 rounded-sm px-1 py-0.5 text-left hover:bg-muted"
            >
              <span className="flex items-center gap-2">
                <span className={cn("h-2.5 w-2.5 rounded-full", DOT[state])} />
                {p.name}
              </span>
              <span className={cn("label-caps", TEXT[state])}>{BODY_STATES[state]}</span>
            </button>
          );
        })}
        {!compact && (
          <Button
            variant="outline"
            size="sm"
            className="mt-2 w-full"
            disabled={!anyHurt}
            onClick={healAll}
          >
            <HeartPulse /> Curar tudo
          </Button>
        )}
      </div>
    </div>
  );
}

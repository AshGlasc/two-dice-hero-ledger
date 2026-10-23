import { Brush, Eraser, ImagePlus, LogOut, Paintbrush, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Avatar } from "@/components/rpg/AvatarUpload";
import { Stepper } from "@/components/rpg/Stepper";
import { Button } from "@/components/ui/button";
import { useBattleMap } from "@/hooks/use-battle-map";
import { canMoveTo, cellKey, MAP_LIMITS, TERRAINS, type Terrain, type TerrainKey } from "@/lib/combat";
import { fileToSmallImage } from "@/lib/image";
import type { BattleMap as MapRow } from "@/lib/rpg-queries";
import { cn } from "@/lib/utils";

export type MapToken = {
  id: string;
  name: string;
  avatar: string;
  tone: "player" | "monster";
  x: number | null;
  y: number | null;
  hpPct: number | null;
  out: boolean;
  current: boolean;
};

const CELL = 44;

const TERRAIN_CLASS: Record<TerrainKey, string> = {
  wall: "bg-foreground/60",
  cover: "bg-warning/35",
  water: "bg-intellect/45",
  grass: "bg-success/30",
  danger: "bg-destructive/40",
};

export function BattleMap({
  map,
  tokens,
  onMove,
}: {
  map: MapRow;
  tokens: MapToken[];
  onMove: (id: string, x: number | null, y: number | null) => void;
}) {
  const saveMap = useBattleMap();
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [brush, setBrush] = useState<TerrainKey | "erase">("wall");
  const [draft, setDraft] = useState<Terrain | null>(null);
  const painting = useRef(false);
  const grid = useRef<HTMLDivElement>(null);
  const file = useRef<HTMLInputElement>(null);

  const terrain = draft ?? ((map.terrain ?? {}) as Terrain);
  const placed = tokens.filter((t) => t.x !== null && t.y !== null && t.x < map.cols && t.y! < map.rows);
  const tray = tokens.filter((t) => !placed.includes(t));
  const occupied = useMemo(() => new Set(placed.map((t) => cellKey(t.x!, t.y!))), [placed]);
  const sel = tokens.find((t) => t.id === selected) ?? null;

  const cellAt = (e: React.PointerEvent) => {
    const r = grid.current!.getBoundingClientRect();
    return { x: Math.floor((e.clientX - r.left) / CELL), y: Math.floor((e.clientY - r.top) / CELL) };
  };

  const paint = (e: React.PointerEvent) => {
    const { x, y } = cellAt(e);
    if (x < 0 || y < 0 || x >= map.cols || y >= map.rows) return;
    setDraft((d) => {
      const next = { ...(d ?? terrain) };
      if (brush === "erase") delete next[cellKey(x, y)];
      else next[cellKey(x, y)] = brush;
      return next;
    });
  };

  const commit = () => {
    if (!painting.current) return;
    painting.current = false;
    if (draft) saveMap.mutate({ terrain: draft }, { onSettled: () => setDraft(null) });
  };

  const onGridDown = (e: React.PointerEvent) => {
    if (editing) {
      painting.current = true;
      (e.target as Element).setPointerCapture?.(e.pointerId);
      paint(e);
      return;
    }
    if (!sel) return;
    const { x, y } = cellAt(e);
    if (sel.x === x && sel.y === y) return;
    const others = new Set(occupied);
    if (sel.x !== null && sel.y !== null) others.delete(cellKey(sel.x, sel.y));
    if (!canMoveTo(x, y, map.cols, map.rows, terrain, others)) {
      toast("Não dá para ir aí.");
      return;
    }
    onMove(sel.id, x, y);
  };

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="label-caps text-primary">Mapa de batalha</p>
          <p className="text-sm text-muted-foreground">
            {editing
              ? "Escolha um pincel e pinte as casas."
              : sel
                ? `Toque numa casa para mover ${sel.name}.`
                : "Toque num rosto e depois numa casa para andar."}
          </p>
        </div>
        <Button variant={editing ? "paint" : "outline"} size="sm" onClick={() => setEditing((v) => !v)}>
          <Paintbrush /> {editing ? "Pronto" : "Editar mapa"}
        </Button>
      </div>

      {editing && (
        <div className="space-y-3 rounded-lg border border-border bg-card p-3">
          <div className="flex flex-wrap gap-1.5">
            {TERRAINS.map((t) => (
              <Button
                key={t.key}
                size="sm"
                variant={brush === t.key ? "secondary" : "ghost"}
                onClick={() => setBrush(t.key)}
                className={cn(brush === t.key && "ring-2 ring-primary")}
              >
                <span className={cn("size-4 rounded-sm border border-border", TERRAIN_CLASS[t.key])} />
                {t.name}
              </Button>
            ))}
            <Button
              size="sm"
              variant={brush === "erase" ? "secondary" : "ghost"}
              onClick={() => setBrush("erase")}
              className={cn(brush === "erase" && "ring-2 ring-primary")}
            >
              <Eraser /> Borracha
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <label className="flex items-center gap-2">
              <span className="label-caps text-muted-foreground">Largura</span>
              <Stepper
                label="colunas"
                value={map.cols}
                min={MAP_LIMITS.min}
                max={MAP_LIMITS.max}
                onChange={(v) => saveMap.mutate({ cols: v })}
              />
            </label>
            <label className="flex items-center gap-2">
              <span className="label-caps text-muted-foreground">Altura</span>
              <Stepper
                label="linhas"
                value={map.rows}
                min={MAP_LIMITS.min}
                max={MAP_LIMITS.max}
                onChange={(v) => saveMap.mutate({ rows: v })}
              />
            </label>
            <Button size="sm" variant="outline" onClick={() => file.current?.click()}>
              <ImagePlus /> Imagem de fundo
            </Button>
            {map.background_url && (
              <Button size="sm" variant="ghost" onClick={() => saveMap.mutate({ background_url: "" })}>
                <X /> Tirar fundo
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => confirm("Limpar todo o terreno?") && saveMap.mutate({ terrain: {} })}
            >
              <Brush /> Limpar terreno
            </Button>
            <input
              ref={file}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f) return;
                try {
                  saveMap.mutate({ background_url: await fileToSmallImage(f, 1280, 0.7) });
                } catch {
                  toast.error("Não consegui abrir essa imagem.");
                }
              }}
            />
          </div>
        </div>
      )}

      <div className="overflow-auto rounded-lg border border-border bg-muted/40 shadow-paint">
        <div
          ref={grid}
          role="grid"
          aria-label="Mapa de batalha"
          onPointerDown={onGridDown}
          onPointerMove={(e) => editing && painting.current && paint(e)}
          onPointerUp={commit}
          onPointerCancel={commit}
          className={cn("relative select-none", editing ? "cursor-crosshair touch-none" : sel && "cursor-pointer")}
          style={{
            width: map.cols * CELL,
            height: map.rows * CELL,
            backgroundImage: map.background_url ? `url(${map.background_url})` : undefined,
            backgroundSize: "100% 100%",
          }}
        >
          <div
            className="absolute inset-0 grid"
            style={{ gridTemplateColumns: `repeat(${map.cols}, ${CELL}px)`, gridTemplateRows: `repeat(${map.rows}, ${CELL}px)` }}
          >
            {Array.from({ length: map.cols * map.rows }).map((_, i) => {
              const k = cellKey(i % map.cols, Math.floor(i / map.cols));
              const t = terrain[k];
              return <div key={k} className={cn("border border-border/40", t && TERRAIN_CLASS[t])} />;
            })}
          </div>

          {placed.map((t) => (
            <button
              key={t.id}
              type="button"
              onPointerDown={(e) => {
                if (editing) return;
                e.stopPropagation();
                setSelected((s) => (s === t.id ? null : t.id));
              }}
              aria-label={`${t.name}${t.current ? " (vez dele)" : ""}`}
              title={t.name}
              className={cn(
                "absolute left-0 top-0 grid place-items-center transition-transform duration-300 ease-out",
                editing && "pointer-events-none",
              )}
              style={{ width: CELL, height: CELL, transform: `translate(${t.x! * CELL}px, ${t.y! * CELL}px)` }}
            >
              <span className="relative">
                {t.current && <span className="absolute -inset-1.5 animate-ping rounded-full bg-primary/50" />}
                <Avatar
                  src={t.avatar}
                  name={t.name}
                  tone={t.tone}
                  className={cn(
                    "relative size-9 text-xs shadow-paint",
                    t.out && "opacity-50 grayscale",
                    t.current && "ring-2 ring-primary ring-offset-2 ring-offset-background",
                    selected === t.id && "ring-4 ring-foreground",
                  )}
                />
                {t.hpPct !== null && (
                  <span className="absolute -bottom-1 left-0 h-1 w-full overflow-hidden rounded-full bg-background">
                    <span
                      className={cn("block h-full", t.hpPct > 0.5 ? "bg-success" : t.hpPct > 0.25 ? "bg-warning" : "bg-destructive")}
                      style={{ width: `${Math.max(0, t.hpPct) * 100}%` }}
                    />
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>
      </div>

      {(tray.length > 0 || sel) && !editing && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-border p-2">
          {tray.length > 0 && <span className="label-caps px-1 text-muted-foreground">Fora do mapa:</span>}
          {tray.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSelected((s) => (s === t.id ? null : t.id))}
              className={cn("flex items-center gap-1.5 rounded-full border border-border py-0.5 pl-0.5 pr-3 text-sm", selected === t.id && "ring-2 ring-foreground")}
            >
              <Avatar src={t.avatar} name={t.name} tone={t.tone} className="size-7 text-[10px]" />
              {t.name}
            </button>
          ))}
          {sel && sel.x !== null && (
            <Button size="sm" variant="ghost" className="ml-auto" onClick={() => { onMove(sel.id, null, null); setSelected(null); }}>
              <LogOut /> Tirar {sel.name} do mapa
            </Button>
          )}
        </div>
      )}
    </section>
  );
}

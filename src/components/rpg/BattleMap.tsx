import {
  Brush,
  CloudFog,
  Eraser,
  Eye,
  Image as ImageIcon,
  ImagePlus,
  Lock,
  LogOut,
  Paintbrush,
  Ruler,
  X,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Avatar } from "@/components/rpg/AvatarUpload";
import { MasterUnlockModal } from "@/components/rpg/MasterUnlockModal";
import { Stepper } from "@/components/rpg/Stepper";
import { Button } from "@/components/ui/button";
import { useMasterAuth } from "@/context/MasterAuthContext";
import { useBattleMap } from "@/hooks/use-battle-map";
import {
  canMoveTo,
  cellKey,
  conditionEmoji,
  fillFog,
  gridDistance,
  MAP_LIMITS,
  MOVEMENT_RANGE,
  TERRAINS,
  tokenVisible,
  type Fog,
  type Terrain,
  type TerrainKey,
  type TileImages,
} from "@/lib/combat";
import { fileToSmallImage } from "@/lib/image";
import { usePlayerCharacterId } from "@/lib/player-character";
import { MapLayouts } from "@/components/rpg/MapLayouts";
import type { BattleMap as MapRow } from "@/lib/rpg-queries";
import { cn } from "@/lib/utils";

export type MapToken = {
  id: string;
  /** ID do combatant (para restrição de turno) */
  characterId?: string | null;
  name: string;
  avatar: string;
  tone: "player" | "monster";
  x: number | null;
  y: number | null;
  hpPct: number | null;
  out: boolean;
  current: boolean;
  conditions?: string[];
  /** Casas por turno (= Motor). */
  moveRange?: number;
  /** Já andou neste turno. */
  moved?: boolean;
};

type BrushKey = TerrainKey | "erase" | "image" | "fog" | "reveal";
type Draft = { terrain: Terrain; tile_images: TileImages; fog: Fog };

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
  currentCombatantId,
  combatActive,
}: {
  map: MapRow;
  tokens: MapToken[];
  onMove: (id: string, x: number | null, y: number | null) => void;
  currentCombatantId?: string | null;
  combatActive?: boolean;
}) {
  const saveMap = useBattleMap();
  const { isMaster } = useMasterAuth();
  const myCharacterId = usePlayerCharacterId();
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [viewAsPlayers, setViewAsPlayers] = useState(false);
  const [previewCharacterId, setPreviewCharacterId] = useState("");
  const [measuring, setMeasuring] = useState(false);
  const [hoverCell, setHoverCell] = useState<{ x: number; y: number } | null>(null);
  const [brush, setBrush] = useState<BrushKey>("wall");
  const [stamp, setStamp] = useState<string>("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const stampFile = useRef<HTMLInputElement>(null);
  const painting = useRef(false);
  const grid = useRef<HTMLDivElement>(null);
  const file = useRef<HTMLInputElement>(null);

  const saved: Draft = useMemo(
    () => ({
      terrain: (map.terrain ?? {}) as Terrain,
      tile_images: (map.tile_images ?? {}) as TileImages,
      fog: (map.fog ?? {}) as Fog,
    }),
    [map.terrain, map.tile_images, map.fog],
  );
  const cur = draft ?? saved;
  const { terrain, tile_images: images, fog } = cur;
  const viewerIsMaster = isMaster && !viewAsPlayers;
  const viewerCharacterId = viewAsPlayers ? previewCharacterId : myCharacterId;
  const inside = tokens.filter(
    (t) => t.x !== null && t.y !== null && t.x < map.cols && t.y! < map.rows,
  );
  const placed = inside.filter((t) =>
    tokenVisible(
      fog,
      t.x!,
      t.y!,
      viewerIsMaster,
      t.characterId === viewerCharacterId && !!viewerCharacterId,
    ),
  );
  const tray = tokens.filter((t) => !inside.includes(t));
  const occupied = new Set(inside.map((t) => cellKey(t.x!, t.y!)));
  const sel = tokens.find((t) => t.id === selected) ?? null;
  const selRange = sel?.moveRange ?? MOVEMENT_RANGE;

  const cellAt = (e: React.PointerEvent) => {
    const r = grid.current!.getBoundingClientRect();
    return {
      x: Math.floor((e.clientX - r.left) / CELL),
      y: Math.floor((e.clientY - r.top) / CELL),
    };
  };

  const lastPainted = useRef<string | null>(null);
  const paint = (e: React.PointerEvent) => {
    const { x, y } = cellAt(e);
    if (x < 0 || y < 0 || x >= map.cols || y >= map.rows) return;
    const k = cellKey(x, y);
    if (lastPainted.current === k) return;
    lastPainted.current = k;
    setDraft((d) => {
      const base = d ?? saved;
      const next: Draft = {
        terrain: { ...base.terrain },
        tile_images: { ...base.tile_images },
        fog: { ...base.fog },
      };
      if (brush === "erase") {
        delete next.terrain[k];
        delete next.tile_images[k];
      } else if (brush === "image") {
        if (stamp) next.tile_images[k] = stamp;
      } else if (brush === "fog") next.fog[k] = true;
      else if (brush === "reveal") delete next.fog[k];
      else next.terrain[k] = brush;
      return next;
    });
  };

  const commit = () => {
    if (!painting.current) return;
    painting.current = false;
    lastPainted.current = null;
    if (draft) saveMap.mutate(draft, { onSettled: () => setDraft(null) });
  };

  /**
   * Verifica se o jogador (ou mestre) pode mover o token `t`.
   * Regras:
   *  – Mestre: pode mover qualquer um.
   *  – Jogador: só pode mover SEU token de personagem.
   *  – Em combate ativo: só pode mover quando for o turno do SEU combatant.
   */
  const canSelectToken = (t: MapToken) => {
    if (viewAsPlayers) return false;
    if (isMaster) return true;
    if (t.tone === "monster") return false;
    if (!myCharacterId || t.characterId !== myCharacterId) return false;
    if (combatActive && currentCombatantId !== t.id) return false;
    return true;
  };

  const onGridDown = (e: React.PointerEvent) => {
    if (editing) {
      if (brush === "image" && !stamp) {
        toast("Escolha uma imagem primeiro.");
        return;
      }
      painting.current = true;
      (e.target as Element).setPointerCapture?.(e.pointerId);
      paint(e);
      return;
    }
    if (!sel) return;
    const { x, y } = cellAt(e);
    if (sel.x === x && sel.y === y) return;
    const limited = combatActive && !isMaster;
    if (limited && sel.moved) {
      toast.error("Você já andou neste turno.");
      setSelected(null);
      return;
    }
    if (limited && sel.x !== null && sel.y !== null && gridDistance(sel.x, sel.y, x, y) > selRange) {
      toast.error(`Você anda até ${selRange} casas por turno (seu Motor).`);
      return;
    }
    const others = new Set(occupied);
    if (sel.x !== null && sel.y !== null) others.delete(cellKey(sel.x, sel.y));
    if (!canMoveTo(x, y, map.cols, map.rows, terrain, others)) {
      toast("Não dá para ir aí.");
      return;
    }
    onMove(sel.id, x, y);
    if (!measuring) setSelected(null);
  };

  // Casas do mapa só re-renderizam quando terreno/névoa/imagens mudam (não a cada toque/hover).
  const cells = useMemo(
    () =>
      Array.from({ length: map.cols * map.rows }).map((_, i) => {
              const k = cellKey(i % map.cols, Math.floor(i / map.cols));
              const t = terrain[k];
              const img = images[k];
              const fogged = Boolean(fog[k]);
              if (fogged && !viewerIsMaster) {
                return (
                  <div
                    key={k}
                    className="fog-cell border border-background"
                    aria-label="Casa escondida"
                  />
                );
              }
              return (
                <div
                  key={k}
                  className={cn("relative border border-border/40", t && TERRAIN_CLASS[t])}
                >
                  {img && (
                    <img
                      src={img}
                      alt=""
                      draggable={false}
                      className="absolute inset-0 size-full object-cover"
                    />
                  )}
                  {fogged && (
                    <div
                      className="fog-cell absolute inset-0 opacity-60"
                      title="Escondida dos jogadores"
                    />
                  )}
                </div>
              );
            }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [map.cols, map.rows, terrain, images, fog, viewerIsMaster],
  );

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="label-caps text-primary">Mapa de batalha</p>
          <p className="text-sm text-muted-foreground">
            {editing
              ? brush === "fog"
                ? "Pinte as casas que os jogadores não podem ver."
                : brush === "reveal"
                  ? "Pinte para revelar as casas escondidas."
                  : brush === "image"
                    ? "Toque nas casas para colocar a imagem."
                    : "Escolha um pincel e pinte as casas."
              : measuring && sel
                ? `Medição: ${hoverCell ? gridDistance(sel.x ?? 0, sel.y ?? 0, hoverCell.x, hoverCell.y) : "—"} quadrados (alcance ${selRange}).`
                : sel
                  ? `Toque numa casa para mover ${sel.name} (até ${selRange} casas${combatActive ? ", 1 vez por turno" : ""}).`
                  : combatActive && !isMaster && currentCombatantId
                    ? (() => {
                        const myToken = tokens.find((t) => t.characterId === myCharacterId);
                        if (myToken && myToken.id === currentCombatantId)
                          return "É sua vez! Toque no seu token e depois numa casa.";
                        const currentToken = tokens.find((t) => t.id === currentCombatantId);
                        return `Vez de ${currentToken?.name ?? "outro combatente"}. Aguarde seu turno.`;
                      })()
                    : "Toque num rosto e depois numa casa para andar."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={measuring ? "secondary" : "outline"}
            size="sm"
            disabled={editing}
            onClick={() => {
              setMeasuring((value) => !value);
              setHoverCell(null);
            }}
          >
            <Ruler /> {measuring ? "Fechar régua" : "Medir movimento"}
          </Button>
          {isMaster && (
            <Button
              variant={viewAsPlayers ? "secondary" : "outline"}
              size="sm"
              onClick={() => {
                setViewAsPlayers((value) => !value);
                setEditing(false);
                setSelected(null);
              }}
            >
              <Eye /> {viewAsPlayers ? "Voltar à visão do Mestre" : "Visão dos jogadores"}
            </Button>
          )}
          {viewAsPlayers && (
            <select
              className="h-9 rounded-md border border-border bg-card px-2 text-sm"
              value={previewCharacterId}
              onChange={(event) => setPreviewCharacterId(event.target.value)}
              aria-label="Personagem da prévia"
            >
              <option value="">Sem personagem selecionado</option>
              {tokens
                .filter((token) => token.characterId)
                .map((token) => (
                  <option key={token.characterId} value={token.characterId!}>
                    {token.name}
                  </option>
                ))}
            </select>
          )}
          {isMaster ? (
            <Button
              variant={editing ? "paint" : "outline"}
              size="sm"
              disabled={viewAsPlayers}
              onClick={() => setEditing((v) => !v)}
            >
              <Paintbrush /> {editing ? "Pronto" : "Editar mapa"}
            </Button>
          ) : (
            <MasterUnlockModal
              trigger={
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 opacity-80"
                  title="Apenas o mestre pode alterar o terreno"
                >
                  <Lock className="size-3.5 text-muted-foreground" /> Editar mapa (Mestre)
                </Button>
              }
            />
          )}
        </div>
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
                <span
                  className={cn("size-4 rounded-sm border border-border", TERRAIN_CLASS[t.key])}
                />
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
          <div className="flex flex-wrap items-center gap-1.5 border-t border-border pt-3">
            <Button
              size="sm"
              variant={brush === "image" ? "secondary" : "ghost"}
              onClick={() => (stamp ? setBrush("image") : stampFile.current?.click())}
              className={cn(brush === "image" && "ring-2 ring-primary")}
            >
              {stamp ? (
                <img src={stamp} alt="" className="size-5 rounded-sm object-cover" />
              ) : (
                <ImageIcon />
              )}
              Imagem na casa
            </Button>
            {stamp && (
              <Button size="sm" variant="ghost" onClick={() => stampFile.current?.click()}>
                Trocar imagem
              </Button>
            )}
            <input
              ref={stampFile}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f) return;
                try {
                  setStamp(await fileToSmallImage(f, 128, 0.7));
                  setBrush("image");
                } catch {
                  toast.error("Não consegui abrir essa imagem.");
                }
              }}
            />
            <span className="mx-1 h-5 w-px bg-border" />
            <Button
              size="sm"
              variant={brush === "fog" ? "secondary" : "ghost"}
              onClick={() => setBrush("fog")}
              className={cn(brush === "fog" && "ring-2 ring-primary")}
            >
              <CloudFog /> Névoa
            </Button>
            <Button
              size="sm"
              variant={brush === "reveal" ? "secondary" : "ghost"}
              onClick={() => setBrush("reveal")}
              className={cn(brush === "reveal" && "ring-2 ring-primary")}
            >
              <Eye /> Revelar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => saveMap.mutate({ fog: fillFog(map.cols, map.rows) })}
            >
              Cobrir tudo
            </Button>
            <Button size="sm" variant="ghost" onClick={() => saveMap.mutate({ fog: {} })}>
              Revelar tudo
            </Button>
          </div>
          <MapLayouts map={map} />
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
              <Button
                size="sm"
                variant="ghost"
                onClick={() => saveMap.mutate({ background_url: "" })}
              >
                <X /> Tirar fundo
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                confirm("Limpar todo o terreno e as imagens das casas?") &&
                saveMap.mutate({ terrain: {}, tile_images: {} })
              }
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
          onPointerMove={(e) => {
            if (editing && painting.current) paint(e);
            else if (!editing && measuring) {
              const c = cellAt(e);
              setHoverCell((h) => (h && h.x === c.x && h.y === c.y ? h : c));
            }
          }}
          onPointerLeave={() => setHoverCell(null)}
          onPointerUp={commit}
          onPointerCancel={commit}
          className={cn(
            "relative select-none",
            editing ? "cursor-crosshair touch-none" : sel && "cursor-pointer",
          )}
          style={{
            width: map.cols * CELL,
            height: map.rows * CELL,
            backgroundImage: map.background_url ? `url(${map.background_url})` : undefined,
            backgroundSize: "100% 100%",
          }}
        >
          <div
            className="absolute inset-0 grid"
            style={{
              gridTemplateColumns: `repeat(${map.cols}, ${CELL}px)`,
              gridTemplateRows: `repeat(${map.rows}, ${CELL}px)`,
            }}
          >
            {cells}
          </div>

          {placed.map((t) => (
            <button
              key={t.id}
              type="button"
              onPointerDown={(e) => {
                if (editing) return;
                e.stopPropagation();
                if (!canSelectToken(t)) {
                  if (
                    combatActive &&
                    currentCombatantId &&
                    currentCombatantId !== t.id &&
                    t.characterId === myCharacterId
                  ) {
                    toast("Aguarde sua vez para mover.");
                  }
                  return;
                }
                setSelected((s) => (s === t.id ? null : t.id));
              }}
              aria-label={`${t.name}${t.current ? " (vez dele)" : ""}`}
              title={t.name}
              className={cn(
                "absolute left-0 top-0 grid place-items-center transition-transform duration-300 ease-out",
                editing && "pointer-events-none",
              )}
              style={{
                width: CELL,
                height: CELL,
                transform: `translate(${t.x! * CELL}px, ${t.y! * CELL}px)`,
              }}
            >
              <span className="relative">
                {t.current && (
                  <span className="absolute -inset-1.5 animate-ping rounded-full bg-primary/50" />
                )}
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
                {t.conditions && t.conditions.length > 0 && (
                  <span className="absolute -right-2 -top-2 flex max-w-14 flex-wrap justify-end gap-px text-[11px] leading-none drop-shadow">
                    {t.conditions.slice(0, 3).map((c) => (
                      <span key={c} title={c} className="rounded-full bg-background/90 p-px">
                        {conditionEmoji(c)}
                      </span>
                    ))}
                  </span>
                )}
                {t.hpPct !== null && (
                  <span className="absolute -bottom-1 left-0 h-1 w-full overflow-hidden rounded-full bg-background">
                    <span
                      className={cn(
                        "block h-full",
                        t.hpPct > 0.5
                          ? "bg-success"
                          : t.hpPct > 0.25
                            ? "bg-warning"
                            : "bg-destructive",
                      )}
                      style={{ width: `${Math.max(0, t.hpPct) * 100}%` }}
                    />
                  </span>
                )}
              </span>
            </button>
          ))}
          {measuring && sel && hoverCell && sel.x !== null && sel.y !== null && (
            <svg
              className="pointer-events-none absolute inset-0"
              width={map.cols * CELL}
              height={map.rows * CELL}
            >
              <line
                x1={(sel.x + 0.5) * CELL}
                y1={(sel.y + 0.5) * CELL}
                x2={(hoverCell.x + 0.5) * CELL}
                y2={(hoverCell.y + 0.5) * CELL}
                stroke={
                  gridDistance(sel.x, sel.y, hoverCell.x, hoverCell.y) > selRange
                    ? "#ef4444"
                    : "#facc15"
                }
                strokeWidth="3"
                strokeDasharray="6 4"
              />
            </svg>
          )}
        </div>
      </div>

      {(tray.length > 0 || sel) && !editing && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-border p-2">
          {tray.length > 0 && (
            <span className="label-caps px-1 text-muted-foreground">Fora do mapa:</span>
          )}
          {tray.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                if (!canSelectToken(t)) {
                  if (
                    combatActive &&
                    currentCombatantId &&
                    currentCombatantId !== t.id &&
                    t.characterId === myCharacterId
                  ) {
                    toast("Aguarde sua vez para mover.");
                  }
                  return;
                }
                setSelected((s) => (s === t.id ? null : t.id));
              }}
              className={cn(
                "flex items-center gap-1.5 rounded-full border border-border py-0.5 pl-0.5 pr-3 text-sm",
                selected === t.id && "ring-2 ring-foreground",
              )}
            >
              <Avatar src={t.avatar} name={t.name} tone={t.tone} className="size-7 text-[10px]" />
              {t.name}
            </button>
          ))}
          {sel && sel.x !== null && (
            <Button
              size="sm"
              variant="ghost"
              className="ml-auto"
              onClick={() => {
                onMove(sel.id, null, null);
                setSelected(null);
              }}
            >
              <LogOut /> Tirar {sel.name} do mapa
            </Button>
          )}
        </div>
      )}
    </section>
  );
}

import {
  Brush,
  CloudFog,
  Eraser,
  Eye,
  Image as ImageIcon,
  ImagePlus,
  Lock,
  LogOut,
  Move,
  Paintbrush,
  Pencil,
  Ruler,
  StickyNote,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

import { Avatar } from "@/components/rpg/AvatarUpload";
import { MasterUnlockModal } from "@/components/rpg/MasterUnlockModal";
import { Stepper } from "@/components/rpg/Stepper";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
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
import type { BattleMap as MapRow, BattleMapItem } from "@/lib/rpg-queries";
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
  /** Já andou nesta rodada (`moved_round` = rodada atual). */
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
  items = [],
  onPickItem,
  onPushItem,
  onOpenChest,
  placement = null,
}: {
  onOpenChest?: (itemId: string, tokenId: string | null) => void;
  map: MapRow;
  tokens: MapToken[];
  onMove: (id: string, x: number | null, y: number | null) => void;
  currentCombatantId?: string | null;
  combatActive?: boolean;
  items?: BattleMapItem[];
  onPickItem?: (itemId: string, tokenId: string) => void;
  onPushItem?: (itemId: string, tokenId: string) => void;
  /** Modo "clique numa casa para colocar" (personagem, monstro ou item). */
  placement?: { label: string; onPlace: (x: number, y: number) => void; onCancel: () => void } | null;
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
  // Giz e Post-its
  const [chalkTool, setChalkTool] = useState<"none" | "white" | "red" | "eraser">("none");
  const chalkCanvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingChalk = useRef(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  const [postItModal, setPostItModal] = useState<{ key: string; text: string } | null>(null);
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
  const inside = useMemo(
    () => tokens.filter((t) => t.x !== null && t.y !== null && t.x < map.cols && t.y! < map.rows),
    [tokens, map.cols, map.rows],
  );
  const placed = useMemo(
    () =>
      inside.filter((t) =>
        tokenVisible(
          fog,
          t.x!,
          t.y!,
          viewerIsMaster,
          t.characterId === viewerCharacterId && !!viewerCharacterId,
        ),
      ),
    [inside, fog, viewerIsMaster, viewerCharacterId],
  );
  const tray = useMemo(() => tokens.filter((t) => !inside.includes(t)), [tokens, inside]);
  const occupied = useMemo(() => {
    const cells = new Set(inside.filter((token) => !token.out).map((t) => cellKey(t.x!, t.y!)));
    for (const item of items) cells.add(cellKey(item.x, item.y));
    return cells;
  }, [inside, items]);
  const sel = tokens.find((t) => t.id === selected) ?? null;
  const selRange = sel?.moveRange ?? MOVEMENT_RANGE;
  const itemDistances = useMemo(() => {
    if (sel?.x == null || sel.y == null) return new Map<string, number>();
    return new Map(items.map((item) => [item.id, gridDistance(sel.x!, sel.y!, item.x, item.y)]));
  }, [items, sel?.x, sel?.y]);

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
    if (placement) {
      const { x, y } = cellAt(e);
      if (!canMoveTo(x, y, map.cols, map.rows, terrain, occupied)) {
        toast.error("Essa casa está bloqueada ou ocupada. Escolha outra.");
        return;
      }
      placement.onPlace(x, y);
      return;
    }
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
    // Em combate cada um anda 1 vez por rodada, até `moveRange` casas (Motor). Jogador não passa
    // disso; o mestre pode abrir exceção (reposicionar, efeito de cena) depois de confirmar.
    if (combatActive && sel.moved) {
      if (!isMaster) {
        toast.error("Você já andou nesta rodada. Espere a próxima.");
        setSelected(null);
        return;
      }
      if (!confirm(`${sel.name} já andou nesta rodada. Mover mesmo assim?`)) return;
    }
    if (combatActive && sel.x !== null && sel.y !== null) {
      const steps = gridDistance(sel.x, sel.y, x, y);
      if (steps > selRange) {
        if (!isMaster) {
          toast.error(`Você anda até ${selRange} casas por rodada (seu Motor).`);
          return;
        }
        if (!confirm(`${sel.name} anda até ${selRange} casas. Mover ${steps} casas mesmo assim?`)) {
          return;
        }
      }
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

  const gmTileNotes = useMemo(() => {
    return (map.gm_tile_notes ?? {}) as Record<string, string>;
  }, [map.gm_tile_notes]);

  useEffect(() => {
    const channel = supabase
      .channel("battle-map-chalk")
      .on("broadcast", { event: "CHALK_DRAW" }, (payload) => {
        const { dataUrl } = payload.payload as { dataUrl: string };
        const canvas = chalkCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const img = new Image();
        img.onload = () => {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);
        };
        img.src = dataUrl;
      })
      .on("broadcast", { event: "CHALK_CLEAR" }, () => {
        const canvas = chalkCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        ctx?.clearRect(0, 0, canvas.width, canvas.height);
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  const handleChalkDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (chalkTool === "none") return;
    const canvas = chalkCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    isDrawingChalk.current = true;
    lastPoint.current = { x, y };
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.beginPath();
    ctx.arc(x, y, chalkTool === "eraser" ? 10 : 2, 0, Math.PI * 2);
    ctx.fillStyle = chalkTool === "red" ? "#ef4444" : chalkTool === "white" ? "#ffffff" : "rgba(0,0,0,1)";
    if (chalkTool === "eraser") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.fill();
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.fill();
    }
  };

  const handleChalkMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingChalk.current || chalkTool === "none") return;
    const canvas = chalkCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const ctx = canvas.getContext("2d");
    if (!ctx || !lastPoint.current) return;

    ctx.beginPath();
    ctx.moveTo(lastPoint.current.x, lastPoint.current.y);
    ctx.lineTo(x, y);
    if (chalkTool === "eraser") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.lineWidth = 20;
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = chalkTool === "red" ? "#ef4444" : "#ffffff";
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
    }
    ctx.stroke();
    lastPoint.current = { x, y };
  };

  const handleChalkUp = () => {
    if (!isDrawingChalk.current) return;
    isDrawingChalk.current = false;
    lastPoint.current = null;
    const canvas = chalkCanvasRef.current;
    if (!canvas) return;
    const channel = supabase.channel("battle-map-chalk");
    void channel.send({
      type: "broadcast",
      event: "CHALK_DRAW",
      payload: { dataUrl: canvas.toDataURL() },
    });
  };

  const clearChalk = () => {
    const canvas = chalkCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
    const channel = supabase.channel("battle-map-chalk");
    void channel.send({
      type: "broadcast",
      event: "CHALK_CLEAR",
      payload: {},
    });
    toast.success("Desenhos de giz limpos!");
  };

  const savePostItNote = (key: string, text: string) => {
    const next = { ...gmTileNotes };
    if (text.trim()) {
      next[key] = text.trim();
    } else {
      delete next[key];
    }
    saveMap.mutate({ gm_tile_notes: next });
    toast.success("Post-it atualizado!");
    setPostItModal(null);
  };

  // Casas do mapa só re-renderizam quando terreno/névoa/imagens mudam (não a cada toque/hover).
  const cells = useMemo(
    () =>
      Array.from({ length: map.cols * map.rows }).map((_, i) => {
        const k = cellKey(i % map.cols, Math.floor(i / map.cols));
        const t = terrain[k];
        const img = images[k];
        const fogged = Boolean(fog[k]);
        const note = gmTileNotes[k];
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
            onContextMenu={(e) => {
              if (viewerIsMaster) {
                e.preventDefault();
                e.stopPropagation();
                setPostItModal({ key: k, text: note || "" });
              }
            }}
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
            {viewerIsMaster && note && (
              <button
                type="button"
                title={`Post-it Secreto: ${note}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setPostItModal({ key: k, text: note });
                }}
                className="absolute right-0.5 top-0.5 z-20 flex size-4 items-center justify-center rounded-sm bg-amber-400 text-[10px] font-bold text-zinc-950 shadow hover:scale-125 transition-transform"
              >
                📌
              </button>
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
    [map.cols, map.rows, terrain, images, fog, viewerIsMaster, gmTileNotes],
  );

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="label-caps text-primary">Mapa de batalha</p>
          <p className={cn("text-sm", placement ? "font-semibold text-primary" : "text-muted-foreground")}>
            {placement
              ? `Clique numa casa livre do mapa para colocar ${placement.label}.`
              : editing
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
                  ? sel.moved && combatActive
                    ? `${sel.name} já andou nesta rodada.`
                    : `Toque numa casa para mover ${sel.name} (até ${selRange} casas${combatActive ? ", 1 vez por rodada" : ""}).`
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
          {placement && (
            <Button variant="destructive" size="sm" onClick={placement.onCancel}>
              <X /> Cancelar
            </Button>
          )}
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

          {/* Barra de Giz / Desenho Livre */}
          <div className="flex items-center gap-1 rounded-md border border-border bg-card p-0.5">
            <Button
              type="button"
              variant={chalkTool === "white" ? "secondary" : "ghost"}
              size="sm"
              className={cn("h-7 px-2 text-xs gap-1", chalkTool === "white" && "ring-1 ring-white")}
              onClick={() => setChalkTool((t) => (t === "white" ? "none" : "white"))}
              title="Giz Branco (desenho livre)"
            >
              <Pencil className="size-3 text-white" /> Branco
            </Button>
            <Button
              type="button"
              variant={chalkTool === "red" ? "secondary" : "ghost"}
              size="sm"
              className={cn("h-7 px-2 text-xs gap-1", chalkTool === "red" && "ring-1 ring-red-500")}
              onClick={() => setChalkTool((t) => (t === "red" ? "none" : "red"))}
              title="Giz Vermelho (desenho livre)"
            >
              <Pencil className="size-3 text-red-500" /> Vermelho
            </Button>
            <Button
              type="button"
              variant={chalkTool === "eraser" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 px-2 text-xs gap-1"
              onClick={() => setChalkTool((t) => (t === "eraser" ? "none" : "eraser"))}
              title="Apagar Giz"
            >
              <Eraser className="size-3" /> Borracha
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-1.5 text-xs text-muted-foreground hover:text-destructive"
              onClick={clearChalk}
              title="Limpar todos os desenhos de giz"
            >
              Limpar
            </Button>
          </div>
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
            editing || placement
              ? "cursor-crosshair touch-none"
              : sel && "cursor-pointer",
            placement && "ring-2 ring-primary",
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

          {/* Camada Interativa de Giz / Desenho Livre */}
          <canvas
            ref={chalkCanvasRef}
            width={map.cols * CELL}
            height={map.rows * CELL}
            onPointerDown={handleChalkDown}
            onPointerMove={handleChalkMove}
            onPointerUp={handleChalkUp}
            className={cn(
              "absolute inset-0 z-30 touch-none",
              chalkTool === "none" ? "pointer-events-none" : "cursor-crosshair pointer-events-auto",
            )}
          />

          {items
            .filter(
              (item) =>
                item.x >= 0 &&
                item.y >= 0 &&
                item.x < map.cols &&
                item.y < map.rows &&
                (viewerIsMaster || !fog[cellKey(item.x, item.y)]),
            )
            .map((item) => {
              const distance = itemDistances.get(item.id) ?? null;
              const adjacent = distance !== null && distance <= 1;
              return (
                <div
                  key={item.id}
                  className="absolute left-0 top-0 z-10"
                  style={{
                    width: CELL,
                    height: CELL,
                    transform: `translate(${item.x * CELL}px, ${item.y * CELL}px)`,
                  }}
                >
                  <button
                    type="button"
                    aria-label={
                      item.is_chest
                        ? `Baú: ${item.name}`
                        : `${adjacent && item.collectible ? "Pegar" : "Item"}: ${item.name}`
                    }
                    title={
                      item.is_chest
                        ? adjacent || viewerIsMaster
                          ? `Abrir ${item.name}`
                          : `${item.name} · chegue ao lado para abrir`
                        : adjacent && item.collectible
                          ? `Pegar ${item.name}`
                          : `${item.name}${item.movable ? " · objeto movível" : ""}`
                    }
                    className={cn(
                      "grid size-9 place-items-center border-2 border-amber-300 bg-amber-950/90 text-xl shadow-[0_0_14px_rgba(251,191,36,0.65)]",
                      item.is_chest ? "size-10 rounded-md" : "rounded-full",
                      adjacent && item.collectible && "animate-pulse",
                    )}
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={() => {
                      if (item.is_chest) {
                        if (viewerIsMaster) onOpenChest?.(item.id, sel?.id ?? null);
                        else if (adjacent && sel) onOpenChest?.(item.id, sel.id);
                        else toast("Selecione seu personagem ao lado do baú para abrir.");
                        return;
                      }
                      if (adjacent && item.collectible && sel) onPickItem?.(item.id, sel.id);
                    }}
                  >
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt=""
                        className={cn(
                          "size-full object-cover",
                          item.is_chest ? "rounded-[4px]" : "rounded-full",
                        )}
                      />
                    ) : item.is_chest ? (
                      "🧰"
                    ) : item.icon && item.icon !== "📦" && item.icon !== "🎁" ? (
                      item.icon
                    ) : (
                      item.name.slice(0, 1).toLocaleUpperCase("pt-BR")
                    )}
                  </button>
                  {adjacent && item.movable && sel && (
                    <button
                      type="button"
                      aria-label={`Empurrar ${item.name}`}
                      title={`Empurrar ${item.name} (1 energia)`}
                      className="absolute -right-2 -top-2 grid size-5 place-items-center rounded-full border border-amber-200 bg-background text-amber-300"
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={() => onPushItem?.(item.id, sel.id)}
                    >
                      <Move className="size-3" />
                    </button>
                  )}
                </div>
              );
            })}

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

      {/* Modal Post-it Secreto nos Ladrilhos */}
      <Dialog open={!!postItModal} onOpenChange={(open) => !open && setPostItModal(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display uppercase tracking-wider text-amber-400">
              📌 Post-it Secreto do Mestre
            </DialogTitle>
            <DialogDescription>
              Casa: ({postItModal?.key.split(",")[0]}, {postItModal?.key.split(",")[1]}). Esta nota é invisível para os jogadores.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2">
            <Textarea
              rows={4}
              value={postItModal?.text ?? ""}
              onChange={(e) => postItModal && setPostItModal({ ...postItModal, text: e.target.value })}
              placeholder="Ex.: Armadilha oculta, armário revistável, pista sobre a vítima..."
              className="border-amber-500/40 bg-amber-950/20 text-sm"
            />
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => postItModal && savePostItNote(postItModal.key, "")}
            >
              Excluir Nota
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setPostItModal(null)}>
                Cancelar
              </Button>
              <Button
                type="button"
                variant="paint"
                onClick={() => postItModal && savePostItNote(postItModal.key, postItModal.text)}
              >
                Salvar Post-it
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

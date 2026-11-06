import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Eye,
  EyeOff,
  Image as ImageIcon,
  MapPin,
  Maximize2,
  Minimize2,
  Plus,
  RotateCcw,
  Swords,
  Trash2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useRef, useState, type MouseEvent, type TouchEvent } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import {
  activeRegionalMapQuery,
  mapLayoutsQuery,
  regionalMapPinsQuery,
  regionalMapsQuery,
  type RegionalMap,
  type RegionalMapPin,
} from "@/lib/rpg-queries";
import { cn } from "@/lib/utils";

export function RegionalMapViewer({ isMaster = false }: { isMaster?: boolean }) {
  const qc = useQueryClient();
  const { data: activeMap } = useQuery(activeRegionalMapQuery);
  const { data: allMaps } = useQuery(regionalMapsQuery);
  const { data: layouts } = useQuery(mapLayoutsQuery);
  const { data: pins = [] } = useQuery(regionalMapPinsQuery(activeMap?.id, isMaster));

  // Pan & Zoom
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const mapContainerRef = useRef<HTMLDivElement>(null);

  // Modais
  const [selectedPin, setSelectedPin] = useState<RegionalMapPin | null>(null);
  const [createPinCoords, setCreatePinCoords] = useState<{ x: number; y: number } | null>(null);
  const [editingPinId, setEditingPinId] = useState<string | null>(null);
  const [createMapOpen, setCreateMapOpen] = useState(false);

  // Form Pin
  const [pinName, setPinName] = useState("");
  const [pinPhotoUrl, setPinPhotoUrl] = useState("");
  const [pinDescription, setPinDescription] = useState("");
  const [pinSecretNotes, setPinSecretNotes] = useState("");
  const [pinIsRevealed, setPinIsRevealed] = useState(true);
  const [pinLinkedLayoutId, setPinLinkedLayoutId] = useState<string>("");

  // Form Novo Mapa
  const [newMapName, setNewMapName] = useState("");
  const [newMapImageUrl, setNewMapImageUrl] = useState("");

  // Pan Handlers
  const handleMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return; // apenas clique esquerdo arrasta
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };

  const handleMouseUp = () => setIsDragging(false);

  // Duplo clique do Mestre para criar Pin
  const handleDoubleClick = (e: MouseEvent<HTMLDivElement>) => {
    if (!isMaster || !activeMap) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const x_percent = Math.max(0, Math.min(100, (clickX / rect.width) * 100));
    const y_percent = Math.max(0, Math.min(100, (clickY / rect.height) * 100));

    setEditingPinId(null);
    setCreatePinCoords({ x: Number(x_percent.toFixed(2)), y: Number(y_percent.toFixed(2)) });
    setPinName("");
    setPinPhotoUrl("");
    setPinDescription("");
    setPinSecretNotes("");
    setPinIsRevealed(false);
    setPinLinkedLayoutId("");
  };

  const editPin = (pin: RegionalMapPin) => {
    setSelectedPin(null);
    setEditingPinId(pin.id);
    setCreatePinCoords({ x: pin.x_percent, y: pin.y_percent });
    setPinName(pin.name);
    setPinPhotoUrl(pin.photo_url);
    setPinDescription(pin.description);
    setPinSecretNotes(pin.secret_gm_notes);
    setPinIsRevealed(pin.is_revealed);
    setPinLinkedLayoutId(pin.linked_battle_layout_id?.toString() ?? "");
  };

  // Salvar Pin
  const savePinMutation = useMutation({
    mutationFn: async () => {
      if (!activeMap || !createPinCoords) return;
      const values = {
        name: pinName.trim() || "Ponto de Interesse",
        photo_url: pinPhotoUrl.trim(),
        description: pinDescription.trim(),
        secret_gm_notes: pinSecretNotes.trim(),
        x_percent: createPinCoords.x,
        y_percent: createPinCoords.y,
        is_revealed: pinIsRevealed,
        linked_battle_layout_id: pinLinkedLayoutId ? Number(pinLinkedLayoutId) : null,
      };
      const result = editingPinId
        ? await supabase.from("regional_map_pins").update(values).eq("id", editingPinId)
        : await supabase
            .from("regional_map_pins")
            .insert({ ...values, map_id: activeMap.id });
      const { error } = result;
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["regional_map_pins"] });
      toast.success(editingPinId ? "Marcador atualizado." : "Marcador criado no mapa!");
      setCreatePinCoords(null);
      setEditingPinId(null);
    },
    onError: (error) =>
      toast.error(
        `Não foi possível ${editingPinId ? "atualizar" : "criar"} o marcador: ${error.message}`,
      ),
  });

  // Alternar Revelação do Pin (Mestre)
  const togglePinReveal = async (pin: RegionalMapPin) => {
    const next = !pin.is_revealed;
    try {
      const { error } = await supabase
        .from("regional_map_pins")
        .update({ is_revealed: next })
        .eq("id", pin.id);
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["regional_map_pins"] });
      toast.success(next ? "Marcador revelado aos jogadores!" : "Marcador ocultado dos jogadores.");
      if (selectedPin && selectedPin.id === pin.id) {
        setSelectedPin({ ...selectedPin, is_revealed: next });
      }
    } catch (error) {
      toast.error(
        `Não foi possível alterar a visibilidade: ${error instanceof Error ? error.message : "erro desconhecido"}`,
      );
    }
  };

  // Deletar Pin
  const deletePinMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("regional_map_pins").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["regional_map_pins"] });
      toast.success("Marcador removido.");
      setSelectedPin(null);
      setCreatePinCoords(null);
      setEditingPinId(null);
    },
    onError: (error) => toast.error(`Não foi possível remover o marcador: ${error.message}`),
  });

  // Criar Novo Mapa Regional (Mestre)
  const createMapMutation = useMutation({
    mutationFn: async () => {
      if (!newMapName.trim() || !newMapImageUrl.trim()) return;
      // Desativa os outros se este for ativo
      const { error: deactivateError } = await supabase
        .from("regional_maps")
        .update({ is_active: false })
        .neq("id", "00000000-0000-0000-0000-000000000000");
      if (deactivateError) throw deactivateError;
      const { error } = await supabase.from("regional_maps").insert({
        name: newMapName.trim(),
        image_url: newMapImageUrl.trim(),
        is_active: true,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["regional_maps"] });
      toast.success("Mapa regional definido!");
      setCreateMapOpen(false);
      setNewMapName("");
      setNewMapImageUrl("");
    },
    onError: (error) =>
      toast.error(
        `Não foi possível salvar o mapa regional: ${error instanceof Error ? error.message : "erro desconhecido"}`,
      ),
  });

  // Carregar layout de batalha vinculado no battle_map
  const loadLinkedBattleLayout = async (layoutId: number) => {
    const layout = layouts?.find((l) => l.id === layoutId);
    if (!layout) {
      toast.error("Layout não encontrado.");
      return;
    }
    const { error } = await supabase
      .from("battle_map")
      .update({
        cols: layout.cols,
        rows: layout.rows,
        background_url: layout.background_url,
        terrain: layout.terrain,
        tile_images: layout.tile_images,
        fog: layout.fog,
      })
      .eq("id", 1);
    if (error) {
      toast.error(`Não foi possível carregar o cenário: ${error.message}`);
      return;
    }
    await qc.invalidateQueries({ queryKey: ["battle_map"] });
    toast.success(`Cenário tático "${layout.name}" carregado no combate!`);
    setSelectedPin(null);
  };

  return (
    <div className="relative flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-paint">
      {/* Barra Superior de Controles */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/40 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <MapPin className="size-4 text-primary" />
          <span className="font-display text-base font-bold uppercase tracking-wider text-foreground">
            {activeMap?.name ?? "Mapa da Região"}
          </span>
          {isMaster && (
            <span className="text-[10px] text-muted-foreground hidden sm:inline">
              (Duplo clique no mapa para colocar um marcador)
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-8"
            title="Aproximar (+)"
            onClick={() => setScale((s) => Math.min(3, s + 0.25))}
          >
            <ZoomIn className="size-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-8"
            title="Afastar (-)"
            onClick={() => setScale((s) => Math.max(0.5, s - 0.25))}
          >
            <ZoomOut className="size-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-8"
            title="Resetar visualização"
            onClick={() => {
              setScale(1);
              setPan({ x: 0, y: 0 });
            }}
          >
            <RotateCcw className="size-4" />
          </Button>

          {isMaster && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1 text-xs"
              onClick={() => setCreateMapOpen(true)}
            >
              <ImageIcon className="size-3.5" /> Trocar Mapa
            </Button>
          )}
        </div>
      </div>

      {/* Área Interativa com Pan & Zoom */}
      <div
        ref={mapContainerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        className={cn(
          "relative h-[560px] w-full overflow-hidden bg-black/90 select-none",
          isDragging ? "cursor-grabbing" : "cursor-grab",
        )}
      >
        {!activeMap?.image_url ? (
          <div className="flex h-full flex-col items-center justify-center p-6 text-center text-muted-foreground">
            <MapPin className="mb-2 size-12 opacity-30" />
            <p className="font-display text-lg uppercase">Nenhum mapa regional ativo</p>
            <p className="text-xs">
              {isMaster
                ? "Clique em 'Trocar Mapa' para configurar a imagem da cidade ou região."
                : "O mestre ainda não revelou o mapa da região."}
            </p>
          </div>
        ) : (
          <div
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
              transformOrigin: "0 0",
              transition: isDragging ? "none" : "transform 0.15s ease-out",
            }}
            className="relative inline-block"
            onDoubleClick={handleDoubleClick}
          >
            <img
              src={activeMap.image_url}
              alt={activeMap.name}
              draggable={false}
              className="max-w-none pointer-events-auto"
              style={{ maxHeight: "1200px" }}
            />

            {/* Marcadores / Pins */}
            {pins.map((pin) => {
              const isHiddenForPlayer = !pin.is_revealed;
              // STRICT RULE: Player queries filter is_revealed=true, but keep visual protection:
              if (isHiddenForPlayer && !isMaster) return null;

              return (
                <button
                  key={pin.id}
                  type="button"
                  onContextMenu={(e: MouseEvent<HTMLButtonElement>) => {
                    if (!isMaster) return;
                    e.preventDefault();
                    e.stopPropagation();
                    editPin(pin);
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedPin(pin);
                  }}
                  style={{
                    left: `${pin.x_percent}%`,
                    top: `${pin.y_percent}%`,
                  }}
                  className={cn(
                    "group absolute -translate-x-1/2 -translate-y-full transition-transform hover:scale-125 focus:outline-none",
                    isHiddenForPlayer ? "opacity-60" : "opacity-100",
                  )}
                >
                  <div className="flex flex-col items-center">
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 font-display text-[10px] font-bold uppercase tracking-wider text-white shadow-md transition-opacity group-hover:opacity-100",
                        isHiddenForPlayer ? "bg-zinc-800 border border-amber-500/50" : "bg-primary",
                      )}
                    >
                      {pin.name}
                      {isHiddenForPlayer && isMaster && " 🔒"}
                    </span>
                    <MapPin
                      className={cn(
                        "size-7 drop-shadow-md",
                        isHiddenForPlayer
                          ? "fill-zinc-700 text-amber-500"
                          : "fill-primary text-primary-foreground",
                      )}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal de Detalhes do Marcador */}
      <Dialog open={!!selectedPin} onOpenChange={(open) => !open && setSelectedPin(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <div className="flex items-center justify-between gap-2">
              <DialogTitle className="flex items-center gap-2 font-display text-xl uppercase tracking-wider">
                <MapPin className="size-5 text-primary" /> {selectedPin?.name}
              </DialogTitle>
              {isMaster && (
                <Badge
                  variant={selectedPin?.is_revealed ? "default" : "outline"}
                  className="cursor-pointer gap-1"
                  onClick={() => selectedPin && togglePinReveal(selectedPin)}
                >
                  {selectedPin?.is_revealed ? (
                    <>
                      <Eye className="size-3" /> Revelado
                    </>
                  ) : (
                    <>
                      <EyeOff className="size-3 text-amber-400" /> Oculto (Mestre)
                    </>
                  )}
                </Badge>
              )}
            </div>
            {selectedPin?.photo_url && (
              <div className="mt-2 overflow-hidden rounded-lg border border-border">
                <img
                  src={selectedPin.photo_url}
                  alt={selectedPin.name}
                  className="h-48 w-full object-cover"
                />
              </div>
            )}
            <DialogDescription className="mt-2 text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
              {selectedPin?.description || "Sem descrição pública para este local."}
            </DialogDescription>
          </DialogHeader>

          {/* Notas Secretas do Mestre */}
          {isMaster && selectedPin?.secret_gm_notes && (
            <div className="mt-2 rounded-lg border border-amber-500/40 bg-amber-950/20 p-3 text-xs text-amber-200">
              <p className="font-bold uppercase tracking-wider text-amber-400 mb-1">
                🔒 Segredos do Mestre:
              </p>
              <p className="whitespace-pre-wrap">{selectedPin.secret_gm_notes}</p>
            </div>
          )}

          <DialogFooter className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              {isMaster && selectedPin?.linked_battle_layout_id && (
                <Button
                  type="button"
                  variant="paint"
                  size="sm"
                  className="gap-1.5"
                  onClick={() =>
                    selectedPin.linked_battle_layout_id &&
                    loadLinkedBattleLayout(selectedPin.linked_battle_layout_id)
                  }
                >
                  <Swords className="size-4" /> Entrar no Combate
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              {isMaster && selectedPin && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => deletePinMutation.mutate(selectedPin.id)}
                >
                  <Trash2 className="size-4 mr-1" /> Excluir
                </Button>
              )}
              <Button type="button" variant="outline" size="sm" onClick={() => setSelectedPin(null)}>
                Fechar
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Criar Marcador (Mestre) */}
      <Dialog open={!!createPinCoords} onOpenChange={(open) => !open && setCreatePinCoords(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display uppercase tracking-wider">
              <Plus className="size-5 text-primary" />{" "}
              {editingPinId ? "Editar Marcador" : "Novo Marcador no Mapa"}
            </DialogTitle>
            <DialogDescription>
              Posição: {createPinCoords?.x}% X, {createPinCoords?.y}% Y
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-sm">
            <label className="block space-y-1">
              <span className="label-caps text-muted-foreground">Nome do Local</span>
              <Input
                placeholder="Ex.: Armazém Abandonado das Docas"
                value={pinName}
                onChange={(e) => setPinName(e.target.value)}
              />
            </label>

            <label className="block space-y-1">
              <span className="label-caps text-muted-foreground">URL da Foto (Opcional)</span>
              <Input
                placeholder="https://..."
                value={pinPhotoUrl}
                onChange={(e) => setPinPhotoUrl(e.target.value)}
              />
            </label>

            <label className="block space-y-1">
              <span className="label-caps text-muted-foreground">Descrição Pública (Jogadores)</span>
              <Textarea
                placeholder="O que qualquer um vê ao se aproximar deste lugar..."
                value={pinDescription}
                onChange={(e) => setPinDescription(e.target.value)}
                rows={3}
              />
            </label>

            <label className="block space-y-1">
              <span className="label-caps text-amber-400 font-semibold">🔒 Segredos do Mestre (Privado)</span>
              <Textarea
                placeholder="Pistas ocultas, NPCs escondidos, itens e perigos..."
                value={pinSecretNotes}
                onChange={(e) => setPinSecretNotes(e.target.value)}
                rows={2}
                className="border-amber-500/40 bg-amber-950/20"
              />
            </label>

            <div className="flex items-center justify-between border-t border-border pt-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={pinIsRevealed}
                  onChange={(e) => setPinIsRevealed(e.target.checked)}
                  className="rounded border-border text-primary focus:ring-primary"
                />
                <span className="text-xs font-semibold">Já visível para os jogadores</span>
              </label>
            </div>

            {layouts && layouts.length > 0 && (
              <div className="space-y-1 pt-1">
                <span className="label-caps text-muted-foreground">Vincular Cenário de Combate</span>
                <select
                  value={pinLinkedLayoutId}
                  onChange={(e) => setPinLinkedLayoutId(e.target.value)}
                  className="w-full h-9 rounded-md border border-border bg-card px-2 text-xs"
                >
                  <option value="">Nenhum cenário vinculado</option>
                  {layouts.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} ({l.cols}x{l.rows})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            {editingPinId && (
              <Button
                type="button"
                variant="ghost"
                className="mr-auto text-destructive hover:bg-destructive/10 hover:text-destructive"
                disabled={deletePinMutation.isPending}
                onClick={() => {
                  if (confirm(`Excluir "${pinName}" do mapa?`)) {
                    deletePinMutation.mutate(editingPinId);
                  }
                }}
              >
                <Trash2 className="mr-1 size-4" /> Excluir
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setCreatePinCoords(null);
                setEditingPinId(null);
              }}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="paint"
              disabled={savePinMutation.isPending || !pinName.trim()}
              onClick={() => savePinMutation.mutate()}
            >
              {editingPinId ? "Salvar alterações" : "Criar Marcador"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Trocar / Criar Mapa Regional */}
      <Dialog open={createMapOpen} onOpenChange={setCreateMapOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display uppercase tracking-wider">
              <ImageIcon className="size-5 text-primary" /> Definir Mapa da Região
            </DialogTitle>
            <DialogDescription>
              Cole a URL da imagem da cidade, distrito ou mapa regional.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-sm">
            <label className="block space-y-1">
              <span className="label-caps text-muted-foreground">Nome do Mapa</span>
              <Input
                placeholder="Ex.: Distrito de Revachol Oeste"
                value={newMapName}
                onChange={(e) => setNewMapName(e.target.value)}
              />
            </label>

            <label className="block space-y-1">
              <span className="label-caps text-muted-foreground">URL da Imagem</span>
              <Input
                placeholder="https://images.unsplash.com/..."
                value={newMapImageUrl}
                onChange={(e) => setNewMapImageUrl(e.target.value)}
              />
            </label>

            {allMaps && allMaps.length > 0 && (
              <div className="pt-2 border-t border-border">
                <span className="label-caps text-muted-foreground mb-1 block">Mapas já cadastrados</span>
                <div className="space-y-1 max-h-36 overflow-y-auto">
                  {allMaps.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between rounded border border-border p-2 text-xs"
                    >
                      <span className="font-semibold truncate max-w-[200px]">{m.name}</span>
                      <Button
                        type="button"
                        size="sm"
                        variant={m.is_active ? "secondary" : "outline"}
                        className="h-6 text-[10px]"
                        disabled={m.is_active ?? false}
                        onClick={async () => {
                          try {
                            const { error: deactivateError } = await supabase
                              .from("regional_maps")
                              .update({ is_active: false })
                              .neq("id", "00000000-0000-0000-0000-000000000000");
                            if (deactivateError) throw deactivateError;
                            const { error } = await supabase
                              .from("regional_maps")
                              .update({ is_active: true })
                              .eq("id", m.id);
                            if (error) throw error;
                            await qc.invalidateQueries({ queryKey: ["regional_maps"] });
                            toast.success(`Mapa "${m.name}" ativado!`);
                            setCreateMapOpen(false);
                          } catch (error) {
                            toast.error(
                              `Não foi possível ativar o mapa: ${error instanceof Error ? error.message : "erro desconhecido"}`,
                            );
                          }
                        }}
                      >
                        {m.is_active ? "Ativo" : "Ativar"}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            <Button type="button" variant="outline" onClick={() => setCreateMapOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="paint"
              disabled={createMapMutation.isPending || !newMapName.trim() || !newMapImageUrl.trim()}
              onClick={() => createMapMutation.mutate()}
            >
              Salvar e Ativar Mapa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

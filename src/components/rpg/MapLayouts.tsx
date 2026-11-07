import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FolderOpen, Save, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useBattleMap } from "@/hooks/use-battle-map";
import { supabase } from "@/integrations/supabase/client";
import type { Fog, Terrain, TileImages } from "@/lib/combat";
import type { Json } from "@/integrations/supabase/types";
import { battleMapItemsQuery, mapLayoutsQuery, type BattleMap } from "@/lib/rpg-queries";

/** Salvar e carregar cenários prontos do mapa (Bar, Beco, Esgoto…). */
export function MapLayouts({ map }: { map: BattleMap }) {
  const { data: layouts = [] } = useQuery(mapLayoutsQuery);
  const qc = useQueryClient();
  const saveMap = useBattleMap();
  const [pick, setPick] = useState("");

  const saveAs = async () => {
    const name = prompt("Nome do layout (ex.: Bar, Beco, Esgoto):")?.trim();
    if (!name) return;
    const { data: current } = await supabase.from("battle_map_items").select("*");
    const items = (current ?? []).map(({ id: _id, created_at: _c, ...rest }) => rest);
    const { error } = await supabase.from("map_layouts").insert({
      items: items as unknown as Json,
      name,
      cols: map.cols,
      rows: map.rows,
      background_url: map.background_url,
      terrain: map.terrain ?? {},
      tile_images: map.tile_images ?? {},
      fog: map.fog ?? {},
    });
    if (error) {
      toast.error("Não foi possível salvar o layout.");
      return;
    }
    toast.success(`Layout "${name}" salvo.`);
    qc.invalidateQueries({ queryKey: ["map_layouts"] });
  };

  const load = async () => {
    const l = layouts.find((x) => x.id === pick);
    if (!l) return;
    if (!confirm(`Trocar o mapa atual por "${l.name}"? Baús e itens atuais do mapa serão trocados pelos do layout.`)) return;
    const saved = Array.isArray(l.items) ? (l.items as Record<string, unknown>[]) : [];
    const { error: delError } = await supabase
      .from("battle_map_items")
      .delete()
      .not("id", "is", null);
    if (delError) {
      toast.error("Não foi possível limpar os itens do mapa.");
      return;
    }
    if (saved.length) {
      const rows = saved.map(({ id: _id, created_at: _c, ...rest }) => rest);
      const { error } = await supabase
        .from("battle_map_items")
        .insert(rows as never);
      if (error) toast.error(`Alguns itens não voltaram: ${error.message}`);
    }
    qc.invalidateQueries({ queryKey: battleMapItemsQuery.queryKey });
    saveMap.mutate({
      cols: l.cols,
      rows: l.rows,
      background_url: l.background_url,
      terrain: l.terrain as Terrain,
      tile_images: l.tile_images as TileImages,
      fog: l.fog as Fog,
    });
    toast.success(`Layout "${l.name}" carregado.`);
  };

  const remove = async () => {
    const l = layouts.find((x) => x.id === pick);
    if (!l || !confirm(`Apagar o layout "${l.name}"?`)) return;
    const { error } = await supabase.from("map_layouts").delete().eq("id", l.id);
    if (error) {
      toast.error("Não foi possível apagar.");
      return;
    }
    setPick("");
    qc.invalidateQueries({ queryKey: ["map_layouts"] });
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5 border-t border-border pt-3">
      <span className="label-caps mr-1 text-muted-foreground">Layouts</span>
      <Button size="sm" variant="outline" onClick={saveAs}>
        <Save /> Salvar layout
      </Button>
      <select
        className="h-8 rounded-md border border-border bg-card px-2 text-sm"
        value={pick}
        onChange={(e) => setPick(e.target.value)}
        aria-label="Layout salvo"
      >
        <option value="">{layouts.length ? "Escolha um layout…" : "Nenhum salvo"}</option>
        {layouts.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name} ({l.cols}×{l.rows})
          </option>
        ))}
      </select>
      <Button size="sm" variant="ghost" disabled={!pick} onClick={() => void load()}>
        <FolderOpen /> Carregar
      </Button>
      <Button size="sm" variant="ghost" disabled={!pick} onClick={remove} aria-label="Apagar layout">
        <Trash2 />
      </Button>
    </div>
  );
}

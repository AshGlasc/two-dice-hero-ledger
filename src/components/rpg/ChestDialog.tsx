import { Camera, PackageOpen, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { fileToSmallImage } from "@/lib/image";
import type { CatalogItemRow } from "@/lib/give-item";
import type { ChestEntry } from "@/lib/passives";
import type { BattleMapItem } from "@/lib/rpg-queries";

/** Baú no mapa: jogadores perto pegam itens; o mestre troca foto, nome e conteúdo. */
export function ChestDialog({
  chest,
  entries,
  open,
  onOpenChange,
  isMaster,
  catalogItems,
  takers,
  onTake,
  onAdd,
  onRemove,
  onUpdate,
  onDelete,
}: {
  chest: BattleMapItem | null;
  entries: ChestEntry[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isMaster: boolean;
  catalogItems: CatalogItemRow[];
  /** Quem pode receber o item (jogador: só o próprio personagem; mestre: qualquer um). */
  takers: { id: string; name: string }[];
  onTake: (entry: ChestEntry, characterId: string) => void;
  onAdd: (catalogItemId: string) => void;
  onRemove: (uid: string) => void;
  onUpdate: (patch: { name?: string; image_url?: string }) => void;
  onDelete: () => void;
}) {
  const [addId, setAddId] = useState("");
  const [takerId, setTakerId] = useState("");
  const file = useRef<HTMLInputElement>(null);
  const taker = takers.find((t) => t.id === takerId) ?? takers[0];

  if (!chest) return null;
  const imageOf = (id: string) => catalogItems.find((c) => c.id === id)?.image_url;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackageOpen className="size-5 text-primary" /> {chest.name}
          </DialogTitle>
          <DialogDescription>
            {isMaster
              ? "Coloque itens do catálogo e troque a foto do baú."
              : "Escolha o que levar. O item vai para a mochila ou para as armas."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3">
          <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-md border-2 border-primary/60 bg-muted">
            {chest.image_url ? (
              <img src={chest.image_url} alt={chest.name} className="size-full object-cover" />
            ) : (
              <PackageOpen className="size-7 text-primary" />
            )}
          </div>
          {isMaster && (
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <Input
                defaultValue={chest.name}
                aria-label="Nome do baú"
                onBlur={(e) => {
                  const name = e.target.value.trim();
                  if (name && name !== chest.name) onUpdate({ name });
                }}
              />
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
                    onUpdate({ image_url: await fileToSmallImage(f, 256) });
                  } catch {
                    toast.error("Não foi possível ler essa imagem.");
                  }
                }}
              />
              <Button size="sm" variant="outline" onClick={() => file.current?.click()}>
                <Camera /> Trocar foto
              </Button>
            </div>
          )}
        </div>

        {takers.length > 1 && (
          <label className="flex items-center gap-2 text-sm">
            <span className="label-caps text-muted-foreground">Entregar para</span>
            <select
              className="h-9 flex-1 rounded-md border border-border bg-background px-2 text-sm"
              value={taker?.id ?? ""}
              onChange={(e) => setTakerId(e.target.value)}
            >
              {takers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
        )}

        {entries.length === 0 ? (
          <p className="rounded-md border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
            O baú está vazio.
          </p>
        ) : (
          <ul className="max-h-72 space-y-1.5 overflow-y-auto">
            {entries.map((entry) => {
              const img = imageOf(entry.catalog_item_id);
              return (
                <li
                  key={entry.uid}
                  className="flex items-center gap-2 rounded-md border border-border bg-background p-2"
                >
                  <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded bg-muted text-xs font-bold">
                    {img ? (
                      <img src={img} alt="" className="size-full object-cover" />
                    ) : (
                      entry.name.slice(0, 1).toLocaleUpperCase("pt-BR")
                    )}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{entry.name}</span>
                  {taker && (
                    <Button size="sm" onClick={() => onTake(entry, taker.id)}>
                      Pegar
                    </Button>
                  )}
                  {isMaster && (
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Tirar ${entry.name} do baú`}
                      onClick={() => onRemove(entry.uid)}
                    >
                      <Trash2 />
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {isMaster && (
          <div className="space-y-2 border-t border-border pt-3">
            <div className="flex gap-2">
              <select
                className="h-9 min-w-0 flex-1 rounded-md border border-border bg-background px-2 text-sm"
                value={addId}
                onChange={(e) => setAddId(e.target.value)}
                aria-label="Item para guardar no baú"
              >
                <option value="">Guardar item do catálogo…</option>
                {catalogItems.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <Button
                size="sm"
                disabled={!addId}
                onClick={() => {
                  onAdd(addId);
                  setAddId("");
                }}
              >
                Guardar
              </Button>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => confirm("Remover este baú do mapa?") && onDelete()}
            >
              <Trash2 /> Remover baú do mapa
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

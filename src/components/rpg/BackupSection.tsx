import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

// Ordem respeita dependências: pais antes dos filhos.
const TABLES = [
  "app_settings", "gm_notes", "characters", "catalog_items", "monsters",
  "character_skills", "body_parts", "weapons", "backpack_items",
  "battle_map", "battle_map_items", "map_layouts", "combatants", "combat_state",
  "combat_events", "rolls", "phone_contacts", "messages", "phone_clues",
  "phone_gallery", "sanity_whispers", "whisper_presets",
] as const;

type Backup = { version: 1; created_at: string; tables: Record<string, unknown[]> };

export function BackupSection() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function exportAll() {
    setBusy(true);
    try {
      const tables: Record<string, unknown[]> = {};
      for (const t of TABLES) {
        const { data, error } = await supabase.from(t).select("*");
        if (error) throw new Error(`${t}: ${error.message}`);
        tables[t] = data ?? [];
      }
      const backup: Backup = { version: 1, created_at: new Date().toISOString(), tables };
      const blob = new Blob([JSON.stringify(backup)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `eco-dos-caidos-backup-${backup.created_at.slice(0, 16).replace(/[:T]/g, "-")}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast.success("Backup baixado");
    } catch (e) {
      toast.error(`Falha no backup: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function importFile(file: File) {
    if (!confirm("Restaurar este backup? Dados com o mesmo ID serão substituídos; nada é apagado.")) return;
    setBusy(true);
    const failed: string[] = [];
    try {
      const backup = JSON.parse(await file.text()) as Backup;
      if (!backup?.tables) throw new Error("arquivo inválido");
      // combat_state aponta para combatants; restaura sem o ponteiro e depois completa.
      for (const t of TABLES) {
        const rows = backup.tables[t];
        if (!rows?.length) continue;
        const payload = t === "combat_state"
          ? rows.map((r) => ({ ...(r as object), current_combatant_id: null }))
          : rows;
        const { error } = await supabase.from(t).upsert(payload as never, { onConflict: "id" });
        if (error) failed.push(`${t}: ${error.message}`);
      }
      const cs = backup.tables["combat_state"];
      if (cs?.length) await supabase.from("combat_state").upsert(cs as never, { onConflict: "id" });
      await qc.invalidateQueries();
      if (failed.length) toast.error(`Restaurado com falhas: ${failed.join("; ")}`);
      else toast.success("Backup restaurado");
    } catch (e) {
      toast.error(`Falha ao restaurar: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-lg border border-border bg-card p-4 space-y-3">
      <h2 className="font-semibold">Backup da mesa</h2>
      <p className="text-sm text-muted-foreground">
        Baixa um arquivo com tudo: fichas, skills, armas, mochilas, monstros, itens, mapas, celular e notas.
        Guarde-o antes de grandes atualizações. Restaurar recria o que sumiu sem apagar nada.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button onClick={exportAll} disabled={busy}><Download className="size-4" /> Baixar backup</Button>
        <Button variant="outline" disabled={busy} onClick={() => fileRef.current?.click()}>
          <Upload className="size-4" /> Restaurar backup
        </Button>
        <input
          ref={fileRef} type="file" accept="application/json" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void importFile(f); e.target.value = ""; }}
        />
      </div>
    </section>
  );
}

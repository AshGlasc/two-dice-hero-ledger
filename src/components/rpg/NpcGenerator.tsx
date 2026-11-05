import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Dices, Lock, LockOpen } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { emptyNpc, rollNpc, rollNpcField, type Npc, type NpcField } from "@/lib/npc-generator";
import { cn } from "@/lib/utils";

const LABELS: Record<Exclude<NpcField, "avatar" | "stats">, string> = {
  name: "Nome",
  occupation: "Ocupação",
  appearance: "Aparência",
  trait: "Trejeito",
  secret: "Segredo",
};

export function NpcGenerator() {
  const qc = useQueryClient();
  const [npc, setNpc] = useState<Npc>(() => emptyNpc());
  const [locked, setLocked] = useState<Set<NpcField>>(new Set());
  const [busy, setBusy] = useState(false);
  const generated = npc.name !== "";

  const toggle = (f: NpcField) =>
    setLocked((s) => {
      const n = new Set(s);
      if (n.has(f)) n.delete(f);
      else n.add(f);
      return n;
    });

  const Controls = ({ f }: { f: NpcField }) => (
    <div className="flex shrink-0 gap-1">
      <Button type="button" size="icon" variant="ghost" className="h-8 w-8" title="Rolar" disabled={locked.has(f)} onClick={() => setNpc((n) => rollNpcField(f, n))}>
        <Dices className="h-4 w-4" />
      </Button>
      <Button type="button" size="icon" variant="ghost" className={cn("h-8 w-8", locked.has(f) && "text-primary")} title={locked.has(f) ? "Destravar" : "Travar"} onClick={() => toggle(f)}>
        {locked.has(f) ? <Lock className="h-4 w-4" /> : <LockOpen className="h-4 w-4" />}
      </Button>
    </div>
  );

  const description = () =>
    `${npc.occupation}\nAparência: ${npc.appearance}\nTrejeito: ${npc.trait}\nSegredo (mestre): ${npc.secret}`;

  async function saveBestiary() {
    setBusy(true);
    const { error } = await supabase.from("monsters").insert({
      name: npc.name,
      avatar_url: npc.avatarUrl,
      description: description(),
      hp_max: npc.stats.hp,
      defense: npc.stats.defense,
      attack_bonus: npc.stats.attack,
      attacks: `Golpe (${npc.stats.damage})`,
    });
    setBusy(false);
    if (error) return toast.error("Não foi possível salvar no bestiário.");
    qc.invalidateQueries();
    toast.success(`${npc.name} salvo no bestiário — já pode colocar no mapa pelo Combate.`);
  }

  async function addContact() {
    setBusy(true);
    const { error } = await supabase.from("phone_contacts").insert({ name: npc.name });
    setBusy(false);
    if (error) return toast.error("Não foi possível criar o contato.");
    qc.invalidateQueries();
    toast.success(`${npc.name} adicionado aos contatos do celular.`);
  }

  return (
    <section className="rounded-lg border border-border bg-card p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg">Gerador rápido de NPC</h2>
        <Button onClick={() => setNpc((n) => rollNpc(n, locked))}>
          <Dices className="mr-2 h-4 w-4" /> {generated ? "Rolar o que não está travado" : "Gerar NPC"}
        </Button>
      </div>

      {generated && (
        <>
          <div className="flex items-center gap-3">
            {npc.avatarUrl ? (
              <img src={npc.avatarUrl} alt={npc.name} className="h-20 w-20 rounded-full border border-border bg-muted object-cover" />
            ) : (
              <div className="h-20 w-20 rounded-full bg-muted" />
            )}
            <Input
              placeholder="Ou cole o link de uma foto"
              value={npc.avatarUrl}
              onChange={(e) => setNpc({ ...npc, avatarUrl: e.target.value })}
            />
            <Controls f="avatar" />
          </div>

          {(Object.keys(LABELS) as (keyof typeof LABELS)[]).map((f) => (
            <div key={f} className="flex items-center gap-2">
              <span className="w-24 shrink-0 text-xs uppercase text-muted-foreground">{LABELS[f]}</span>
              <Input value={npc[f]} onChange={(e) => setNpc({ ...npc, [f]: e.target.value })} />
              <Controls f={f} />
            </div>
          ))}

          <div className="flex items-center gap-2">
            <span className="w-24 shrink-0 text-xs uppercase text-muted-foreground">Combate</span>
            <div className="grid flex-1 grid-cols-4 gap-2 text-xs">
              {([["hp", "Vida"], ["defense", "Defesa"], ["attack", "Ataque +"]] as const).map(([k, l]) => (
                <label key={k} className="space-y-1">
                  <span className="text-muted-foreground">{l}</span>
                  <Input type="number" value={npc.stats[k]} onChange={(e) => setNpc({ ...npc, stats: { ...npc.stats, [k]: Number(e.target.value) || 0 } })} />
                </label>
              ))}
              <label className="space-y-1">
                <span className="text-muted-foreground">Dano</span>
                <Input value={npc.stats.damage} onChange={(e) => setNpc({ ...npc, stats: { ...npc.stats, damage: e.target.value } })} />
              </label>
            </div>
            <Controls f="stats" />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" disabled={busy} onClick={saveBestiary}>Salvar no bestiário</Button>
            <Button variant="secondary" disabled={busy} onClick={addContact}>Adicionar aos contatos</Button>
            <Button variant="ghost" onClick={() => { setNpc(emptyNpc()); setLocked(new Set()); }}>Descartar</Button>
          </div>
        </>
      )}
    </section>
  );
}

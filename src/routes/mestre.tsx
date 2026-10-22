import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Dices, Eraser, Swords, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { BodyMap } from "@/components/rpg/BodyMap";
import { InlineField } from "@/components/rpg/InlineField";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { ATTRIBUTE_THEME } from "@/lib/attribute-theme";
import { logRolls } from "@/lib/roll-log";
import { gmNotesQuery, groupQuery, rollsQuery, type GroupData } from "@/lib/rpg-queries";
import {
  ALL_SKILLS,
  ATTRIBUTES,
  DIFFICULTIES,
  OUTCOME_CLASS,
  OUTCOME_TEXT,
  roll2d6,
  skillTotal,
  type RollOutcome,
  type RollResult,
} from "@/lib/skills";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/mestre")({
  head: () => ({
    meta: [
      { title: "Painel do mestre — Fungo Disco" },
      {
        name: "description",
        content:
          "Painel do mestre do Fungo Disco: visão do grupo, testes em grupo, iniciativa, rolagens ao vivo e notas da sessão.",
      },
      { property: "og:title", content: "Painel do mestre — Fungo Disco" },
      {
        property: "og:description",
        content: "Testes em grupo, iniciativa, rolagens ao vivo e notas para mestrar a sessão.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(groupQuery),
      context.queryClient.ensureQueryData(rollsQuery),
      context.queryClient.ensureQueryData(gmNotesQuery),
    ]);
  },
  component: GmPage,
});

type GroupResult = { id: string; name: string; result: RollResult };

function skillValueFor(group: GroupData, characterId: string, skillKey: string) {
  const skill = ALL_SKILLS.find((s) => s.key === skillKey);
  const character = group.characters.find((c) => c.id === characterId);
  if (!skill || !character) return 0;
  const bonus =
    group.skills.find((s) => s.character_id === characterId && s.skill_key === skillKey)?.bonus ?? 0;
  return skillTotal(character[skill.attribute], bonus);
}

function GmPage() {
  const { data: group } = useSuspenseQuery(groupQuery);

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-4 py-8 md:px-6">
      <header>
        <p className="label-caps text-primary">Bastidores</p>
        <h1 className="text-6xl font-bold uppercase leading-none">Painel do mestre</h1>
        <p className="mt-2 text-muted-foreground">
          Tudo aqui atualiza ao vivo quando qualquer jogador muda a ficha ou rola os dados.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <GroupTest group={group} />
          <PartyOverview group={group} />
        </div>
        <div className="space-y-6">
          <RollFeed />
          <GmNotes />
        </div>
      </div>
    </main>
  );
}

function GroupTest({ group }: { group: GroupData }) {
  const [skillKey, setSkillKey] = useState("percepcao");
  const [difficulty, setDifficulty] = useState("10");
  const [title, setTitle] = useState("");
  const [results, setResults] = useState<GroupResult[]>([]);

  const run = (key: string, dc: number | null, label: string) => {
    if (group.characters.length === 0) {
      toast("Crie personagens primeiro.");
      return;
    }
    const rolled = group.characters
      .map((c) => ({
        id: c.id,
        name: c.name,
        result: roll2d6(skillValueFor(group, c.id, key), dc),
      }))
      .sort((a, b) => b.result.total - a.result.total);
    setResults(rolled);
    setTitle(label);
    void logRolls(
      rolled.map((r) => ({
        characterId: r.id,
        characterName: r.name,
        label,
        result: r.result,
      })),
    );
  };

  const skillName = ALL_SKILLS.find((s) => s.key === skillKey)?.name ?? "";

  return (
    <section className="rounded-lg border border-border bg-card p-5 shadow-paint">
      <div className="mb-4 flex items-center gap-2">
        <Users className="size-5 text-primary" />
        <h2 className="text-2xl font-bold uppercase">Teste em grupo</h2>
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <label className="space-y-1.5">
          <span className="label-caps text-muted-foreground">Skill</span>
          <Select value={skillKey} onValueChange={setSkillKey}>
            <SelectTrigger aria-label="Skill do teste">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ATTRIBUTES.map((a) => (
                <SelectGroup key={a.key}>
                  <SelectLabel className={ATTRIBUTE_THEME[a.key].text}>{a.name}</SelectLabel>
                  {a.skills.map((s) => (
                    <SelectItem key={s.key} value={s.key}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
        </label>
        <label className="space-y-1.5">
          <span className="label-caps text-muted-foreground">Dificuldade</span>
          <Select value={difficulty} onValueChange={setDifficulty}>
            <SelectTrigger aria-label="Dificuldade do teste">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sem dificuldade</SelectItem>
              {DIFFICULTIES.map((d) => (
                <SelectItem key={d.value} value={String(d.value)}>
                  {d.name} — {d.value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <Button
          variant="paint"
          onClick={() =>
            run(skillKey, difficulty === "none" ? null : Number(difficulty), `Teste: ${skillName}`)
          }
        >
          <Dices /> Rolar para todos
        </Button>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="mt-3"
        onClick={() => run("velocidade_reacao", null, "Iniciativa")}
      >
        <Swords /> Rolar iniciativa (Velocidade de Reação)
      </Button>

      {results.length > 0 && (
        <div className="mt-5 animate-fade-up">
          <p className="label-caps mb-2 text-muted-foreground">{title}</p>
          <ol className="divide-y divide-border rounded-md border border-border">
            {results.map((r, i) => (
              <li key={r.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="flex items-center gap-3">
                  <span className="tabular w-5 font-display text-muted-foreground">{i + 1}.</span>
                  <span className="font-display text-lg font-semibold uppercase">{r.name}</span>
                </span>
                <span className="flex items-center gap-3">
                  <span className="tabular text-xs text-muted-foreground">
                    {r.result.dice[0]}+{r.result.dice[1]}+{r.result.modifier}
                  </span>
                  <span className="tabular font-display text-2xl font-bold">{r.result.total}</span>
                  <span className={cn("label-caps w-24 text-right", OUTCOME_CLASS[r.result.outcome])}>
                    {OUTCOME_TEXT[r.result.outcome]}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}

function PartyOverview({ group }: { group: GroupData }) {
  return (
    <section className="space-y-3">
      <h2 className="text-2xl font-bold uppercase">O grupo</h2>
      {group.characters.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border py-10 text-center italic text-muted-foreground">
          Nenhum personagem ainda.
        </p>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {group.characters.map((c) => (
            <li key={c.id} className="rounded-lg border border-border bg-card p-4 shadow-paint">
              <div className="mb-3 flex items-start justify-between gap-2">
                <div>
                  <Link
                    to="/personagem/$id"
                    params={{ id: c.id }}
                    className="font-display text-2xl font-bold uppercase leading-none hover:text-primary"
                  >
                    {c.name}
                  </Link>
                  {c.player_name && (
                    <p className="label-caps mt-1 text-muted-foreground">{c.player_name}</p>
                  )}
                </div>
                <div className="flex gap-1">
                  {ATTRIBUTES.map((a) => (
                    <span
                      key={a.key}
                      title={a.name}
                      className={cn(
                        "tabular rounded-sm px-1.5 py-0.5 font-display text-sm font-bold",
                        ATTRIBUTE_THEME[a.key].soft,
                        ATTRIBUTE_THEME[a.key].text,
                      )}
                    >
                      {c[a.key]}
                    </span>
                  ))}
                </div>
              </div>
              <BodyMap characterId={c.id} body={group.body} compact />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function RollFeed() {
  const { data: rolls } = useSuspenseQuery(rollsQuery);
  const qc = useQueryClient();
  const clear = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("rolls").delete().not("id", "is", null);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rolls"] }),
    onError: () => toast.error("Não foi possível limpar."),
  });

  return (
    <section className="rounded-lg border border-border bg-card p-5 shadow-paint">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="label-caps text-success">Ao vivo</p>
          <h2 className="text-2xl font-bold uppercase">Rolagens da mesa</h2>
        </div>
        <Button
          variant="ghost"
          size="sm"
          disabled={rolls.length === 0}
          onClick={() => {
            if (confirm("Apagar o histórico de rolagens?")) clear.mutate();
          }}
        >
          <Eraser /> Limpar
        </Button>
      </div>
      {rolls.length === 0 ? (
        <p className="py-6 text-center text-sm italic text-muted-foreground">
          As rolagens dos jogadores aparecem aqui.
        </p>
      ) : (
        <ul className="max-h-[480px] space-y-1 overflow-y-auto pr-1 text-sm">
          {rolls.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-2 border-b border-border/60 py-1.5">
              <span className="min-w-0">
                <span className="block truncate font-display font-semibold uppercase">
                  {r.character_name || "—"}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {r.label} ·{" "}
                  {new Date(r.created_at).toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </span>
              <span className="flex shrink-0 items-baseline gap-2">
                <span className="tabular text-xs text-muted-foreground">
                  {r.die1}+{r.die2}+{r.modifier}
                </span>
                <span
                  className={cn(
                    "tabular font-display text-xl font-bold",
                    OUTCOME_CLASS[r.outcome as RollOutcome] ?? "",
                  )}
                  title={OUTCOME_TEXT[r.outcome as RollOutcome]}
                >
                  {r.total}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function GmNotes() {
  const { data: notes } = useSuspenseQuery(gmNotesQuery);
  const qc = useQueryClient();
  const save = useMutation({
    mutationFn: async (content: string) => {
      const { error } = await supabase.from("gm_notes").upsert({ id: 1, content });
      if (error) throw error;
    },
    onMutate: (content) => qc.setQueryData(["gm_notes"], content),
    onError: () => toast.error("Não foi possível salvar as notas."),
  });

  return (
    <section className="rounded-lg border border-border bg-card p-5 shadow-paint">
      <p className="label-caps text-primary">Sessão</p>
      <h2 className="mb-2 text-2xl font-bold uppercase">Notas do mestre</h2>
      <InlineField
        multiline
        label="Notas do mestre"
        value={notes}
        placeholder="Ganchos, NPCs, pistas, o que aconteceu na última sessão…"
        onSave={(v) => save.mutate(v)}
        className="min-h-40 border-border"
      />
      <p className="mt-1 text-xs text-muted-foreground">Salva quando você clica fora.</p>
    </section>
  );
}

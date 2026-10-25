import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Dices, Swords, Trash2 } from "lucide-react";

import { AvatarUpload } from "@/components/rpg/AvatarUpload";
import { InlineField } from "@/components/rpg/InlineField";
import { Stepper } from "@/components/rpg/Stepper";
import { Button } from "@/components/ui/button";
import { useMonsters } from "@/hooks/use-monsters";
import { ATTRIBUTE_THEME } from "@/lib/attribute-theme";
import { MONSTER_LIMITS } from "@/lib/combat";
import { logRolls } from "@/lib/roll-log";
import { monstersQuery } from "@/lib/rpg-queries";
import { ATTRIBUTES, ATTRIBUTE_MAX, ATTRIBUTE_MIN, roll2d6 } from "@/lib/skills";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/bestiario/$id")({
  loader: async ({ context, params }) => {
    const list = await context.queryClient.ensureQueryData(monstersQuery);
    const m = list.find((x) => x.id === params.id);
    if (!m) throw notFound();
    return { name: m.name };
  },
  head: ({ loaderData }) => {
    const title = loaderData ? `${loaderData.name} — Bestiário` : "Monstro — Bestiário";
    return {
      meta: [
        { title },
        { name: "description", content: "Perfil do monstro: quem era antes, atributos, PV, defesa, ataques e habilidades." },
        { property: "og:title", content: title },
        { property: "og:description", content: "Perfil de monstro do bestiário do Eco dos Caídos." },
        { property: "og:type", content: "profile" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  notFoundComponent: () => (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-5xl font-bold uppercase">Monstro não encontrado</h1>
      <Button asChild variant="paint">
        <Link to="/bestiario">Voltar ao bestiário</Link>
      </Button>
    </main>
  ),
  component: MonsterPage,
});

const STATS = [
  { key: "hp_max", label: "PV", ...MONSTER_LIMITS.hp },
  { key: "defense", label: "Defesa", ...MONSTER_LIMITS.defense },
  { key: "attack_bonus", label: "Ataque", ...MONSTER_LIMITS.attack },
  { key: "initiative_bonus", label: "Iniciativa", ...MONSTER_LIMITS.initiative },
] as const;

function MonsterPage() {
  const { id } = Route.useParams();
  const { data: monsters } = useSuspenseQuery(monstersQuery);
  const { update, remove } = useMonsters();
  const navigate = useNavigate();
  const m = monsters.find((x) => x.id === id);
  if (!m) return null;

  const save = (patch: Parameters<typeof update.mutate>[0]["patch"]) => update.mutate({ id, patch });
  const roll = (label: string, mod: number) =>
    void logRolls([{ characterId: null, characterName: m.name, label, result: roll2d6(mod, null) }]);

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-6 md:px-6 md:py-8">
      <div className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm">
          <Link to="/bestiario">
            <ArrowLeft /> Bestiário
          </Link>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-destructive"
          onClick={() => {
            if (!confirm(`Apagar ${m.name}? Ele sai também do combate.`)) return;
            remove.mutate(id);
            navigate({ to: "/bestiario" });
          }}
        >
          <Trash2 /> Apagar
        </Button>
      </div>

      <header className="flex items-center gap-4 border-b border-border pb-6 md:gap-6">
        <AvatarUpload src={m.avatar_url} name={m.name} tone="monster" onChange={(v) => save({ avatar_url: v })} />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="label-caps px-1 text-destructive">Monstro</p>
          <InlineField
            label="Nome do monstro"
            value={m.name}
            required
            onSave={(v) => save({ name: v })}
            className="h-auto px-1 font-display text-4xl font-bold uppercase leading-none md:text-6xl"
          />
          <InlineField
            label="Quem era antes"
            value={m.former_life}
            placeholder="Quem era antes? Ex.: Estivador do porto, pai de dois"
            onSave={(v) => save({ former_life: v })}
            className="px-1 italic"
          />
        </div>
      </header>

      <section className="rounded-lg border border-border bg-card p-5 shadow-paint">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-bold uppercase">Combate</h2>
          <Button variant="paint" onClick={() => roll("Ataque", m.attack_bonus)}>
            <Swords /> Rolar ataque
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.key} className="flex flex-col items-center gap-1 rounded-md border border-border p-3">
              <span className="label-caps text-muted-foreground">{s.label}</span>
              <Stepper
                size="lg"
                label={s.label}
                value={m[s.key]}
                min={s.min}
                max={s.max}
                onChange={(v) => save({ [s.key]: v })}
              />
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-1 text-2xl font-bold uppercase">O que restou da pessoa</h2>
        <p className="mb-3 text-sm text-muted-foreground">Atributos como os dos jogadores. Rolagem = 2d6 + atributo.</p>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {ATTRIBUTES.map((a) => {
            const t = ATTRIBUTE_THEME[a.key];
            return (
              <div key={a.key} className={cn("flex flex-col items-center gap-2 rounded-lg border p-3", t.border, t.panel)}>
                <span className={cn("label-caps", t.text)}>{a.name}</span>
                <Stepper
                  label={a.name}
                  value={m[a.key]}
                  min={ATTRIBUTE_MIN}
                  max={ATTRIBUTE_MAX}
                  onChange={(v) => save({ [a.key]: v })}
                />
                <Button size="sm" variant={t.button} onClick={() => roll(a.name, m[a.key])}>
                  <Dices /> Rolar
                </Button>
              </div>
            );
          })}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {(
          [
            ["description", "Descrição", "Aparência, cheiro, como se move…"],
            ["attacks", "Ataques", "Ex.: Mordida (2d6+3), Garras (1d6)"],
            ["abilities", "Habilidades", "Ex.: Regenera 2 PV por rodada"],
          ] as const
        ).map(([key, label, ph]) => (
          <div key={key} className="rounded-lg border border-border bg-card p-4 shadow-paint">
            <p className="label-caps mb-2 text-primary">{label}</p>
            <InlineField
              multiline
              label={label}
              value={m[key]}
              placeholder={ph}
              onSave={(v) => save({ [key]: v })}
              className="min-h-28 border-border"
            />
          </div>
        ))}
      </section>
    </main>
  );
}

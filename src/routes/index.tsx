import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, Users } from "lucide-react";

import heroImage from "@/assets/hero-harbor.jpg";
import { Avatar } from "@/components/rpg/AvatarUpload";
import { NewCharacterDialog } from "@/components/rpg/NewCharacterDialog";
import { ATTRIBUTE_THEME } from "@/lib/attribute-theme";
import { charactersQuery } from "@/lib/rpg-queries";
import { ATTRIBUTES } from "@/lib/skills";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Fungo Disco — Fichas de RPG" },
      {
        name: "description",
        content:
          "Fungo Disco: fichas de RPG no estilo Disco Elysium com skills, rolagem 2d6, corpo, armas e mochila, tudo ao vivo para a mesa.",
      },
      { property: "og:title", content: "Fungo Disco — Fichas de RPG" },
      {
        property: "og:description",
        content: "Personagens, skills, armas e mochila de cada jogador, sincronizados ao vivo.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(charactersQuery),
  component: Index,
});

function Index() {
  const { data: characters } = useSuspenseQuery(charactersQuery);

  return (
    <main className="min-h-screen">
      <section className="relative isolate overflow-hidden">
        <img
          src={heroImage}
          alt="Detetive olhando o porto de uma cidade decadente ao entardecer"
          width={1920}
          height={832}
          className="absolute inset-0 -z-10 h-full w-full object-cover"
        />
        <div className="absolute inset-0 -z-10 bg-hero-fade" />
        <div className="mx-auto flex min-h-[440px] max-w-6xl flex-col justify-end px-6 pb-12 pt-20">
          <p className="label-caps text-primary">Arquivo de personagens</p>
          <h1 className="mt-2 max-w-3xl text-6xl font-bold uppercase leading-[0.85] md:text-9xl">
            Fungo Disco
          </h1>
          <p className="mt-4 max-w-xl text-lg text-foreground/85">
            Cada ficha guarda atributos, skills, corpo, armas e a mochila do jogador — ao vivo
            para toda a mesa.
          </p>
          <div className="mt-8">
            <NewCharacterDialog />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="mb-6 flex items-baseline justify-between border-b border-border pb-3">
          <h2 className="text-3xl font-bold uppercase">Jogadores</h2>
          <span className="label-caps text-muted-foreground">{characters.length} fichas</span>
        </div>

        {characters.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-border py-16 text-center text-muted-foreground">
            <Users className="size-10" />
            <p className="italic">Nenhum personagem ainda. Crie o primeiro da mesa.</p>
            <NewCharacterDialog />
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {characters.map((c, i) => (
              <li key={c.id} className="animate-fade-up" style={{ animationDelay: `${i * 50}ms` }}>
                <Link
                  to="/personagem/$id"
                  params={{ id: c.id }}
                  className="group flex h-full flex-col justify-between rounded-lg border border-border bg-card p-5 shadow-paint transition-colors hover:border-primary"
                >
                  <div className="flex items-start gap-4">
                  <Avatar src={c.avatar_url} name={c.name} className="size-14 text-lg" />
                  <div className="min-w-0">
                    <p className="label-caps text-muted-foreground">
                      {c.player_name ? `Jogador: ${c.player_name}` : "Sem jogador"}
                    </p>
                    <h3 className="mt-1 truncate text-3xl font-bold uppercase leading-none group-hover:text-primary">
                      {c.name}
                    </h3>
                    {c.concept && (
                      <p className="mt-2 text-sm italic text-muted-foreground">{c.concept}</p>
                    )}
                  </div>
                  </div>
                  <div className="mt-6 flex items-end justify-between gap-2">
                    <div className="grid grid-cols-4 gap-1.5">
                      {ATTRIBUTES.map((a) => {
                        const theme = ATTRIBUTE_THEME[a.key];
                        return (
                          <span
                            key={a.key}
                            title={a.name}
                            className={cn("rounded-sm px-2 py-1 text-center font-display font-semibold", theme.soft, theme.text)}
                          >
                            <span className="block text-[10px] uppercase tracking-wider">
                              {a.name.slice(0, 3)}
                            </span>
                            <span className="tabular text-lg leading-none">{c[a.key]}</span>
                          </span>
                        );
                      })}
                    </div>
                    <ChevronRight className="size-5 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

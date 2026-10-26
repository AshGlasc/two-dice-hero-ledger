import { SKILL_ICONS } from "@/lib/attribute-theme";
import { supabase } from "@/integrations/supabase/client";
import type { Roll } from "@/lib/rpg-queries";
import { ALL_SKILLS } from "@/lib/skills";

/** Webhook salvo no banco (vale para todos os aparelhos da mesa). */
let cachedUrl = "";
let loaded: Promise<string> | null = null;

function publicImageUrl(value: string | undefined) {
  if (!value || value.startsWith("data:")) return undefined;
  try {
    return new URL(value, window.location.origin).href;
  } catch {
    return undefined;
  }
}

export function loadDiscordWebhookUrl(force = false) {
  if (!loaded || force) {
    loaded = (async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("discord_webhook")
        .eq("id", 1)
        .maybeSingle();
      cachedUrl = data?.discord_webhook ?? "";
      return cachedUrl;
    })();
  }
  return loaded;
}

export function getDiscordWebhookUrl() {
  return cachedUrl;
}

export async function saveDiscordWebhookUrl(value: string): Promise<string | null> {
  const url = value.trim();
  if (url) {
    try {
      const parsed = new URL(url);
      if (
        parsed.protocol !== "https:" ||
        !["discord.com", "discordapp.com", "ptb.discord.com", "canary.discord.com"].includes(
          parsed.hostname,
        ) ||
        !parsed.pathname.startsWith("/api/webhooks/")
      ) {
        return "Informe uma URL HTTPS válida de webhook do Discord.";
      }
    } catch {
      return "Informe uma URL HTTPS válida de webhook do Discord.";
    }
  }
  const { error } = await supabase
    .from("app_settings")
    .upsert({ id: 1, discord_webhook: url, updated_at: new Date().toISOString() });
  if (error) return "Não foi possível salvar o webhook.";
  cachedUrl = url;
  loaded = Promise.resolve(url);
  return null;
}

async function postWebhook(embeds: object[], attachment?: { blob: Blob; name: string }) {
  const url = await loadDiscordWebhookUrl();
  if (!url || embeds.length === 0) return;
  let body: BodyInit;
  let request: RequestInit;
  if (attachment) {
    const form = new FormData();
    form.append("payload_json", JSON.stringify({ embeds }));
    form.append("files[0]", attachment.blob, attachment.name);
    body = form;
    request = { method: "POST", body };
  } else {
    body = JSON.stringify({ embeds });
    request = { method: "POST", headers: { "Content-Type": "application/json" }, body };
  }
  const response = await fetch(url, request);
  if (!response.ok) throw new Error(`Discord respondeu com HTTP ${response.status}.`);
}

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

export async function postRollToDiscord(roll: Roll) {
  if (roll.hidden || !(await loadDiscordWebhookUrl())) return;
  const skill = ALL_SKILLS.find((item) => normalize(roll.label).includes(normalize(item.name)));
  let avatarUrl: string | undefined;
  if (roll.character_id) {
    const { data, error } = await supabase
      .from("characters")
      .select("avatar_url")
      .eq("id", roll.character_id)
      .maybeSingle();
    if (error) throw error;
    avatarUrl = data?.avatar_url || undefined;
  }
  const skillImage = skill ? publicImageUrl(SKILL_ICONS[skill.key]) : undefined;
  const avatar = publicImageUrl(avatarUrl);
  const avatarAttachment =
    !skillImage && avatarUrl?.startsWith("data:")
      ? { blob: await (await fetch(avatarUrl)).blob(), name: "personagem.jpg" }
      : undefined;
  const critical = roll.outcome === "critical-success" || roll.outcome === "critical-failure";
  const embed = {
    title: `${critical ? "✨ " : "🎲 "}${roll.character_name || "Desconhecido"} — ${roll.label}`,
    description: `**${roll.die1} + ${roll.die2} + ${roll.modifier} = ${roll.total}**`,
    color:
      roll.outcome === "critical-success" || roll.outcome === "success"
        ? 0x44aa77
        : roll.outcome === "critical-failure" || roll.outcome === "failure"
          ? 0xcc4455
          : 0xd49b34,
    fields: [
      ...(roll.difficulty === null
        ? []
        : [{ name: "Dificuldade", value: String(roll.difficulty), inline: true }]),
      { name: "Resultado", value: roll.outcome.replaceAll("-", " "), inline: true },
    ],
    ...(skillImage
      ? { image: { url: skillImage } }
      : avatar
        ? { thumbnail: { url: avatar } }
        : avatarAttachment
          ? { thumbnail: { url: `attachment://${avatarAttachment.name}` } }
          : {}),
    timestamp: roll.created_at,
  };
  await postWebhook([embed], avatarAttachment);
}

export async function postCombatStartToDiscord(
  combatants: { name: string; initiative: number | null }[],
) {
  if (!(await loadDiscordWebhookUrl())) return;
  const initiativeImage = publicImageUrl(SKILL_ICONS["velocidade_reacao"]);
  await postWebhook([
    {
      title: "⚔️ Combate iniciado",
      description: combatants
        .map(
          (combatant, index) =>
            `**${index + 1}. ${combatant.name}** — iniciativa ${combatant.initiative ?? "—"}`,
        )
        .join("\n")
        .slice(0, 4000),
      color: 0xb54234,
      ...(initiativeImage ? { image: { url: initiativeImage } } : {}),
      timestamp: new Date().toISOString(),
    },
  ]);
}

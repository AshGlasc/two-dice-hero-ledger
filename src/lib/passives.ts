// Subskills passivas (sem rolar), evolução de armas por nível e conteúdo de baús.

/** Valor passivo de uma skill: 6 (média de 2d6, arredondada para baixo) + total da skill. */
export const PASSIVE_BASE = 6;
export const passiveScore = (skillTotal: number) => PASSIVE_BASE + skillTotal;
export const passesPassive = (skillTotal: number, difficulty: number) =>
  passiveScore(skillTotal) >= difficulty;

/** Skills que o mestre consulta no roleplay para dar informação sem pedir rolagem. */
export const ROLEPLAY_PASSIVES = [
  { key: "logica", hint: "Percebe contradições e furos na história." },
  { key: "enciclopedia", hint: "Lembra um fato útil sobre o assunto, lugar ou objeto." },
  { key: "percepcao", hint: "Nota um detalhe escondido no ambiente." },
  { key: "empatia", hint: "Sente a intenção real ou a emoção de quem fala." },
  { key: "instinto", hint: "Pressente perigo ou emboscada antes de acontecer." },
] as const;

/** Limiar da Dor reduz dano físico: 4+ = −1, 8+ = −2. */
export function painReduction(limiarDor: number) {
  return limiarDor >= 8 ? 2 : limiarDor >= 4 ? 1 : 0;
}

/** Defesa mental passiva (melhor entre Vontade e Compostura) reduz dano mental/moral: 4+ = −1, 8+ = −2. */
export function mentalReduction(vontade: number, compostura: number) {
  return painReduction(Math.max(vontade, compostura));
}

/** A cada 2 níveis do personagem, armas e ataques ganham +1 de dano (nível 2 = +1, nível 4 = +2). */
export function levelDamageBonus(level: number | null | undefined) {
  return Math.floor(Math.max(1, level ?? 1) / 2);
}

export type ChestEntry = { uid: string; catalog_item_id: string; name: string };

/** Lê a lista de itens guardados num baú, ignorando entradas inválidas. */
export function parseChestItems(raw: unknown): ChestEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const e = entry as Record<string, unknown>;
    if (typeof e.catalog_item_id !== "string" || typeof e.uid !== "string") return [];
    return [{ uid: e.uid, catalog_item_id: e.catalog_item_id, name: String(e.name ?? "Item") }];
  });
}

export const removeChestEntry = (list: ChestEntry[], uid: string) =>
  list.filter((entry) => entry.uid !== uid);

import type { Character } from "@/lib/rpg-queries";

const STORAGE_KEY = "eco_caidos_player_character_id";

/** Retorna o ID do personagem criado pelo jogador neste navegador, se houver. */
export function getPlayerCharacterId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(STORAGE_KEY);
}

/** Registra que o jogador deste navegador é dono deste personagem. */
export function setPlayerCharacterId(id: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, id);
}

/** Limpa a referência de personagem local quando a ficha for apagada. */
export function clearPlayerCharacterId(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Checa se o usuário atual pode criar um novo personagem.
 * O mestre não possui restrição.
 * O jogador só pode ter 1 personagem por vez.
 */
export function checkCanCreateCharacter(
  characters: Character[],
  isMaster: boolean,
): { allowed: boolean; existingCharacter?: Character } {
  if (isMaster) {
    return { allowed: true };
  }

  const myId = getPlayerCharacterId();
  if (!myId) {
    return { allowed: true };
  }

  const existing = characters.find((c) => c.id === myId);
  if (existing) {
    return { allowed: false, existingCharacter: existing };
  }

  // Se o ID salvo não existe mais no banco (foi excluído), libera a criação
  clearPlayerCharacterId();
  return { allowed: true };
}

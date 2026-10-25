// Regras do Celular (funções puras, testadas em phone.test.ts).

export type PhoneMessage = {
  from_character_id: string | null;
  to_character_id: string | null;
};

/** Conversa "grupo" = mensagens sem destinatário. */
export const GROUP = "grupo";
/** Conversa com os NPCs do mestre. */
export const NPC = "npc";

/** A mensagem pertence à conversa entre `me` e `other` (ou ao grupo)? */
export function inConversation(m: PhoneMessage, me: string | null, other: string) {
  if (other === GROUP) return m.to_character_id === null;
  if (m.to_character_id === null) return false;
  // Conversa com o mestre/NPCs: o NPC manda sem remetente; o jogador responde "para si mesmo".
  if (other === NPC) return m.to_character_id === me && (m.from_character_id === null || m.from_character_id === me);
  if (m.from_character_id === m.to_character_id) return false;
  return (
    (m.from_character_id === me && m.to_character_id === other) ||
    (m.from_character_id === other && m.to_character_id === me)
  );
}

/** Erro de um Pix antes de mandar para o servidor (o servidor confere de novo). */
export function transferError(balance: number, amount: number, from: string | null, to: string | null) {
  if (!from) return "Escolha seu personagem primeiro.";
  if (!to) return "Escolha para quem enviar.";
  if (from === to) return "Não dá para enviar para si mesmo.";
  if (!Number.isInteger(amount) || amount <= 0) return "Digite um valor maior que zero.";
  if (amount > balance) return "Saldo insuficiente.";
  return null;
}

export const formatMoney = (v: number) => `$${v.toLocaleString("pt-BR")}`;

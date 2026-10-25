import { describe, expect, it } from "vitest";

import { fillFog, tokenVisible } from "@/lib/combat";
import {
  formatMoney,
  GROUP,
  inConversation,
  NPC,
  transferError,
  unreadPhoneMessages,
} from "@/lib/phone";
import { shouldAnnounce } from "@/lib/silent-roll";

describe("Transferências em rupias", () => {
  it("formata o saldo em rupias indonésias", () => {
    expect(formatMoney(1000)).toContain("Rp");
  });

  it("não deixa enviar mais do que o saldo", () => {
    expect(transferError(50, 51, "a", "b")).toBe("Saldo insuficiente em rupias.");
    expect(transferError(50, 50, "a", "b")).toBeNull();
  });

  describe("Mensagens não lidas", () => {
    it("conta mensagens e transferências recebidas depois da última leitura", () => {
      const messages = [
        { from_character_id: "b", to_character_id: "a", created_at: "2026-01-02T00:00:00Z" },
        { from_character_id: "b", to_character_id: "a", created_at: "2026-01-04T00:00:00Z" },
        { from_character_id: "a", to_character_id: "a", created_at: "2026-01-05T00:00:00Z" },
        { from_character_id: "b", to_character_id: null, created_at: "2026-01-06T00:00:00Z" },
      ];
      expect(unreadPhoneMessages(messages, "a", "2026-01-03T00:00:00Z")).toBe(2);
      expect(unreadPhoneMessages(messages, null, "2026-01-03T00:00:00Z")).toBe(0);
    });
  });
  it("não deixa enviar para si mesmo nem valor zero", () => {
    expect(transferError(50, 10, "a", "a")).toBe("Não dá para enviar para si mesmo.");
    expect(transferError(50, 0, "a", "b")).toBe("Digite um valor maior que zero.");
  });
});

describe("Mensagens", () => {
  it("conversa privada só tem as mensagens entre os dois", () => {
    expect(inConversation({ from_character_id: "a", to_character_id: "b" }, "b", "a")).toBe(true);
    expect(inConversation({ from_character_id: "a", to_character_id: "c" }, "b", "a")).toBe(false);
    expect(inConversation({ from_character_id: "a", to_character_id: null }, "b", GROUP)).toBe(
      true,
    );
  });
  it("conversa com NPC: mensagem do mestre e resposta do jogador ficam juntas, e só dele", () => {
    expect(inConversation({ from_character_id: null, to_character_id: "b" }, "b", NPC)).toBe(true);
    expect(inConversation({ from_character_id: "b", to_character_id: "b" }, "b", NPC)).toBe(true);
    expect(inConversation({ from_character_id: null, to_character_id: "c" }, "b", NPC)).toBe(false);
    expect(inConversation({ from_character_id: "b", to_character_id: "b" }, "a", "b")).toBe(false);
  });
});

describe("Névoa", () => {
  it("jogador não vê monstro na névoa, mas vê o próprio rosto; mestre vê tudo", () => {
    const fog = fillFog(2, 2);
    expect(tokenVisible(fog, 1, 1, false, false)).toBe(false);
    expect(tokenVisible(fog, 1, 1, false, true)).toBe(true);
    expect(tokenVisible(fog, 1, 1, true, false)).toBe(true);
    expect(tokenVisible({}, 1, 1, false, false)).toBe(true);
  });
});

describe("Rolagem silenciosa", () => {
  it("só o mestre recebe o aviso de uma rolagem silenciosa de outra tela", () => {
    expect(shouldAnnounce({ hidden: true }, false)).toBe(false);
    expect(shouldAnnounce({ hidden: true }, true)).toBe(true);
    expect(shouldAnnounce({ hidden: false }, false)).toBe(true);
  });
});

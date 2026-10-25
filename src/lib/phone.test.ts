import { describe, expect, it } from "vitest";

import { fillFog, tokenVisible } from "@/lib/combat";
import { GROUP, inConversation, transferError } from "@/lib/phone";
import { shouldAnnounce } from "@/lib/silent-roll";

describe("Pix", () => {
  it("não deixa enviar mais do que o saldo", () => {
    expect(transferError(50, 51, "a", "b")).toBe("Saldo insuficiente.");
    expect(transferError(50, 50, "a", "b")).toBeNull();
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
    expect(inConversation({ from_character_id: "a", to_character_id: null }, "b", GROUP)).toBe(true);
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

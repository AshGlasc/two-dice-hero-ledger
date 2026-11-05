export type NpcField = "avatar" | "name" | "occupation" | "appearance" | "trait" | "secret" | "stats";

export type NpcStats = { hp: number; defense: number; attack: number; damage: string };

export type Npc = {
  avatarSeed: string;
  avatarUrl: string;
  name: string;
  occupation: string;
  appearance: string;
  trait: string;
  secret: string;
  stats: NpcStats;
};

const FIRST = ["Vitor", "Lídia", "Ozório", "Marta", "Caetano", "Irene", "Bento", "Celeste", "Dorival", "Nádia", "Ramiro", "Judite", "Teobaldo", "Vera", "Anselmo", "Clotilde"];
const LAST = ["Ramos", "Cardoso", "Vilela", "Prado", "Fontes", "Moura", "Bastos", "Seixas", "Lacerda", "Toledo", "Brandão", "Paiva"];
const NICK = ["Cinzeiro", "Ferrugem", "Mofo", "Gaveta", "Sereno", "Bigorna", "Fumaça", "Esporo", "Trinca", "Lamparina", "Sete-Vidas", "Pelúcia"];
const OCCUPATION = ["Porteiro de cortiço falido", "Vendedora de bilhetes de loteria", "Estivador sindicalizado", "Ex-policial expulso", "Farmacêutica de balcão", "Pregador de esquina", "Mecânico de bondes", "Contrabandista de esporos", "Garçonete do bar do porto", "Jornalista de tabloide", "Agiota do bairro", "Coveiro noturno", "Músico de cabaré", "Catador de sucata"];
const APPEARANCE = ["Dentes manchados de fumo e tosse seca constante", "Casaco dois números maior, cheira a mofo", "Olho de vidro que não acompanha o outro", "Unhas pretas de graxa, sorriso fácil", "Cicatriz de queimadura no pescoço", "Óculos rachados presos com fita", "Sempre molhado, como se tivesse saído da chuva", "Tatuagem de cogumelo desbotada no antebraço", "Fala baixo e evita contato visual", "Perfume barato em excesso"];
const TRAIT = ["Mente por reflexo, mesmo sem motivo", "Leal até o osso a quem pagar a próxima dose", "Desconfia de qualquer pessoa de uniforme", "Coleciona fofocas como moedas", "Ri nervosamente quando ameaçado", "Generoso com crianças, cruel com adultos", "Tem medo genuíno do escuro", "Fala da mãe morta como se estivesse viva"];
const SECRET = ["Deve dinheiro a um agiota perigoso", "Viu o assassinato e ficou calado", "É informante da polícia", "Esconde um parente infectado pelo fungo no porão", "Roubou a arma que carrega", "Já foi alguém importante e mudou de nome", "Trabalha secretamente para o sindicato rival", "Sabe onde está o corpo"];
const WEAPON = ["1d4", "1d6", "1d6", "1d8", "2d4"];

function pick<T>(arr: T[], rnd: () => number = Math.random): T {
  return arr[Math.floor(rnd() * arr.length)] as T;
}

export function avatarUrlFor(seed: string) {
  return `https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(seed)}&backgroundColor=d9c7a3,b9c4c9,c9b0a8`;
}

export function rollNpcField(field: NpcField, npc: Npc, rnd: () => number = Math.random): Npc {
  switch (field) {
    case "avatar": {
      const seed = Math.floor(rnd() * 1e9).toString(36);
      return { ...npc, avatarSeed: seed, avatarUrl: avatarUrlFor(seed) };
    }
    case "name":
      return { ...npc, name: `${pick(FIRST, rnd)} "${pick(NICK, rnd)}" ${pick(LAST, rnd)}` };
    case "occupation":
      return { ...npc, occupation: pick(OCCUPATION, rnd) };
    case "appearance":
      return { ...npc, appearance: pick(APPEARANCE, rnd) };
    case "trait":
      return { ...npc, trait: pick(TRAIT, rnd) };
    case "secret":
      return { ...npc, secret: pick(SECRET, rnd) };
    case "stats":
      return {
        ...npc,
        stats: {
          hp: 6 + Math.floor(rnd() * 10),
          defense: 8 + Math.floor(rnd() * 5),
          attack: Math.floor(rnd() * 4),
          damage: pick(WEAPON, rnd),
        },
      };
  }
}

export const NPC_FIELDS: NpcField[] = ["avatar", "name", "occupation", "appearance", "trait", "secret", "stats"];

export function emptyNpc(): Npc {
  return { avatarSeed: "", avatarUrl: "", name: "", occupation: "", appearance: "", trait: "", secret: "", stats: { hp: 10, defense: 10, attack: 0, damage: "1d6" } };
}

/** Rerolls every field not in `locked`. */
export function rollNpc(npc: Npc, locked: Set<NpcField>, rnd: () => number = Math.random): Npc {
  return NPC_FIELDS.reduce((acc, f) => (locked.has(f) ? acc : rollNpcField(f, acc, rnd)), npc);
}

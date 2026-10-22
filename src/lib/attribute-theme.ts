import type { AttributeKey } from "@/lib/skills";

import logica from "@/assets/skills/logica.jpg";
import enciclopedia from "@/assets/skills/enciclopedia.jpg";
import retorica from "@/assets/skills/retorica.jpg";
import drama from "@/assets/skills/drama.jpg";
import conceptualizacao from "@/assets/skills/conceptualizacao.jpg";
import calculo_visual from "@/assets/skills/calculo_visual.jpg";
import vontade from "@/assets/skills/vontade.jpg";
import imperio_interior from "@/assets/skills/imperio_interior.jpg";
import empatia from "@/assets/skills/empatia.jpg";
import tecnica from "@/assets/skills/tecnica.jpg";
import sugestao from "@/assets/skills/sugestao.jpg";
import vigor from "@/assets/skills/vigor.jpg";
import limiar_dor from "@/assets/skills/limiar_dor.jpg";
import eletroquimica from "@/assets/skills/eletroquimica.jpg";
import instinto from "@/assets/skills/instinto.jpg";
import calafrios from "@/assets/skills/calafrios.jpg";
import ferramenta_fisica from "@/assets/skills/ferramenta_fisica.jpg";
import coordenacao_motora from "@/assets/skills/coordenacao_motora.jpg";
import velocidade_reacao from "@/assets/skills/velocidade_reacao.jpg";
import percepcao from "@/assets/skills/percepcao.jpg";
import interacao from "@/assets/skills/interacao.jpg";
import compostura from "@/assets/skills/compostura.jpg";

/** Retrato pintado de cada skill. Skills sem retrato usam um ícone desenhado. */
export const SKILL_ICONS: Record<string, string | undefined> = {
  logica,
  enciclopedia,
  retorica,
  drama,
  conceptualizacao,
  calculo_visual,
  vontade,
  imperio_interior,
  empatia,
  tecnica,
  sugestao,
  vigor,
  limiar_dor,
  eletroquimica,
  instinto,
  calafrios,
  ferramenta_fisica,
  coordenacao_motora,
  velocidade_reacao,
  percepcao,
  interacao,
  compostura,
};

type Theme = {
  text: string;
  border: string;
  panel: string;
  soft: string;
  button: "intellect" | "psyche" | "physique" | "motorics";
};

export const ATTRIBUTE_THEME: Record<AttributeKey, Theme> = {
  intelecto: {
    text: "text-intellect",
    border: "border-intellect/40",
    panel: "bg-intellect-panel",
    soft: "bg-intellect-soft",
    button: "intellect",
  },
  psique: {
    text: "text-psyche",
    border: "border-psyche/40",
    panel: "bg-psyche-panel",
    soft: "bg-psyche-soft",
    button: "psyche",
  },
  fisico: {
    text: "text-physique",
    border: "border-physique/40",
    panel: "bg-physique-panel",
    soft: "bg-physique-soft",
    button: "physique",
  },
  motor: {
    text: "text-motorics",
    border: "border-motorics/40",
    panel: "bg-motorics-panel",
    soft: "bg-motorics-soft",
    button: "motorics",
  },
};

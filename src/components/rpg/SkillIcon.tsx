import { Crown, Hand } from "lucide-react";

import { ATTRIBUTE_THEME, SKILL_ICONS } from "@/lib/attribute-theme";
import type { AttributeKey } from "@/lib/skills";
import { cn } from "@/lib/utils";

const FALLBACK: Record<string, React.ReactNode> = {
  autoridade: <Crown />,
  mao_leve: <Hand />,
};

export function SkillIcon({
  skillKey,
  attribute,
  name,
  className,
}: {
  skillKey: string;
  attribute: AttributeKey;
  name: string;
  className?: string;
}) {
  const theme = ATTRIBUTE_THEME[attribute];
  const src = SKILL_ICONS[skillKey];
  return (
    <div
      className={cn(
        "relative h-[72px] w-14 shrink-0 overflow-hidden rounded-sm border-2 shadow-paint",
        theme.border,
        className,
      )}
    >
      {src ? (
        <img
          src={src}
          alt={name}
          loading="lazy"
          width={56}
          height={72}
          className="h-full w-full object-cover"
        />
      ) : (
        <div
          role="img"
          aria-label={name}
          className={cn("flex h-full w-full items-center justify-center [&_svg]:size-7", theme.soft, theme.text)}
        >
          {FALLBACK[skillKey]}
        </div>
      )}
    </div>
  );
}

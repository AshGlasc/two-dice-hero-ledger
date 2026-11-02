import { useEffect, useState } from "react";

import { MonsterBodyPicker } from "@/components/rpg/MonsterBodyPicker";
import { Button } from "@/components/ui/button";
import { monsterBodyType, type MonsterBodyType } from "@/lib/monster-body";

type Props = {
  bodyType: string;
  bodyParts: string[];
  isSaving: boolean;
  onSave: (bodyType: MonsterBodyType, bodyParts: string[]) => void;
};

export function MonsterBodyEditor({ bodyType, bodyParts, isSaving, onSave }: Props) {
  const [draftType, setDraftType] = useState<MonsterBodyType>(monsterBodyType(bodyType));
  const [draftParts, setDraftParts] = useState(bodyParts);

  useEffect(() => {
    setDraftType(monsterBodyType(bodyType));
    setDraftParts(bodyParts);
  }, [bodyType, bodyParts]);

  const changed =
    draftType !== bodyType ||
    draftParts.length !== bodyParts.length ||
    draftParts.some((part, index) => part !== bodyParts[index]);

  return (
    <div className="space-y-3">
      <MonsterBodyPicker
        bodyType={draftType}
        bodyParts={draftParts}
        onChange={(type, parts) => {
          setDraftType(type);
          setDraftParts(parts);
        }}
      />
      {changed && (
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={isSaving}
            onClick={() => {
              setDraftType(monsterBodyType(bodyType));
              setDraftParts(bodyParts);
            }}
          >
            Descartar
          </Button>
          <Button
            type="button"
            variant="paint"
            disabled={isSaving}
            onClick={() => onSave(draftType, draftParts)}
          >
            {isSaving ? "Salvando..." : "Salvar anatomia"}
          </Button>
        </div>
      )}
    </div>
  );
}

import { useEffect, useState } from "react";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type InlineFieldProps = {
  value: string;
  onSave: (value: string) => void;
  placeholder?: string;
  label: string;
  multiline?: boolean;
  required?: boolean;
  className?: string;
};

/** Campo que salva sozinho quando você sai dele. */
export function InlineField({
  value,
  onSave,
  placeholder,
  label,
  multiline,
  required,
  className,
}: InlineFieldProps) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  const commit = () => {
    const next = draft.trim();
    if (required && !next) {
      setDraft(value);
      return;
    }
    if (next !== value) onSave(next);
  };

  const shared = {
    "aria-label": label,
    value: draft,
    placeholder,
    onBlur: commit,
    className: cn(
      "border-transparent bg-transparent shadow-none hover:border-border focus-visible:border-primary focus-visible:ring-0",
      className,
    ),
  };

  if (multiline) {
    return <Textarea {...shared} rows={4} onChange={(e) => setDraft(e.target.value)} />;
  }
  return (
    <Input
      {...shared}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
    />
  );
}

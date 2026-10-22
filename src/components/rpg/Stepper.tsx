import { Minus, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type StepperProps = {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  label: string;
  size?: "sm" | "lg";
  className?: string;
};

export function Stepper({ value, min, max, onChange, label, size = "sm", className }: StepperProps) {
  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <Button
        type="button"
        variant="stepper"
        size="icon"
        className={size === "sm" ? "h-7 w-7" : "h-9 w-9"}
        aria-label={`Diminuir ${label}`}
        disabled={value <= min}
        onClick={() => onChange(value - 1)}
      >
        <Minus />
      </Button>
      <span
        className={cn(
          "tabular min-w-8 text-center font-display font-semibold",
          size === "sm" ? "text-lg" : "text-3xl",
        )}
        aria-label={label}
      >
        {value}
      </span>
      <Button
        type="button"
        variant="stepper"
        size="icon"
        className={size === "sm" ? "h-7 w-7" : "h-9 w-9"}
        aria-label={`Aumentar ${label}`}
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
      >
        <Plus />
      </Button>
    </div>
  );
}

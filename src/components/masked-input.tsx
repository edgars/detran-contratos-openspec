"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { applyMask } from "@/lib/mask";
import { cn } from "@/lib/utils";

type MaskedInputProps = Omit<React.ComponentProps<typeof Input>, "onChange" | "value"> & {
  mask: string;
  value: string;
  onValueChange: (value: string) => void;
};

/** Input do shadcn/ui com máscara (`#` dígito, `A` letra), formatando enquanto o usuário digita. */
export function MaskedInput({ mask, value, onValueChange, className, ...props }: MaskedInputProps) {
  return (
    <Input
      autoComplete="off"
      spellCheck={false}
      {...props}
      // Dígitos de largura fixa: CPF, CEP e datas não "dançam" enquanto o usuário digita.
      className={cn("tabular-nums", className)}
      inputMode={mask.includes("A") ? "text" : "numeric"}
      maxLength={mask.length}
      placeholder={props.placeholder ?? mask.replace(/#/g, "0")}
      value={value}
      onChange={(event) => onValueChange(applyMask(event.target.value, mask))}
    />
  );
}

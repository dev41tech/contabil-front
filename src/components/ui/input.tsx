import * as React from "react"
import { cn } from "@/lib/utils"

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /**
   * Variante enxuta para barras de ferramentas (busca ao lado de botões de
   * filtro), onde o campo de formulário — 36px e 16px de fonte — destoa dos
   * controles de 32px em volta.
   */
  compact?: boolean
}

// 16px no campo de formulário não é capricho: abaixo disso o Safari no iOS dá
// zoom ao focar. Onde se digita de verdade, vale pagar o tamanho.
const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, compact = false, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex w-full rounded-md border border-border-strong bg-input-bg px-3 text-foreground transition-colors",
          "file:border-0 file:bg-transparent file:text-sm file:font-medium",
          "placeholder:text-muted-foreground",
          "focus:border-brand focus-visible:outline-none",
          "disabled:cursor-not-allowed disabled:opacity-[0.45]",
          compact ? "h-8 text-sm" : "h-9 text-card-title",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }

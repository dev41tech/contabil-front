import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

// Pílula do Connect: fundo tingido, texto na cor cheia, borda a 40%.
// As variantes de estado antes eram bg-green-100/bg-yellow-100 cravados —
// invisíveis no tema escuro. Agora saem dos tokens e trocam de tema sozinhas.
const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-1 text-badge font-semibold transition-colors focus:outline-none",
  {
    variants: {
      variant: {
        default: "border-transparent bg-brand text-on-brand",
        secondary: "border-transparent bg-surface-hover text-fg-secondary",
        destructive: "border-danger/40 bg-danger/15 text-danger",
        outline: "border-border-strong text-fg-secondary",
        success: "border-success/40 bg-success/15 text-success",
        warning: "border-warning/40 bg-warning/15 text-warning",
        info: "border-info/40 bg-info/15 text-info",
      },
    },
    defaultVariants: { variant: "default" },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }

import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

// Anatomia do Button do Connect (connect-41/src/components/ui/Button.tsx):
// md = h-9 px-4 com texto de 13px, peso 600, raio 10px.
//
// secondary e danger não têm fundo em repouso — só borda, e ganham fundo no
// hover. É o que o app real usa em Cancelar e Excluir; o preenchimento sólido
// ficou só para a ação primária, uma por tela.
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md font-semibold transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-[0.45]",
  {
    variants: {
      variant: {
        default: "bg-brand text-on-brand hover:bg-brand-hover",
        destructive: "border border-danger/30 text-danger hover:bg-danger/10",
        outline: "border border-border-strong text-foreground hover:bg-surface-hover",
        secondary: "border border-border-strong text-foreground hover:bg-surface-hover",
        ghost: "text-fg-secondary hover:bg-surface-hover hover:text-foreground",
        link: "text-brand underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 text-sm",
        xs: "h-7 px-2.5 text-sm",
        sm: "h-8 px-3 text-sm",
        lg: "h-9 px-6 text-sm",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }

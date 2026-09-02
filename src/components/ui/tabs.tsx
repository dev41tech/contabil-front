import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"
import { cn } from "@/lib/utils"

const Tabs = TabsPrimitive.Root

// Abas do Connect: barra inferior de 2px na aba ativa, mesma linguagem da
// barra lateral do item ativo da sidebar. Não é o segmented control cinza do
// shadcn — o app tem abas de navegação, não um toggle de duas opções.
const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn("flex items-center gap-1 overflow-x-auto border-b border-border", className)}
    {...props}
  />
))
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "relative flex h-10 items-center gap-1.5 whitespace-nowrap rounded-t-md px-3.5 text-label font-medium transition-colors",
      "text-fg-secondary hover:text-foreground",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40",
      "disabled:pointer-events-none disabled:opacity-[0.45]",
      "data-[state=active]:text-brand",
      "after:absolute after:inset-x-2.5 after:-bottom-px after:h-[2px] after:rounded-full after:bg-brand after:opacity-0 data-[state=active]:after:opacity-100",
      className
    )}
    {...props}
  >
    {children}
  </TabsPrimitive.Trigger>
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn("mt-4 focus-visible:outline-none", className)}
    {...props}
  />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }

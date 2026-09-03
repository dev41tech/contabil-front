/**
 * SearchableSelect — combobox com campo de busca + scroll + teclado.
 *
 * Drop-in substituto para shadcn/Select quando a lista é longa.
 * Sem dependências externas além do que já está no projeto.
 */
import * as React from 'react'
import { ChevronDown, Check, Search } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SearchableSelectOption {
  value: string
  label: string
  /**
   * Segunda linha, em texto menor — e que TAMBÉM entra na busca. É o que
   * permite ao rótulo mostrar um identificador (o número da conta) sem tirar
   * o outro (a classificação) do alcance de quem digita.
   */
  sublabel?: string
}

interface SearchableSelectProps {
  value: string
  onValueChange: (value: string) => void
  options: SearchableSelectOption[]
  placeholder?: string
  searchPlaceholder?: string
  disabled?: boolean
  className?: string
  emptyText?: string
  /** Para o `htmlFor` de um <Label> externo apontar para o gatilho. */
  id?: string
  /** Quando não há rótulo visível ao lado. */
  'aria-label'?: string
  /** Id do elemento que rotula este campo. */
  'aria-labelledby'?: string
}

export function SearchableSelect({
  value,
  onValueChange,
  options,
  placeholder = 'Selecione...',
  searchPlaceholder = 'Buscar...',
  disabled = false,
  className,
  emptyText = 'Nenhum resultado.',
  id,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
}: SearchableSelectProps) {
  // Ids estáveis para amarrar gatilho, listbox e opção ativa. Sem isso o
  // leitor de tela anunciava "botão" e nunca a opção sob o cursor.
  const uid = React.useId()
  const listboxId = `${uid}-listbox`
  const opcaoId = (idx: number) => `${uid}-opcao-${idx}`
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState('')
  const [activeIdx, setActiveIdx] = React.useState(-1)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const listRef = React.useRef<HTMLDivElement>(null)

  const selectedLabel = options.find(o => o.value === value)?.label

  const filtered = React.useMemo(() => {
    const q = search.toLowerCase()
    return options.filter(
      o => o.label.toLowerCase().includes(q) || (o.sublabel ?? '').toLowerCase().includes(q),
    )
  }, [options, search])

  // Fecha ao clicar fora
  React.useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch('')
      }
    }
    if (open) document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [open])

  // Foca o input ao abrir
  React.useEffect(() => {
    if (open) {
      setActiveIdx(-1)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  // Scroll do item ativo para dentro da view
  React.useEffect(() => {
    if (activeIdx < 0 || !listRef.current) return
    const item = listRef.current.children[activeIdx] as HTMLElement | undefined
    item?.scrollIntoView({ block: 'nearest' })
  }, [activeIdx])

  function handleTriggerKeyDown(e: React.KeyboardEvent) {
    if (['Enter', ' ', 'ArrowDown'].includes(e.key)) {
      e.preventDefault()
      setOpen(true)
    }
  }

  function handleInputKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      setOpen(false)
      setSearch('')
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx(i => Math.min(i + 1, filtered.length - 1))
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx(i => Math.max(i - 1, 0))
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      if (activeIdx >= 0 && filtered[activeIdx]) {
        onValueChange(filtered[activeIdx].value)
        setOpen(false)
        setSearch('')
      } else if (filtered.length === 1) {
        onValueChange(filtered[0].value)
        setOpen(false)
        setSearch('')
      }
    }
  }

  function selectOption(val: string) {
    onValueChange(val)
    setOpen(false)
    setSearch('')
  }

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {/* Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(o => !o)}
        onKeyDown={handleTriggerKeyDown}
        id={id}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        className={cn(
          'flex h-9 w-full items-center justify-between rounded-md border border-input bg-input-bg px-3 py-2 text-sm',
          'ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-50',
          !selectedLabel && 'text-muted-foreground',
        )}
      >
        <span className="truncate">{selectedLabel ?? placeholder}</span>
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 opacity-50 ml-2 transition-transform duration-150',
            open && 'rotate-180',
          )}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full min-w-[8rem] rounded-md border border-border bg-popover text-popover-foreground shadow-md">
          {/* Search box */}
          <div className="flex items-center border-b px-3">
            <Search className="h-4 w-4 shrink-0 opacity-40 mr-2" />
            <input
              ref={inputRef}
              value={search}
              onChange={e => { setSearch(e.target.value); setActiveIdx(-1) }}
              onKeyDown={handleInputKeyDown}
              placeholder={searchPlaceholder}
              role="combobox"
              aria-expanded
              aria-controls={listboxId}
              aria-autocomplete="list"
              aria-label={searchPlaceholder}
              aria-activedescendant={activeIdx >= 0 ? opcaoId(activeIdx) : undefined}
              className="flex h-9 w-full bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>

          {/* Option list */}
          <div ref={listRef} id={listboxId} className="max-h-60 overflow-y-auto p-1" role="listbox">
            {filtered.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">{emptyText}</p>
            ) : (
              filtered.map((option, idx) => (
                <div
                  key={option.value}
                  id={opcaoId(idx)}
                  role="option"
                  aria-selected={option.value === value}
                  onClick={() => selectOption(option.value)}
                  onMouseEnter={() => setActiveIdx(idx)}
                  className={cn(
                    'relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none',
                    'hover:bg-accent hover:text-accent-foreground',
                    idx === activeIdx && 'bg-accent text-accent-foreground',
                  )}
                >
                  <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                    {option.value === value && <Check className="h-4 w-4" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{option.label}</span>
                    {option.sublabel && (
                      <span className="block truncate text-xs text-muted-foreground">
                        {option.sublabel}
                      </span>
                    )}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

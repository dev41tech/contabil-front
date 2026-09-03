import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Search } from 'lucide-react'

export interface ComboOption { value: string; label: string; sublabel?: string }

export function SearchableCombobox({
  options, value, onChange, placeholder = 'Selecione...',
}: {
  options: ComboOption[]
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const filtered = useMemo(() => {
    if (!search.trim()) return options
    const q = search.toLowerCase()
    return options.filter(o =>
      o.label.toLowerCase().includes(q) || (o.sublabel ?? '').toLowerCase().includes(q)
    )
  }, [options, search])

  const selected = options.find(o => o.value === value)

  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleOpen = useCallback(() => {
    setOpen(true)
    setSearch('')
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [])

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={handleOpen}
        className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-input-bg px-3 py-2 text-sm hover:bg-muted/30 transition-colors"
      >
        <span className={`truncate ${selected ? 'text-foreground' : 'text-muted-foreground'}`}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown className="h-4 w-4 opacity-50 shrink-0 ml-2" />
      </button>

      {open && (
        <div className="absolute z-[200] w-full mt-1 bg-popover text-popover-foreground border rounded-md shadow-xl">
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                ref={inputRef}
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar conta..."
                className="w-full pl-7 pr-3 py-1.5 text-sm border rounded bg-muted/30 focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>
          <div className="max-h-56 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground p-3 text-center">Nenhum resultado</p>
            ) : (
              <>
                {filtered.slice(0, 200).map(o => (
                  <div
                    key={o.value}
                    onMouseDown={e => {
                      e.preventDefault()
                      onChange(o.value)
                      setOpen(false)
                      setSearch('')
                    }}
                    className={`px-3 py-2 text-sm cursor-pointer hover:bg-muted/60 transition-colors ${value === o.value ? 'bg-brand/10 font-medium text-brand' : ''}`}
                  >
                    <div className="font-medium truncate">{o.label}</div>
                    {o.sublabel && <div className="text-xs text-muted-foreground truncate">{o.sublabel}</div>}
                  </div>
                ))}
                {filtered.length > 200 && (
                  <p className="text-xs text-muted-foreground text-center py-2 border-t">
                    {filtered.length - 200} resultados ocultados. Refine a busca.
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}


import { useEffect, useRef, useState, type ReactNode } from 'react'
import { CaretDownIcon, CheckIcon } from '@phosphor-icons/react'
import { Button } from './Button'

export function Accordion({ id, label, children, initialOpen = false }: { id: string; label: string; children: ReactNode; initialOpen?: boolean }) {
  const [open, setOpen] = useState(initialOpen)
  return <div className="ui-accordion"><Button className="accordion-trigger" aria-expanded={open} aria-controls={`${id}-panel`} onClick={() => setOpen(!open)}>{label}<CaretDownIcon size={18} aria-hidden="true" /></Button><div id={`${id}-panel`} className="accordion-panel" data-open={open} aria-hidden={!open} inert={!open}><div className="accordion-content">{children}</div></div></div>
}

export function AccordionSelect({ id, label, value, options, onChange, disabled = false, hideLabel = false, 'aria-invalid': invalid, 'aria-describedby': describedBy }: { disabled?: boolean; hideLabel?: boolean; 'aria-invalid'?: boolean; 'aria-describedby'?: string; id: string; label: string; value: string; options: { value: string; label: string }[]; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!open) return
    const dismiss = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false) }
    document.addEventListener('pointerdown', dismiss)
    return () => document.removeEventListener('pointerdown', dismiss)
  }, [open])
  return <div className="field accordion-select" ref={root} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false) }} onKeyDown={event => { if (event.key === 'Escape' && open) { event.preventDefault(); setOpen(false); trigger.current?.focus() } }}>
    <span id={`${id}-label`} className={hideLabel ? 'sr-only' : 'accordion-label'}>{label}</span>
    <Button id={id} ref={trigger} disabled={disabled} data-value={value} aria-invalid={invalid} aria-describedby={describedBy} className="accordion-trigger" aria-labelledby={`${id}-label ${id}-value`} aria-expanded={open} aria-controls={`${id}-options`} onClick={() => setOpen(!open)}><span id={`${id}-value`}>{options.find(option => option.value === value)?.label}</span><CaretDownIcon size={18} aria-hidden="true" /></Button>
    <div id={`${id}-options`} className="accordion-options" hidden={!open} role="group" aria-labelledby={`${id}-label`}>
      {options.map(option => <Button key={option.value} data-option-value={option.value} className="accordion-option" disabled={disabled} aria-pressed={option.value === value} onClick={() => { onChange(option.value); setOpen(false); trigger.current?.focus() }}>{option.label}{option.value === value && <CheckIcon size={17} aria-hidden="true" />}</Button>)}
    </div>
  </div>
}

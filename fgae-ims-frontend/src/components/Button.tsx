import { useEffect, useRef, useState, type ComponentProps, type CSSProperties } from 'react'

type Ripple = { id: number; x: number; y: number; size: number }

// Shared by each approved page as it is built. Feedback never delays the action.
export function Button({ children, className = '', onPointerDown, onClick, type = 'button', ...props }: ComponentProps<'button'>) {
  const [ripple, setRipple] = useState<Ripple | null>(null)
  const sequence = useRef(0)

  useEffect(() => {
    if (!ripple) return
    const timer = window.setTimeout(() => setRipple(null), 600)
    return () => window.clearTimeout(timer)
  }, [ripple])

  function pulse(button: HTMLButtonElement, point?: { x: number; y: number }) {
    if (button.disabled || button.getAttribute('aria-disabled') === 'true' ||
        window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const bounds = button.getBoundingClientRect()
    const x = point ? point.x - bounds.left : bounds.width / 2
    const y = point ? point.y - bounds.top : bounds.height / 2
    const radius = Math.hypot(Math.max(x, bounds.width - x), Math.max(y, bounds.height - y))
    setRipple({ id: ++sequence.current, x, y, size: radius * 2 })
  }

  return <button {...props} type={type} className={`ripple-button ${className}`}
    onPointerDown={event => {
      onPointerDown?.(event)
      if (!event.defaultPrevented && event.button === 0) pulse(event.currentTarget, { x: event.clientX, y: event.clientY })
    }}
    onClick={event => {
      // Keyboard and assistive activations have no pointer coordinates.
      if (event.detail === 0) pulse(event.currentTarget)
      onClick?.(event)
    }}>
    {children}
    {ripple && <span key={ripple.id} className="button-ripple" aria-hidden="true" style={{
      '--ripple-x': `${ripple.x}px`, '--ripple-y': `${ripple.y}px`, '--ripple-size': `${ripple.size}px`,
    } as CSSProperties} />}
  </button>
}

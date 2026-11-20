import { useLayoutEffect, useRef, type ReactNode } from 'react'

/** Animate committed results without delaying updates, moving focus or reserving empty space. */
export function AnimatedResults({ changeKey, children }: { changeKey: string; children: ReactNode }) {
  const container = useRef<HTMLDivElement>(null)
  const previous = useRef<string | null>(null)
  useLayoutEffect(() => {
    const element = container.current
    if (!element) return
    const old = previous.current
    previous.current = changeKey
    if (old === null || old === changeKey || window.matchMedia('(prefers-reduced-motion: reduce)').matches || !element.animate) return
    const animation = element.animate([{ opacity: 0.65, transform: 'translateY(5px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 160, easing: 'ease-out' })
    return () => animation.cancel()
  }, [changeKey])
  return <div className="animated-results" ref={container}>{children}</div>
}

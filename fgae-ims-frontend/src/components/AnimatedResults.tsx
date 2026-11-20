import { useLayoutEffect, useRef, type ReactNode } from 'react'

/** Animate committed results without delaying updates, remounting controls or moving focus.
 * Keep resetKey stable across pagination to retain the result area's height; change it for a new search/filter.
 */
export function AnimatedResults({ changeKey, resetKey, children }: { changeKey: string; resetKey: string; children: ReactNode }) {
  const container = useRef<HTMLDivElement>(null)
  const previous = useRef<{ changeKey: string; resetKey: string; height: number } | null>(null)
  useLayoutEffect(() => {
    const element = container.current
    if (!element) return
    const old = previous.current
    element.style.minHeight = old && old.resetKey === resetKey ? `${old.height}px` : ''
    previous.current = { changeKey, resetKey, height: element.getBoundingClientRect().height }
    if (!old || old.changeKey === changeKey || window.matchMedia('(prefers-reduced-motion: reduce)').matches || !element.animate) return
    const animation = element.animate([{ opacity: 0.65, transform: 'translateY(5px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 160, easing: 'ease-out' })
    return () => animation.cancel()
  }, [changeKey, resetKey])
  return <div className="animated-results" ref={container}>{children}</div>
}

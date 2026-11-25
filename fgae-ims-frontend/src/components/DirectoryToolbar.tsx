import { PlusIcon } from '@phosphor-icons/react'
import type { ReactNode } from 'react'
/** Keep directory creation beside the records it affects across management pages. */
export function DirectoryToolbar({ children, href, label }: { children: ReactNode; href?: string; label?: string }) {
  return <div className="directory-toolbar"><div className="directory-toolbar-heading">{children}</div>{href && label && <a className="primary action-link directory-create" href={href}><PlusIcon size={19} aria-hidden="true" />{label}</a>}</div>
}

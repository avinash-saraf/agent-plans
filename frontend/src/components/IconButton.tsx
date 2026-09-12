import type { ButtonHTMLAttributes } from 'react'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { label: string }

/** A compact action with the same name for sighted and assistive-technology users. */
export function IconButton({ label, className = '', children, ...props }: Props) {
  return (
    <button
      type="button"
      {...props}
      aria-label={label}
      data-tooltip={label}
      className={'icon-button ' + className}
    >
      {children}
    </button>
  )
}

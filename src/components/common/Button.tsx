import type { ButtonHTMLAttributes } from 'react'
import { Link, type LinkProps } from 'react-router'
import styles from './Button.module.css'

type ButtonVariant = 'primary' | 'secondary'

function buttonClassName(variant: ButtonVariant, className?: string) {
  return [styles.button, styles[variant], className].filter(Boolean).join(' ')
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
}

/** A native button for actions that change something on the current page. */
export function Button({
  variant = 'primary',
  type = 'button',
  className,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClassName(variant, className)}
      {...rest}
    />
  )
}

type ButtonLinkProps = LinkProps & { variant?: ButtonVariant }

/** A link that looks like a Button, for actions that navigate to another page. */
export function ButtonLink({
  variant = 'primary',
  className,
  ...rest
}: ButtonLinkProps) {
  return <Link className={buttonClassName(variant, className)} {...rest} />
}

import type { AnchorHTMLAttributes, PropsWithChildren } from 'react'

type NextLinkShimProps = PropsWithChildren<
  AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }
>

export default function Link({ href, children, ...props }: NextLinkShimProps) {
  return (
    <a href={href} {...props}>
      {children}
    </a>
  )
}

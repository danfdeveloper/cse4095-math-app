import { ButtonLink } from '../components/common/Button'

export function NotFoundPage() {
  return (
    <>
      <h1>Page Not Found</h1>
      <p>
        Oops! We couldn&apos;t find that page. Let&apos;s get you back home.
      </p>
      <ButtonLink to="/">Return Home</ButtonLink>
    </>
  )
}

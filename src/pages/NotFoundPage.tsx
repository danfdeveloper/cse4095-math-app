import { ErrorMessage } from '../components/common/ErrorMessage'

export function NotFoundPage() {
  return (
    <ErrorMessage title="Page Not Found">
      <p>
        Oops! We couldn&apos;t find that page. Let&apos;s get you back home.
      </p>
    </ErrorMessage>
  )
}

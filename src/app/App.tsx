import { createBrowserRouter } from 'react-router'
import { RouterProvider } from 'react-router/dom'
import { AppProvider } from './AppProvider'
import { routes } from './AppRoutes'

// A data router (rather than <BrowserRouter>) so that useBlocker is available
// for guarding active practice sessions later.
const router = createBrowserRouter(routes)

function App() {
  return (
    <AppProvider>
      <RouterProvider router={router} />
    </AppProvider>
  )
}

export default App

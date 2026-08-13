import { ToastProvider } from './components'
import { AppStoreProvider } from './stores/AppStore'
import { AppLayout } from './layouts/AppLayout'

export default function App() {
  return (
    <ToastProvider>
      <AppStoreProvider>
        <AppLayout />
      </AppStoreProvider>
    </ToastProvider>
  )
}

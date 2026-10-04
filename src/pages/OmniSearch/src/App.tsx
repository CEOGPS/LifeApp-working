import { Suspense, lazy } from 'react'

const OmniSearchPanel = lazy(() => import('./components/OmniSearchPanel').then(m => ({ default: m.OmniSearchPanel })))

export default function App() {
  return (
    <div className="h-screen p-4" style={{ backgroundColor: '#000000' }}>
      <Suspense fallback={
        <div className="flex items-center justify-center h-full">
          <div className="w-8 h-8 border-2 border-[#ff000d] border-t-transparent rounded-full animate-spin" />
        </div>
      }>
        <OmniSearchPanel />
      </Suspense>
    </div>
  )
}

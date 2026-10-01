import { Suspense } from 'react'
import SimulationHub from './SimulationHub'

export default function SimulatePage() {
  return <Suspense fallback={<p role="status">Loading simulator…</p>}><SimulationHub /></Suspense>
}

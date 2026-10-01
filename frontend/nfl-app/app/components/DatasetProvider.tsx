'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

type Season = { year: number; teams: string[]; seed: number }
type Ranking = { offense: number; defense: number }
type Metadata = { seasons: Season[]; rankings: Record<string, Record<string, Ranking>> }
type Dataset = Metadata & { loading: boolean; error: string | null; reload: () => void }
const Context = createContext<Dataset>({ seasons: [], rankings: {}, loading: true, error: null, reload: () => {} })

export function DatasetProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Metadata>({ seasons: [], rankings: {} })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    fetch('/api/metadata', { signal: controller.signal })
      .then(async response => {
        const result = await response.json()
        if (!response.ok) throw new Error(result.detail || 'Could not load available seasons.')
        setData(result)
        setError(null)
      })
      .catch(error => { if (!controller.signal.aborted) setError(error.message) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [revision])
  return <Context.Provider value={{ ...data, loading, error, reload: () => setRevision(v => v + 1) }}>{children}</Context.Provider>
}

export function useDataset() {
  const data = useContext(Context)
  return { ...data, yearOptions: data.seasons.map(s => s.year),
    teamsFor: (year: number) => data.seasons.find(s => s.year === year)?.teams.filter(t => t !== 'NFL') || [] }
}

export function DatasetStatus() {
  const data = useDataset()
  const message = data.loading ? 'Loading available seasons…' : data.error || 'No seasons are available yet. Add a season dataset to get started.'
  return <div role="status" style={{ padding: '32px', color: '#555', fontFamily: 'monospace' }}>
    <p>{message}</p>
    {!data.loading && <button onClick={data.reload}>Refresh seasons</button>}
  </div>
}

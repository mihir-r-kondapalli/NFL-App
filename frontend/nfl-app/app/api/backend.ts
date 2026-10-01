import { NextResponse } from 'next/server'

const API_URL = process.env.API_URL || 'http://127.0.0.1:8000'

/** All browser requests pass through this server-only backend adapter. */
export async function backend(path: string, body?: unknown) {
  try {
    const response = await fetch(`${API_URL}${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      cache: 'no-store',
      signal: AbortSignal.timeout((path === '/simulate' || path === '/season/schedule') ? 120_000 : 30_000),
    })
    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch {
    return NextResponse.json({ detail: 'Could not connect to the simulation service. Please try again.' }, { status: 503 })
  }
}

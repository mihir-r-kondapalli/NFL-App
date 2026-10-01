import { NextRequest, NextResponse } from 'next/server'
import { backend } from '../../backend'

type Context = { params: Promise<{ path?: string[] }> }
export async function GET(request: NextRequest, context: Context) {
  const { path = [] } = await context.params
  return backend(`/season/${path.map(encodeURIComponent).join('/')}${request.nextUrl.search}`)
}
export async function POST(request: NextRequest, context: Context) {
  const { path = [] } = await context.params
  if (!['simulate', 'schedule'].includes(path.join('/'))) return NextResponse.json({ detail: 'Not found' }, { status: 404 })
  try { return backend(`/season/${path.join('/')}`, await request.json()) }
  catch { return NextResponse.json({ detail: 'Invalid JSON request' }, { status: 400 }) }
}

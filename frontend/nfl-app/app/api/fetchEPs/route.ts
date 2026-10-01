import { NextRequest, NextResponse } from 'next/server'
import { backend } from '../backend'

export async function POST(request: NextRequest) {
  try {
    return backend('/expected-points', await request.json())
  } catch {
    return NextResponse.json({ detail: 'Invalid JSON request' }, { status: 400 })
  }
}

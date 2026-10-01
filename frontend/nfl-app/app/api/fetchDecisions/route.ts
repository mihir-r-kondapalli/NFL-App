import { NextRequest, NextResponse } from 'next/server'
import { backend } from '../backend'

export async function POST(request: NextRequest) {
  try {
    return backend('/decisions', await request.json())
  } catch {
    return NextResponse.json({ detail: 'Invalid JSON request' }, { status: 400 })
  }
}

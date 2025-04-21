// app/api/fetchEPS/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_KEY!
)

export async function POST(req: NextRequest) {
  const { team, year, isDefense, down, distance } = await req.json()

  const { data, error } = await supabase
    .from('expected_points')
    .select('yardline, ep, distance')
    .eq('team', team)
    .eq('year', year)
    .eq('is_defense', isDefense)
    .eq('down', down)
    .lte('distance', distance)
    .order('yardline')

  return NextResponse.json({ data, error })
}

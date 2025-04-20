// app/api/simulate/route.ts
import { NextRequest, NextResponse } from 'next/server'

const API_URL = (process.env.NEXT_PUBLIC_API_URL as string) || 'http://localhost:8000';

export async function POST(request: NextRequest) {
  try {
    const data = await request.json()
    
    // Format data to match your API expectations
    const apiPayload = {
      team1: data.team1,
      team2: data.team2,
      year1: data.year1,
      year2: data.year2,
      num_games: data.num_games,
      num_plays: data.num_plays
    }
        
    // Make request to your API
    try {
      const response = await fetch(API_URL+'/simulate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(apiPayload),
        signal: AbortSignal.timeout(10000) // 10 second timeout
      })
      
      // Handle non-JSON responses
      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text()
        console.error('Non-JSON response received:', text)
        return NextResponse.json(
          { detail: 'Backend server returned an invalid response format.' },
          { status: 500 }
        )
      }
      
      if (!response.ok) {
        const error = await response.json()
        return NextResponse.json(
          { detail: error.detail || 'API request failed' },
          { status: response.status }
        )
      }
      
      const result = await response.json()
      
      // Add average scores if they're not already included
      if (!result.avg_score_team1) {
        const sum1 = result.team1_scores.reduce((acc: number, score: number) => acc + score, 0)
        result.avg_score_team1 = sum1 / result.team1_scores.length
      }
      
      if (!result.avg_score_team2) {
        const sum2 = result.team2_scores.reduce((acc: number, score: number) => acc + score, 0)
        result.avg_score_team2 = sum2 / result.team2_scores.length
      }
      
      return NextResponse.json(result)
    } catch (fetchError: any) {
      // Handle network errors (server not available)
      console.error('Failed to connect to backend:', fetchError)
      return NextResponse.json(
        { detail: 'Backend server is not online. Please start the API server.' },
        { status: 503 }
      )
    }
  } catch (error: any) {
    console.error('Error processing simulation request:', error)
    
    return NextResponse.json(
      { detail: error.message || 'An unknown error occurred' },
      { status: 500 }
    )
  }
}
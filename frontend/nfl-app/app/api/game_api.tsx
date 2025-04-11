// app/lib/api.ts
import axios from 'axios'

const API_BASE_URL = 'http://localhost:8000' // or your backend URL

export async function sendPlay(playType: number) {
  const res = await axios.post(`${API_BASE_URL}/play`, { playType })
  return res.data
}

export async function sendXP(choice: number) {
  const res = await axios.post(`${API_BASE_URL}/xp`, { choice })
  return res.data
}

export async function startNewGame() {
  const res = await axios.get(`${API_BASE_URL}/start`)
  return res.data
}

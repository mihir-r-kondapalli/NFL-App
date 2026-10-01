import { redirect } from 'next/navigation'

export default function SeasonPage() {
  redirect('/simulate?mode=season')
}

import { backend } from '../backend'

export async function GET() {
  return backend('/metadata')
}

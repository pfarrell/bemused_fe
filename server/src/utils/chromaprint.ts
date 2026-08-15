import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

export interface Fingerprint {
  duration: number
  fingerprint: string
}

export async function computeFingerprint(filePath: string): Promise<Fingerprint> {
  const { stdout } = await execFileAsync('fpcalc', ['-json', filePath], {
    maxBuffer: 10 * 1024 * 1024,
  })

  let parsed: any
  try {
    parsed = JSON.parse(stdout)
  } catch {
    throw new Error(`fpcalc produced non-JSON output: ${stdout.slice(0, 200)}`)
  }

  if (typeof parsed.fingerprint !== 'string' || typeof parsed.duration !== 'number') {
    throw new Error(`Unexpected fpcalc output shape: ${stdout.slice(0, 200)}`)
  }

  return { duration: parsed.duration, fingerprint: parsed.fingerprint }
}

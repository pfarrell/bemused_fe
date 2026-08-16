import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

export interface Fingerprint {
  duration: number
  fingerprint: string
}

function tryParseFingerprint(stdout: string): Fingerprint | null {
  let parsed: any
  try {
    parsed = JSON.parse(stdout)
  } catch {
    return null
  }
  if (typeof parsed.fingerprint !== 'string' || typeof parsed.duration !== 'number') {
    return null
  }
  return { duration: parsed.duration, fingerprint: parsed.fingerprint }
}

export async function computeFingerprint(filePath: string): Promise<Fingerprint> {
  let stdout: string
  try {
    ;({ stdout } = await execFileAsync('fpcalc', ['-json', filePath], {
      maxBuffer: 10 * 1024 * 1024,
    }))
  } catch (err) {
    // fpcalc can exit non-zero (e.g. "Error reading from the audio source
    // (Invalid data found when processing input)") after a partial-decode
    // glitch while still emitting a fully valid, usable fingerprint on
    // stdout — don't discard good data just because the exit code was
    // non-zero. Node's promisified execFile attaches stdout/stderr onto
    // the rejection error, so recover from it there before giving up.
    const errStdout = (err as NodeJS.ErrnoException & { stdout?: string }).stdout
    const recovered = typeof errStdout === 'string' ? tryParseFingerprint(errStdout) : null
    if (recovered) return recovered
    throw err
  }

  const result = tryParseFingerprint(stdout)
  if (!result) {
    throw new Error(`Unexpected fpcalc output shape: ${stdout.slice(0, 200)}`)
  }
  return result
}

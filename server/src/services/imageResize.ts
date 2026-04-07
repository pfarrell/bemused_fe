// server/src/services/imageResize.ts
// Creates a small (≤400px) version of an image in a 'sm/' subdirectory.
// Skips if already small enough (no enlargement). Preserves aspect ratio.

import sharp from 'sharp'
import fs from 'fs'
import path from 'path'

const MAX_DIM = 400

export async function createSmallVersion(fullPath: string): Promise<void> {
  const dir = path.dirname(fullPath)
  const filename = path.basename(fullPath)
  const smDir = path.join(dir, 'sm')
  const smPath = path.join(smDir, filename)

  if (fs.existsSync(smPath)) return

  if (!fs.existsSync(smDir)) fs.mkdirSync(smDir, { recursive: true })

  const { width = 0, height = 0 } = await sharp(fullPath).metadata()

  if (width <= MAX_DIM && height <= MAX_DIM) {
    fs.copyFileSync(fullPath, smPath)
  } else {
    await sharp(fullPath)
      .resize(MAX_DIM, MAX_DIM, { fit: 'inside', withoutEnlargement: true })
      .toFile(smPath)
  }
}

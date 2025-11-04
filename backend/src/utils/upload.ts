import multer from 'multer'
import path from 'node:path'
import fs from 'node:fs'
import { Request } from 'express'

const MAX_SIZE = 100 * 1024 * 1024
const UPLOAD_DIR = process.env.UPLOAD_DIR ?? path.resolve(process.cwd(), 'uploads')

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true })
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOAD_DIR)
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname)
    const basename = path.basename(file.originalname, ext)
    const timestamp = Date.now()
    cb(null, `${basename}-${timestamp}${ext}`)
  },
})

function fileFilter(_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) {
  const allowed = [
    'image/',
    'application/pdf',
    'text/',
    'application/msword',
    'application/vnd',
    'audio/',
    'video/',
  ]
  if (allowed.some((prefix) => file.mimetype.startsWith(prefix))) {
    cb(null, true)
  } else {
    cb(new Error('Unsupported file type'))
  }
}

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_SIZE,
  },
})

export function mapUploadedFiles(files: Express.Multer.File[]) {
  return files.map((file) => ({
    path: path.relative(process.cwd(), file.path),
    title: file.originalname,
    mime: file.mimetype,
    size: file.size,
    sourceType: 'file' as const,
  }))
}

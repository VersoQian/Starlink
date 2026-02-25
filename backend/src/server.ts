import express from 'express'
import morgan from 'morgan'
import helmet from 'helmet'
import cors from 'cors'
import path from 'node:path'
import { kbRouter } from './routes/kb'
import { errorHandler } from './middleware/error'

const app = express()

app.use(
  cors({
    origin: [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:5173',
      'http://127.0.0.1:5173'
    ],
    credentials: false
  })
)
app.use(helmet())
app.use(express.json({ limit: '5mb' }))
app.use(express.urlencoded({ extended: true }))
app.use(morgan('dev'))

const uploadDir = process.env.UPLOAD_DIR ?? path.resolve(process.cwd(), 'uploads')
app.use('/uploads', express.static(uploadDir))

app.use(kbRouter)
app.use(errorHandler)

const port = Number(process.env.PORT ?? 4001)

if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => {
    console.log(`Knowledge Base API listening on http://localhost:${port}`)
  })
}

export default app

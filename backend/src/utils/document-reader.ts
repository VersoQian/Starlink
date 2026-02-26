import fs from 'node:fs/promises'
import path from 'node:path'
import pdfParse from 'pdf-parse'
import mammoth from 'mammoth'

export async function readDocumentText(filePath: string, mime: string): Promise<string> {
  const buffer = await fs.readFile(filePath)
  const extension = path.extname(filePath).toLowerCase()

  if (extension === '.pdf' || mime === 'application/pdf') {
    const result = await pdfParse(buffer)
    return result.text || ''
  }

  if (extension === '.docx' || mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const result = await mammoth.extractRawText({ buffer })
    return result.value || ''
  }

  return buffer.toString('utf-8')
}

export async function fetchTextFromUrl(url: string): Promise<string> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch URL: ${response.status}`)
  }
  return response.text()
}

import type { NextFunction, Request, Response } from 'express'

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  const status = err.code && Number.isInteger(err.code) ? Number(err.code) : 500
  const message = err.message || '服务器内部错误'
  res.status(status).json({ code: status, message })
}

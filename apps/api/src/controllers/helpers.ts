import type { Response } from "express";

export function ok<T>(res: Response, data: T): void {
  res.json({ success: true, data });
}

export function paginated<T>(res: Response, input: { items: T[]; total: number }, page: number, pageSize: number): void {
  res.json({
    success: true,
    data: input.items,
    pagination: {
      page,
      pageSize,
      total: input.total,
      totalPages: Math.ceil(input.total / pageSize),
    },
  });
}

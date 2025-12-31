"use client"

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogTrigger,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogDrawer,
} from '@/components/ui/dialog'

export function DownloadButton() {
  const [open, setOpen] = useState(false)
  const [format, setFormat] = useState<'json'|'csv'|'html'|'excel'>('html')
  const [includeCharts, setIncludeCharts] = useState(true)

  const start = () => setOpen(true)

  const doDownload = async (e?: React.FormEvent) => {
    e?.preventDefault()
    try {
      const res = await fetch(`/api/download?format=${encodeURIComponent(format)}&charts=${includeCharts ? '1' : '0'}`)
      if (!res.ok) throw new Error('Failed to fetch data')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      if (format === 'csv') a.download = 'axiom-data.csv'
      else if (format === 'html') a.download = 'axiom-report.html'
      else if (format === 'excel') a.download = 'axiom-data.xls'
      else a.download = 'axiom-data.json'
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Download failed', err)
      alert('Failed to download data. See console for details.')
    } finally {
      setOpen(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Download Data</Button>
      </DialogTrigger>
      <DialogDrawer>
        <DialogHeader>
          <DialogTitle>Export Options</DialogTitle>
          <DialogDescription>Choose format and content for the exported data.</DialogDescription>
        </DialogHeader>

        <form onSubmit={doDownload} className="mt-4 flex flex-col h-full">
          <div className="space-y-3">
            <label className="flex items-center gap-3">
              <input type="radio" name="fmt" checked={format === 'html'} onChange={() => setFormat('html')} />
              <span>Report (HTML)</span>
            </label>
            <label className="flex items-center gap-3">
              <input type="radio" name="fmt" checked={format === 'csv'} onChange={() => setFormat('csv')} />
              <span>CSV (tables)</span>
            </label>
            <label className="flex items-center gap-3">
              <input type="radio" name="fmt" checked={format === 'json'} onChange={() => setFormat('json')} />
              <span>JSON (raw)</span>
            </label>
          </div>

          <div className="flex items-center gap-3 mt-4">
            <input id="charts" type="checkbox" checked={includeCharts} onChange={() => setIncludeCharts(v => !v)} />
            <label htmlFor="charts" className="text-sm">Include charts in report</label>
          </div>

          <div className="mt-auto flex items-center justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit">Download</Button>
          </div>
        </form>
      </DialogDrawer>
    </Dialog>
  )
}

export default DownloadButton

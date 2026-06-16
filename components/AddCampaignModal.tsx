'use client'

import { useState } from 'react'
import Modal from './Modal'

const inputStyle = {
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  color: 'var(--foreground)',
}

export default function AddCampaignModal({ action }: { action: (formData: FormData) => Promise<void> }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="px-3 py-1.5 rounded-lg text-xs font-semibold"
        style={{ background: 'var(--accent)', color: '#000' }}
      >
        + Tilføj ny kampagne
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Tilføj kampagne">
        <form action={action} className="space-y-4" encType="multipart/form-data">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>Kampagnenavn *</label>
              <input
                name="name"
                required
                placeholder="fx Forårskampagne 2025"
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={inputStyle}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>Status</label>
              <select name="status" defaultValue="planned" className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle}>
                <option value="planned">Planlagt</option>
                <option value="active">Aktiv</option>
                <option value="ended">Afsluttet</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>Budget/md (kr)</label>
              <input
                name="monthly_budget"
                type="text"
                inputMode="numeric"
                placeholder="15.000"
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={inputStyle}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>Startdato</label>
              <input name="start_date" type="date" className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>Slutdato</label>
              <input name="end_date" type="date" className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>Grafik (PNG)</label>
              <input
                name="graphic"
                type="file"
                accept="image/png,image/jpeg"
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={inputStyle}
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium mb-2" style={{ color: 'var(--muted)' }}>Placeringer</label>
              <div className="flex flex-wrap gap-2">
                {['Inapp', 'Nyhedsbreve', 'Tilbudsmail', 'Banner', 'Facebook'].map(p => (
                  <label
                    key={p}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs cursor-pointer"
                    style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
                  >
                    <input type="checkbox" name="placements" value={p} className="accent-yellow-400" />
                    {p}
                  </label>
                ))}
              </div>
            </div>
            <div className="col-span-2">
              <label className="flex items-center gap-2 cursor-pointer text-sm" style={{ color: 'var(--foreground)' }}>
                <input type="checkbox" name="subject_pending" className="accent-yellow-400 w-4 h-4" />
                <span>Emne ikke fastlagt endnu <span className="text-red-500 font-bold">✱</span></span>
              </label>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-4 py-2 rounded-lg text-sm font-medium"
              style={{ background: 'var(--surface-2)', color: 'var(--muted)', border: '1px solid var(--border)' }}
            >
              Annuller
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg text-sm font-semibold"
              style={{ background: 'var(--accent)', color: '#000' }}
            >
              + Tilføj kampagne
            </button>
          </div>
        </form>
      </Modal>
    </>
  )
}

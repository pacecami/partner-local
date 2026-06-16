'use client'

import { useState } from 'react'
import Modal from './Modal'

const inputStyle = {
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  color: 'var(--foreground)',
}

export default function AddPlacementModal({ action }: { action: (formData: FormData) => Promise<void> }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="px-3 py-1.5 rounded-lg text-xs font-semibold"
        style={{ background: 'var(--accent)', color: '#000' }}
      >
        + Tilføj ny placering
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Tilføj fast placering">
        <form action={action} className="space-y-4" encType="multipart/form-data">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>Navn *</label>
              <input
                name="fp_name"
                required
                placeholder="fx Forsikring & finansiering — banner"
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={inputStyle}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>Site</label>
              <select name="fp_site" className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle}>
                <option value="">— Vælg site —</option>
                <option value="Bilhandel">Bilhandel</option>
                <option value="TjekBil">TjekBil</option>
                <option value="TjekBilsyn">TjekBilsyn</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>URL (linker til)</label>
              <input
                name="fp_url"
                type="url"
                placeholder="https://www.eksempel.dk/side"
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={inputStyle}
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>Billede (screenshot af placeringen)</label>
              <input
                name="fp_image"
                type="file"
                accept="image/*"
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={inputStyle}
              />
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
              + Tilføj placering
            </button>
          </div>
        </form>
      </Modal>
    </>
  )
}

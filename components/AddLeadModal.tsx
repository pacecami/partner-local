'use client'

import { useState } from 'react'
import { useFormStatus } from 'react-dom'
import Modal from './Modal'

const inputStyle = {
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  color: 'var(--foreground)',
}

function SubmitBtn() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="px-4 py-2 rounded-lg text-sm font-semibold"
      style={{ background: 'var(--accent)', color: '#000', opacity: pending ? 0.7 : 1 }}
    >
      {pending ? 'Gemmer…' : '+ Tilføj leads'}
    </button>
  )
}

export default function AddLeadModal({
  action,
  defaultName = 'Reparationsforsikring',
}: {
  action: (formData: FormData) => Promise<void>
  defaultName?: string
}) {
  const [open, setOpen] = useState(false)

  // Default til indeværende måned
  const now = new Date()
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="px-3 py-1.5 rounded-lg text-xs font-semibold"
        style={{ background: 'var(--accent)', color: '#000' }}
      >
        + Tilføj leads
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Tilføj leads">
        <form action={action} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>Navn</label>
              <input
                name="lead_name"
                required
                defaultValue={defaultName}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={inputStyle}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>Måned</label>
              <input
                name="lead_month"
                type="month"
                required
                defaultValue={defaultMonth}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={inputStyle}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>Antal leads</label>
              <input
                name="lead_count"
                type="number"
                min="0"
                required
                placeholder="fx 47"
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
            <SubmitBtn />
          </div>
        </form>
      </Modal>
    </>
  )
}

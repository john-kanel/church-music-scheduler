'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Save } from 'lucide-react'

interface ServicePartEditPopupProps {
  isOpen: boolean
  onClose: () => void
  servicePart: {
    id: string
    name: string
    notes?: string
    order: number
  } | null
  onSave: (servicePartId: string, name: string, notes: string) => void
  clickPosition?: { x: number, y: number }
}

export function ServicePartEditPopup({
  isOpen,
  onClose,
  servicePart,
  onSave,
  clickPosition
}: ServicePartEditPopupProps) {
  const [name, setName] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const popupRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (servicePart) {
      setName(servicePart.name)
      setNotes(servicePart.notes || '')
    }
  }, [servicePart])

  useEffect(() => {
    if (isOpen && clickPosition) {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop
      const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft
      
      // Position popup near the click position
      setPosition({
        top: clickPosition.y + scrollTop - 10,
        left: clickPosition.x + scrollLeft + 10
      })
    }
  }, [isOpen, clickPosition])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isOpen && popupRef.current && !popupRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, onClose])

  const handleSave = async () => {
    if (!servicePart || !name.trim()) return
    
    setLoading(true)
    try {
      await onSave(servicePart.id, name.trim(), notes.trim())
      onClose()
    } catch (error) {
      console.error('Error saving service part:', error)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen || !servicePart) return null

  return (
    <div
      ref={popupRef}
      className="fixed z-50 bg-white border border-gray-200 rounded-lg shadow-lg max-w-xs w-80"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-100">
        <h3 className="text-sm font-medium text-gray-900">Edit Service Part</h3>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-100 rounded transition-colors text-gray-400 hover:text-gray-600"
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      <div className="p-3 space-y-3">
        {/* Service Part Name */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent text-gray-900"
            placeholder="Service part name..."
          />
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent text-gray-900 resize-none"
            placeholder="Optional notes..."
          />
        </div>
      </div>

      {/* Footer */}
      <div className="flex justify-end space-x-2 p-3 border-t border-gray-100 bg-gray-50 rounded-b-lg">
        <button
          onClick={onClose}
          disabled={loading}
          className="px-3 py-1.5 text-xs border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={loading || !name.trim()}
          className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center"
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1"></div>
              Saving...
            </>
          ) : (
            <>
              <Save className="h-3 w-3 mr-1" />
              Save
            </>
          )}
        </button>
      </div>
    </div>
  )
}

// Keep backward compatibility by exporting the popup as the modal name
export const ServicePartEditModal = ServicePartEditPopup 
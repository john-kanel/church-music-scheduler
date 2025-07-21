'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Save } from 'lucide-react'

interface IndividualSongEditModalProps {
  isOpen: boolean
  onClose: () => void
  song: {
    id: string
    title: string
    notes?: string
    partName?: string
  } | null
  onSave: (songId: string, title: string, notes: string, partName: string) => void
  clickPosition?: { x: number, y: number }
}

export function IndividualSongEditModal({
  isOpen,
  onClose,
  song,
  onSave,
  clickPosition
}: IndividualSongEditModalProps) {
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [partName, setPartName] = useState('')
  const [loading, setLoading] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const popupRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (song) {
      setTitle(song.title || '')
      setNotes(song.notes || '')
      setPartName(song.partName || 'Individual Song')
    }
  }, [song])

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
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleEscape)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, onClose])

  const handleSave = async () => {
    if (!song || !title.trim()) return

    setLoading(true)
    try {
      await onSave(song.id, title.trim(), notes.trim(), partName.trim())
      onClose()
    } catch (error) {
      console.error('Error saving song:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      handleSave()
    }
  }

  if (!isOpen || !song) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div
        ref={popupRef}
        className="bg-white rounded-lg shadow-xl p-6 w-96 max-w-md mx-4"
        style={{ 
          position: clickPosition ? 'fixed' : 'relative',
          top: clickPosition ? `${position.top}px` : 'auto',
          left: clickPosition ? `${position.left}px` : 'auto',
          transform: clickPosition ? 'none' : 'translate(-50%, -50%)'
        }}
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Edit Song</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Part Name
            </label>
            <input
              type="text"
              value={partName}
              onChange={(e) => setPartName(e.target.value)}
              placeholder="e.g., Individual Song, Special Music, Offertory..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              autoFocus
            />
            <p className="text-xs text-gray-500 mt-1">
              This is the label shown for this song section
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Song Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter song title..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent h-20 resize-none"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading || !title.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {loading ? 'Saving...' : 'Save'}
          </button>
        </div>

        <div className="mt-3 text-xs text-gray-500">
          Press Ctrl+Enter to save quickly
        </div>
      </div>
    </div>
  )
} 
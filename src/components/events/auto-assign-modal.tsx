'use client'

import { useState, useEffect } from 'react'
import { X, Users, Zap, Check, AlertCircle, ChevronRight } from 'lucide-react'

interface Group {
  id: string
  name: string
  description?: string
  members: Array<{
    id: string
    firstName: string
    lastName: string
  }>
}

interface AutoAssignModalProps {
  isOpen: boolean
  onClose: () => void
  selectedEventIds: string[]
  groups: Group[]
  onAssignComplete: (assignmentIds: string[]) => void
}

export function AutoAssignModal({
  isOpen,
  onClose,
  selectedEventIds,
  groups,
  onAssignComplete
}: AutoAssignModalProps) {
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set())
  const [isPreviewMode, setIsPreviewMode] = useState(true)
  const [previewData, setPreviewData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isExecuting, setIsExecuting] = useState(false)

  useEffect(() => {
    if (isOpen) {
      // Reset state when modal opens
      setSelectedGroups(new Set())
      setIsPreviewMode(true)
      setPreviewData(null)
    }
  }, [isOpen])

  const handleGroupToggle = (groupId: string) => {
    const newSelected = new Set(selectedGroups)
    if (newSelected.has(groupId)) {
      newSelected.delete(groupId)
    } else {
      newSelected.add(groupId)
    }
    setSelectedGroups(newSelected)
  }

  const handleSelectAllGroups = () => {
    if (selectedGroups.size === groups.length) {
      setSelectedGroups(new Set())
    } else {
      setSelectedGroups(new Set(groups.map(g => g.id)))
    }
  }

  const handlePreview = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/events/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventIds: selectedEventIds,
          preview: true,
          groupFilter: selectedGroups.size > 0 ? Array.from(selectedGroups) : undefined
        })
      })

      if (response.ok) {
        const data = await response.json()
        setPreviewData(data)
        setIsPreviewMode(true)
      } else {
        const error = await response.json()
        alert(`Preview failed: ${error.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Error generating preview:', error)
      alert('Failed to generate preview')
    } finally {
      setIsLoading(false)
    }
  }

  const handleExecute = async () => {
    if (!previewData) return

    setIsExecuting(true)
    try {
      const response = await fetch('/api/events/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventIds: selectedEventIds,
          preview: false,
          groupFilter: selectedGroups.size > 0 ? Array.from(selectedGroups) : undefined
        })
      })

      if (response.ok) {
        const data = await response.json()
        const assignmentIds = data.successfulAssignments?.map((a: any) => a.assignmentId) || []
        onAssignComplete(assignmentIds)
      } else {
        const error = await response.json()
        alert(`Assignment failed: ${error.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Error executing assignment:', error)
      alert('Failed to execute auto-assignment')
    } finally {
      setIsExecuting(false)
    }
  }

  if (!isOpen) return null

  const totalSelectedMusicians = Array.from(selectedGroups).reduce((total, groupId) => {
    const group = groups.find(g => g.id === groupId)
    return total + (group?.members.length || 0)
  }, 0)

  return (
    <div className="fixed inset-0 bg-green-900 bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Zap className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Auto Assign Musicians</h2>
              <p className="text-sm text-gray-500">
                {selectedEventIds.length} event{selectedEventIds.length !== 1 ? 's' : ''} selected
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {!previewData ? (
            <>
              {/* Group Selection */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-gray-600" />
                    <h3 className="font-semibold text-gray-900">Filter by Groups (Optional)</h3>
                  </div>
                  {groups.length > 0 && (
                    <button
                      onClick={handleSelectAllGroups}
                      className="text-sm text-blue-600 hover:text-blue-700"
                    >
                      {selectedGroups.size === groups.length ? 'Deselect All' : 'Select All'}
                    </button>
                  )}
                </div>

                {groups.length > 0 ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-3">
                    {groups.map((group) => (
                      <label
                        key={group.id}
                        className={`flex items-center p-3 rounded-lg border cursor-pointer transition-colors ${
                          selectedGroups.has(group.id)
                            ? 'bg-green-50 border-green-200'
                            : 'bg-white border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedGroups.has(group.id)}
                          onChange={() => handleGroupToggle(group.id)}
                          className="mr-3 rounded border-gray-300 text-green-600 focus:ring-green-500"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900">{group.name}</div>
                          <div className="text-sm text-gray-500">
                            {group.description && (
                              <span className="mr-2">{group.description}</span>
                            )}
                            {group.members.length} member{group.members.length !== 1 ? 's' : ''}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Users className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    <p>No groups available</p>
                  </div>
                )}

                {selectedGroups.size > 0 && (
                  <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                    <div className="text-sm text-blue-800">
                      <strong>Selected:</strong> {selectedGroups.size} group{selectedGroups.size !== 1 ? 's' : ''} 
                      ({totalSelectedMusicians} musician{totalSelectedMusicians !== 1 ? 's' : ''})
                    </div>
                  </div>
                )}
              </div>

              {/* Info Box */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div className="text-sm text-blue-800">
                    <p className="font-medium mb-1">How Auto-Assignment Works:</p>
                    <ul className="space-y-1 text-xs">
                      <li>• Checks musician availability and existing assignments</li>
                      <li>• Respects blackout dates and unavailabilities</li>
                      <li>• Matches skills and instruments when possible</li>
                      <li>• Distributes assignments evenly across musicians</li>
                      <li>• Only assigns to musicians in selected groups (if any)</li>
                    </ul>
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* Preview Results */
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <Check className="w-5 h-5 text-green-600" />
                <h3 className="font-semibold text-gray-900">Preview Results</h3>
              </div>

              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {previewData.successfulAssignments || 0}
                  </div>
                  <div className="text-sm text-green-700">Successful Assignments</div>
                </div>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-yellow-600">
                    {(previewData.totalAssignments || 0) - (previewData.successfulAssignments || 0)}
                  </div>
                  <div className="text-sm text-yellow-700">Unassigned Roles</div>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {previewData.totalAssignments || 0}
                  </div>
                  <div className="text-sm text-blue-700">Total Roles</div>
                </div>
              </div>

              {previewData.proposals && previewData.proposals.length > 0 && (
                <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg">
                  {previewData.proposals.map((proposal: any, index: number) => (
                    <div
                      key={index}
                      className={`p-3 border-b border-gray-100 last:border-b-0 ${
                        proposal.musicianId ? 'bg-white' : 'bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm text-gray-900 truncate">
                            {proposal.eventName}
                          </div>
                          <div className="text-xs text-gray-500">
                            {proposal.roleName}
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-400 mx-2" />
                        <div className="flex-1 min-w-0 text-right">
                          {proposal.musicianId ? (
                            <div>
                              <div className="font-medium text-sm text-green-700 truncate">
                                {proposal.musicianName}
                              </div>
                              <div className="text-xs text-green-600">Available</div>
                            </div>
                          ) : (
                            <div>
                              <div className="font-medium text-sm text-gray-500">
                                No one available
                              </div>
                              <div className="text-xs text-gray-400">
                                {proposal.reason || 'No qualified musicians'}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            {!previewData ? (
              <>
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePreview}
                  disabled={isLoading || selectedEventIds.length === 0}
                  className="px-6 py-2 bg-success-600 text-white rounded-lg hover:bg-success-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Generating Preview...
                    </>
                  ) : (
                    'Preview Assignment'
                  )}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => {
                    setPreviewData(null)
                    setIsPreviewMode(true)
                  }}
                  className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Back to Setup
                </button>
                <div className="flex gap-3">
                  <button
                    onClick={onClose}
                    className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleExecute}
                    disabled={isExecuting}
                    className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                  >
                    {isExecuting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Executing...
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4" />
                        Execute Assignment
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
} 
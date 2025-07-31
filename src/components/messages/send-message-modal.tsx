'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { X, Mail, MessageSquare, Users, Send, Phone } from 'lucide-react'

interface SendMessageModalProps {
  isOpen: boolean
  onClose: () => void
  onMessageSent?: () => void
  recipients?: any[]
  groupName?: string
}

export function SendMessageModal({ isOpen, onClose, onMessageSent, recipients, groupName }: SendMessageModalProps) {
  const { data: session } = useSession()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [groups, setGroups] = useState<any[]>([])
  const [events, setEvents] = useState<any[]>([])
  const [churchMembers, setChurchMembers] = useState<any[]>([])
  const [loadingMembers, setLoadingMembers] = useState(false)
  const [selectedEventId, setSelectedEventId] = useState('')

  const [messageData, setMessageData] = useState({
    subject: '',
    message: '',
    recipients: recipients && recipients.length > 0 ? 'group' : 'all', // 'all', 'musicians', 'specific', 'event', 'group'
    specificEmails: '',
    sendMethod: 'email', // 'email', 'sms', 'both'
    scheduleSend: false,
    scheduleDate: '',
    scheduleTime: ''
  })

  const recipientOptions = [
    ...(recipients && recipients.length > 0 ? [{ value: 'group', label: `${groupName} Members (${recipients.length})` }] : []),
    { value: 'all', label: 'All Church Members' },
    { value: 'musicians', label: 'All Musicians' },
    { value: 'directors', label: 'Directors & Pastors' },
    { value: 'accompanists', label: 'Accompanists Only' },
    { value: 'vocalists', label: 'Vocalists Only' },
    ...groups.map(group => ({ 
      value: `group-${group.id}`, 
      label: `${group.name} (${group.members?.length || 0} members)` 
    })),
    { value: 'individual', label: 'Select Individual People' },
    { value: 'specific', label: 'Enter Email Addresses' },
    { value: 'event', label: 'Event Participants' }
  ]

  // Fetch church members for individual selection
  const fetchChurchMembers = async () => {
    if (!session?.user?.churchId) return
    
    setLoadingMembers(true)
    try {
      const response = await fetch('/api/church-members')
      if (response.ok) {
        const data = await response.json()
        setChurchMembers(data.members || [])
      } else {
        console.error('Failed to fetch church members')
      }
    } catch (error) {
      console.error('Error fetching church members:', error)
    } finally {
      setLoadingMembers(false)
    }
  }

  const [selectedIndividuals, setSelectedIndividuals] = useState<string[]>([])

  // Fetch groups, events, and church members when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchGroups()
      fetchEvents()
      fetchChurchMembers()
    }
  }, [isOpen])

  const fetchGroups = async () => {
    try {
      const response = await fetch('/api/groups')
      if (response.ok) {
        const data = await response.json()
        setGroups(data.groups || [])
      }
    } catch (error) {
      console.error('Error fetching groups:', error)
    }
  }

  const fetchEvents = async () => {
    try {
      const response = await fetch('/api/events')
      if (response.ok) {
        const data = await response.json()
        setEvents(data.events || [])
      }
    } catch (error) {
      console.error('Error fetching events:', error)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target
    setMessageData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      // Determine recipients and message type
      let recipientList: string[] | string = 'all'
      let messageType = 'BROADCAST'
      
      if (messageData.recipients === 'individual') {
        recipientList = selectedIndividuals
        messageType = 'INDIVIDUAL'
      } else if (messageData.recipients === 'specific') {
        recipientList = messageData.specificEmails
          .split(',')
          .map(email => email.trim())
          .filter(email => email.includes('@'))
        messageType = 'INDIVIDUAL'
      } else if (messageData.recipients === 'group') {
        recipientList = recipients?.map(member => member.id) || []
        messageType = 'INDIVIDUAL'
      } else if (messageData.recipients.startsWith('group-')) {
        // Handle new group selections
        const groupId = messageData.recipients.replace('group-', '')
        const selectedGroup = groups.find(g => g.id === groupId)
        if (selectedGroup) {
          recipientList = selectedGroup.members?.map((member: any) => member.id) || []
          messageType = 'INDIVIDUAL'
        }
      } else if (messageData.recipients === 'event') {
        // Handle event participants
        if (selectedEventId) {
          const selectedEvent = events.find(e => e.id === selectedEventId)
          if (selectedEvent && selectedEvent.assignments) {
            recipientList = selectedEvent.assignments
              .filter((assignment: any) => assignment.user)
              .map((assignment: any) => assignment.user.id)
            messageType = 'INDIVIDUAL'
          }
        }
      } else if (messageData.recipients === 'musicians') {
        messageType = 'BROADCAST'
      } else if (messageData.recipients === 'directors') {
        messageType = 'BROADCAST'
      } else if (messageData.recipients === 'accompanists') {
        messageType = 'BROADCAST'
      } else if (messageData.recipients === 'vocalists') {
        messageType = 'BROADCAST'
      }

      // Map send method to API format
      const typeMap: { [key: string]: string } = {
        'email': 'EMAIL',
        'sms': 'SMS',
        'both': 'BOTH'
      }

      // Prepare scheduled date if applicable
      let scheduledFor: string | undefined = undefined
      if (messageData.scheduleSend && messageData.scheduleDate && messageData.scheduleTime) {
        const scheduleDateTime = new Date(`${messageData.scheduleDate}T${messageData.scheduleTime}`)
        scheduledFor = scheduleDateTime.toISOString()
      }

      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          subject: messageData.sendMethod === 'sms' ? 'SMS Message' : messageData.subject,
          content: messageData.message,
          type: messageType,
          recipientIds: Array.isArray(recipientList) ? recipientList : [],
          sendMethod: messageData.sendMethod, // Include the send method!
          scheduledFor: scheduledFor,
          // eventId could be added later for event-specific messages
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to send message')
      }

      const result = await response.json()
      
      onMessageSent?.()
      onClose()
      
      // Reset form
      setMessageData({
        subject: '',
        message: '',
        recipients: 'all',
        specificEmails: '',
        sendMethod: 'email',
        scheduleSend: false,
        scheduleDate: '',
        scheduleTime: ''
      })
      setSelectedIndividuals([])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{backgroundColor: '#E7D8ED'}}>
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-2xl font-bold text-gray-900">Send Message</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-700 hover:text-gray-900"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          {/* Recipients */}
          <section>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Users className="h-5 w-5 mr-2 text-blue-600" />
              Recipients
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Send to</label>
                <select
                  name="recipients"
                  value={messageData.recipients}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-secondary-500 focus:border-transparent text-gray-900"
                >
                  {recipientOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {messageData.recipients === 'group' && recipients && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Group Members</label>
                  <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-300 rounded-lg p-3">
                    {recipients.map((member) => (
                      <div key={member.id} className="flex items-center p-2 bg-blue-50 rounded">
                        <div className="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">{member.name}</div>
                          <div className="text-sm text-gray-500">{member.email}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-sm text-gray-500 mt-2">
                    Message will be sent to {recipients.length} group members
                  </p>
                </div>
              )}

              {messageData.recipients.startsWith('group-') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Group Members</label>
                  {(() => {
                    const groupId = messageData.recipients.replace('group-', '')
                    const selectedGroup = groups.find(g => g.id === groupId)
                    if (!selectedGroup) return null
                    
                    return (
                      <>
                        <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-300 rounded-lg p-3">
                          {selectedGroup.members?.map((member: any) => (
                            <div key={member.id} className="flex items-center p-2 bg-blue-50 rounded">
                              <div className="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
                              <div className="flex-1">
                                <div className="font-medium text-gray-900">{member.firstName} {member.lastName}</div>
                                <div className="text-sm text-gray-500">{member.email}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                        <p className="text-sm text-gray-500 mt-2">
                          Message will be sent to {selectedGroup.members?.length || 0} group members
                        </p>
                      </>
                    )
                  })()}
                </div>
              )}

              {messageData.recipients === 'individual' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Select People</label>
                  {loadingMembers ? (
                    <div className="flex items-center justify-center p-8">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600"></div>
                      <span className="ml-2 text-sm text-gray-500">Loading church members...</span>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-300 rounded-lg p-3">
                      {churchMembers.length === 0 ? (
                        <p className="text-sm text-gray-500 p-2">No church members found</p>
                      ) : (
                        churchMembers.map((member) => (
                          <label key={member.id} className="flex items-center p-2 hover:bg-gray-50 rounded">
                            <input
                              type="checkbox"
                              checked={selectedIndividuals.includes(member.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedIndividuals([...selectedIndividuals, member.id])
                                } else {
                                  setSelectedIndividuals(selectedIndividuals.filter(id => id !== member.id))
                                }
                              }}
                              className="mr-3"
                            />
                            <div className="flex-1">
                              <div className="font-medium text-gray-900">{member.name}</div>
                              <div className="text-sm text-gray-500">
                                {member.email} • {member.role}
                                {messageData.sendMethod === 'sms' && !member.canReceiveSMS && (
                                  <span className="text-red-500 ml-1">(No SMS)</span>
                                )}
                                {messageData.sendMethod === 'both' && !member.canReceiveSMS && (
                                  <span className="text-orange-500 ml-1">(Email only)</span>
                                )}
                              </div>
                            </div>
                          </label>
                        ))
                      )}
                    </div>
                  )}
                  <p className="text-sm text-gray-500 mt-2">
                    {selectedIndividuals.length} people selected
                    {messageData.sendMethod === 'sms' && (
                      <span className="ml-2 text-orange-600">
                        (Only members with phone numbers will receive SMS)
                      </span>
                    )}
                  </p>
                </div>
              )}

              {messageData.recipients === 'specific' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email Addresses</label>
                  <textarea
                    name="specificEmails"
                    value={messageData.specificEmails}
                    onChange={handleInputChange}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-secondary-500 focus:border-transparent text-gray-900"
                    placeholder="Enter email addresses separated by commas&#10;john@example.com, jane@example.com"
                  />
                </div>
              )}

              {messageData.recipients === 'event' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Select Event</label>
                  <select
                    value={selectedEventId}
                    onChange={(e) => setSelectedEventId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-secondary-500 focus:border-transparent text-gray-900"
                  >
                    <option value="">Select an event...</option>
                    {events.map(event => (
                      <option key={event.id} value={event.id}>
                        {event.name} - {new Date(event.startTime).toLocaleDateString()}
                      </option>
                    ))}
                  </select>
                  {events.length === 0 ? (
                    <p className="text-sm text-gray-500 mt-1">
                      No events found. Create an event first to message its participants.
                    </p>
                  ) : selectedEventId ? (
                    (() => {
                      const selectedEvent = events.find(e => e.id === selectedEventId)
                      if (!selectedEvent) return null
                      
                      const participants = selectedEvent.assignments?.filter((assignment: any) => assignment.user) || []
                      
                      return (
                        <div className="mt-3">
                          <label className="block text-sm font-medium text-gray-700 mb-2">Event Participants</label>
                          {participants.length > 0 ? (
                            <>
                              <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-300 rounded-lg p-3">
                                {participants.map((assignment: any) => (
                                  <div key={assignment.id} className="flex items-center p-2 bg-blue-50 rounded">
                                    <div className="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
                                    <div className="flex-1">
                                      <div className="font-medium text-gray-900">
                                        {assignment.user.firstName} {assignment.user.lastName}
                                      </div>
                                      <div className="text-sm text-gray-500">
                                        {assignment.user.email} • {assignment.roleName}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                              <p className="text-sm text-gray-500 mt-2">
                                Message will be sent to {participants.length} event participants
                              </p>
                            </>
                          ) : (
                            <p className="text-sm text-gray-500 mt-1">
                              No participants assigned to this event yet.
                            </p>
                          )}
                        </div>
                      )
                    })()
                  ) : (
                    <p className="text-sm text-gray-500 mt-1">
                      Select an event to see its participants.
                    </p>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* Send Method */}
          <section>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                              <MessageSquare className="h-5 w-5 mr-2 text-secondary-600" />
              Communication Method
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                type="button"
                onClick={() => setMessageData(prev => ({ ...prev, sendMethod: 'email' }))}
                className={`flex flex-col items-center p-4 border-2 rounded-lg transition-colors ${
                  messageData.sendMethod === 'email'
                    ? 'border-secondary-500 bg-secondary-50 text-secondary-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <Mail className="h-8 w-8 mb-2" />
                <span className="font-medium">Email Only</span>
              </button>

              <button
                type="button"
                onClick={() => setMessageData(prev => ({ ...prev, sendMethod: 'sms' }))}
                className={`flex flex-col items-center p-4 border-2 rounded-lg transition-colors ${
                  messageData.sendMethod === 'sms'
                    ? 'border-secondary-500 bg-secondary-50 text-secondary-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <Phone className="h-8 w-8 mb-2" />
                <span className="font-medium">SMS Only</span>
              </button>

              <button
                type="button"
                onClick={() => setMessageData(prev => ({ ...prev, sendMethod: 'both' }))}
                className={`flex flex-col items-center p-4 border-2 rounded-lg transition-colors ${
                  messageData.sendMethod === 'both'
                    ? 'border-secondary-500 bg-secondary-50 text-secondary-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex space-x-1 mb-2">
                  <Mail className="h-6 w-6" />
                  <Phone className="h-6 w-6" />
                </div>
                <span className="font-medium">Both</span>
              </button>
            </div>
          </section>

          {/* Message Content */}
          <section>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Message Content</h3>
            <div className="space-y-4">
              {/* Only show subject line for email messages */}
              {messageData.sendMethod !== 'sms' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Subject *</label>
                  <input
                    type="text"
                    name="subject"
                    value={messageData.subject}
                    onChange={handleInputChange}
                    required={messageData.sendMethod !== 'sms'}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-secondary-500 focus:border-transparent text-gray-900"
                    placeholder="Message subject..."
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Message *</label>
                <textarea
                  name="message"
                  value={messageData.message}
                  onChange={handleInputChange}
                  required
                  rows={6}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-secondary-500 focus:border-transparent text-gray-900"
                  placeholder="Write your message here..."
                />
                <p className="text-sm text-gray-500 mt-1">
                  {messageData.sendMethod === 'sms' || messageData.sendMethod === 'both' 
                    ? 'Keep SMS messages under 160 characters for best delivery.' 
                    : 'You can use formatting and include links in email messages.'}
                </p>
              </div>
            </div>
          </section>

          {/* Message Options */}
          <section>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Options</h3>
            <div className="space-y-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  name="scheduleSend"
                  checked={messageData.scheduleSend}
                  onChange={handleInputChange}
                  className="mr-3"
                />
                <div>
                  <span className="font-medium text-gray-900">Schedule Send</span>
                  <p className="text-sm text-gray-500">Send at a specific date and time</p>
                </div>
              </label>

              {messageData.scheduleSend && (
                <div className="grid grid-cols-2 gap-4 ml-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
                    <input
                      type="date"
                      name="scheduleDate"
                      value={messageData.scheduleDate}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-secondary-500 focus:border-transparent text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Time</label>
                    <input
                      type="time"
                      name="scheduleTime"
                      value={messageData.scheduleTime}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-secondary-500 focus:border-transparent text-gray-900"
                    />
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Form Actions */}
          <div className="flex justify-end space-x-4 pt-6 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
                              className="flex items-center px-6 py-2 bg-secondary-600 text-white rounded-lg hover:bg-secondary-700 transition-colors disabled:opacity-50"
            >
              <Send className="h-4 w-4 mr-2" />
              {loading ? 'Sending...' : messageData.scheduleSend ? 'Schedule Message' : 'Send Message'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
} 
'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { X, Mail, MessageSquare, Users, Send, Phone } from 'lucide-react'

interface SendMessageModalProps {
  isOpen: boolean
  onClose: () => void
  onMessageSent?: () => void
}

export function SendMessageModal({ isOpen, onClose, onMessageSent }: SendMessageModalProps) {
  const { data: session } = useSession()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [messageData, setMessageData] = useState({
    subject: '',
    message: '',
    recipients: 'all', // 'all', 'musicians', 'specific', 'event'
    specificEmails: '',
    sendMethod: 'email', // 'email', 'sms', 'both'
    urgent: false,
    scheduleSend: false,
    scheduleDate: '',
    scheduleTime: ''
  })

  const recipientOptions = [
    { value: 'all', label: 'All Church Members' },
    { value: 'musicians', label: 'All Musicians' },
    { value: 'directors', label: 'Directors & Pastors' },
    { value: 'accompanists', label: 'Accompanists Only' },
    { value: 'vocalists', label: 'Vocalists Only' },
    { value: 'individual', label: 'Select Individual People' },
    { value: 'specific', label: 'Enter Email Addresses' },
    { value: 'event', label: 'Event Participants' }
  ]

  // Mock data for invited musicians who have accepted
  const availableMusicians = [
    { id: '1', name: 'John Smith', email: 'john@example.com', role: 'Organist' },
    { id: '2', name: 'Mary Johnson', email: 'mary@example.com', role: 'Vocalist' },
    { id: '3', name: 'David Wilson', email: 'david@example.com', role: 'Guitarist' },
    { id: '4', name: 'Sarah Brown', email: 'sarah@example.com', role: 'Pianist' },
    { id: '5', name: 'Michael Davis', email: 'michael@example.com', role: 'Cantor' }
  ]

  const [selectedIndividuals, setSelectedIndividuals] = useState<string[]>([])

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
      // Determine recipients
      let recipients: string[] | string = 'all'
      
      if (messageData.recipients === 'individual') {
        recipients = selectedIndividuals
      } else if (messageData.recipients === 'specific') {
        recipients = messageData.specificEmails
          .split(',')
          .map(email => email.trim())
          .filter(email => email.includes('@'))
      } else if (messageData.recipients === 'invited') {
        // For now, just use all musicians - could enhance later with invitation status
        recipients = availableMusicians.map(m => m.id)
      } else if (messageData.recipients === 'accepted') {
        // For now, just use all musicians - could enhance later with acceptance status
        recipients = availableMusicians.map(m => m.id)
      }

      // Map send method to API format
      const typeMap: { [key: string]: string } = {
        'email': 'EMAIL',
        'sms': 'SMS',
        'both': 'BOTH'
      }

      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          subject: messageData.subject,
          message: messageData.message,
          type: typeMap[messageData.sendMethod],
          recipients,
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
        urgent: false,
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
    <div className="fixed inset-0 bg-gray-500 bg-opacity-50 z-50 flex items-center justify-center p-4">
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

              {messageData.recipients === 'individual' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Select People</label>
                  <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-300 rounded-lg p-3">
                    {availableMusicians.map((musician) => (
                      <label key={musician.id} className="flex items-center p-2 hover:bg-gray-50 rounded">
                        <input
                          type="checkbox"
                          checked={selectedIndividuals.includes(musician.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedIndividuals([...selectedIndividuals, musician.id])
                            } else {
                              setSelectedIndividuals(selectedIndividuals.filter(id => id !== musician.id))
                            }
                          }}
                          className="mr-3"
                        />
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">{musician.name}</div>
                          <div className="text-sm text-gray-500">{musician.email} • {musician.role}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                  <p className="text-sm text-gray-500 mt-2">
                    {selectedIndividuals.length} people selected
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-secondary-500 focus:border-transparent text-gray-900"
                  >
                    <option value="">No events created yet</option>
                  </select>
                  <p className="text-sm text-gray-500 mt-1">
                    Create an event first to message its participants
                  </p>
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
                <span className="text-sm text-gray-500">Via Resend</span>
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
                <span className="text-sm text-gray-500">Via Twilio</span>
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
                <span className="text-sm text-gray-500">Email + SMS</span>
              </button>
            </div>
          </section>

          {/* Message Content */}
          <section>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Message Content</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Subject *</label>
                <input
                  type="text"
                  name="subject"
                  value={messageData.subject}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-secondary-500 focus:border-transparent text-gray-900"
                  placeholder="Message subject..."
                />
              </div>

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
                  name="urgent"
                  checked={messageData.urgent}
                  onChange={handleInputChange}
                  className="mr-3"
                />
                <div>
                  <span className="font-medium text-gray-900">Mark as Urgent</span>
                  <p className="text-sm text-gray-500">Adds priority flags and urgent indicators</p>
                </div>
              </label>

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
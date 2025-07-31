import TMClient from 'textmagic-rest-client'

interface SMSMessage {
  to: string
  message: string
  from?: string
}

interface SMSResponse {
  success: boolean
  messageId?: string | number
  error?: string
  details?: any
}

class TextMagicService {
  private client: any
  private isConfigured: boolean

  constructor() {
    this.isConfigured = this.validateConfig()
    
    if (this.isConfigured) {
      this.client = new TMClient(
        process.env.TEXTMAGIC_USERNAME!,
        process.env.TEXTMAGIC_API_KEY!
      )
    }
  }

  private validateConfig(): boolean {
    return !!(process.env.TEXTMAGIC_USERNAME && process.env.TEXTMAGIC_API_KEY)
  }

  private formatPhoneNumber(phone: string): string {
    // Remove all non-numeric characters
    let cleaned = phone.replace(/\D/g, '')
    
    // If it starts with 1 and is 11 digits, remove the leading 1
    if (cleaned.length === 11 && cleaned.startsWith('1')) {
      cleaned = cleaned.substring(1)
    }
    
    // If it's 10 digits, assume US number and add country code
    if (cleaned.length === 10) {
      cleaned = '1' + cleaned
    }
    
    // If it doesn't start with a country code, assume US
    if (cleaned.length === 10) {
      cleaned = '1' + cleaned
    }
    
    return cleaned
  }

  async sendSMS({ to, message, from }: SMSMessage): Promise<SMSResponse> {
    try {
      if (!this.isConfigured) {
        console.warn('TextMagic not configured - SMS sending disabled')
        return {
          success: false,
          error: 'TextMagic not configured. SMS sending is disabled.'
        }
      }

      // Format the phone number
      const formattedPhone = this.formatPhoneNumber(to)
      
      // Prepare the message data
      const messageData: any = {
        text: message,
        phones: formattedPhone
      }

      // Add sender ID if provided and configured
      if (from && process.env.TEXTMAGIC_SENDER_ID) {
        messageData.from = process.env.TEXTMAGIC_SENDER_ID
      }

      console.log(`📱 Sending SMS to ${formattedPhone}: ${message.substring(0, 50)}...`)

      // Send the SMS
      const result = await new Promise((resolve, reject) => {
        this.client.Messages.send(messageData, (err: any, res: any) => {
          if (err) {
            console.error('TextMagic send error:', err)
            reject(err)
          } else {
            console.log('TextMagic send result:', res)
            resolve(res)
          }
        })
      })

      return {
        success: true,
        messageId: (result as any)?.id || (result as any)?.messageId,
        details: result
      }

    } catch (error) {
      console.error('SMS sending failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send SMS',
        details: error
      }
    }
  }

  async checkBalance(): Promise<{ success: boolean; balance?: number; currency?: string; error?: string }> {
    try {
      if (!this.isConfigured) {
        return {
          success: false,
          error: 'TextMagic not configured'
        }
      }

      const result = await new Promise((resolve, reject) => {
        this.client.User.getCurrent((err: any, res: any) => {
          if (err) {
            reject(err)
          } else {
            resolve(res)
          }
        })
      })

      const userData = result as any
      return {
        success: true,
        balance: userData.balance,
        currency: userData.currency
      }

    } catch (error) {
      console.error('Failed to check TextMagic balance:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to check balance'
      }
    }
  }

  isAvailable(): boolean {
    return this.isConfigured
  }
}

// Export singleton instance
export const textMagicService = new TextMagicService()

// Export types
export type { SMSMessage, SMSResponse }

// Export helper function for easy SMS sending
export async function sendSMS(to: string, message: string, from?: string): Promise<SMSResponse> {
  return textMagicService.sendSMS({ to, message, from })
}

// Export function to check if SMS is available
export function isSMSAvailable(): boolean {
  return textMagicService.isAvailable()
}
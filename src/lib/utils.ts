import { prisma } from './db'

// Generate a unique 8-character alphanumeric referral code
export async function generateReferralCode(): Promise<string> {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code: string
  let isUnique = false
  
  while (!isUnique) {
    code = ''
    for (let i = 0; i < 8; i++) {
      code += characters.charAt(Math.floor(Math.random() * characters.length))
    }
    
    // Check if code already exists
    const existingChurch = await prisma.church.findUnique({
      where: { referralCode: code }
    })
    
    if (!existingChurch) {
      isUnique = true
    }
  }
  
  return code!
}

// Validate referral code format
export function isValidReferralCode(code: string): boolean {
  return /^[A-Z0-9]{8}$/.test(code)
}

// Calculate monthly subscription price based on plan
export function getMonthlyPrice(subscriptionStatus: string): number {
  // You can adjust these prices based on your actual pricing
  switch (subscriptionStatus) {
    case 'monthly':
      return 29.99
    case 'annual':
      return 299.99 / 12 // Annual price divided by 12
    default:
      return 29.99
  }
} 
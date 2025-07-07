import { prisma } from './db'
import { getMonthlyPrice as getPricingMonthlyPrice, getAnnualPrice } from './pricing'

// Generate a unique referral code in format CHURCHNAME + order number
export async function generateReferralCode(churchName?: string): Promise<string> {
  if (!churchName) {
    // Fallback to old 8-character format if no church name provided
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

  // Generate church name prefix (remove non-alphanumeric, uppercase, max 15 chars)
  const churchPrefix = churchName
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
    .substring(0, 15)

  // Get the count of existing churches to determine order number
  const churchCount = await prisma.church.count()
  const orderNumber = churchCount + 1

  // Create the referral code
  const code = `${churchPrefix}${orderNumber}`
  
  // Check if this exact code already exists (unlikely but better to be safe)
  const existingChurch = await prisma.church.findUnique({
    where: { referralCode: code }
  })
  
  if (existingChurch) {
    // If somehow the code exists, append a random number
    const randomSuffix = Math.floor(Math.random() * 99)
    return `${code}${randomSuffix}`
  }
  
  return code
}

// Validate referral code format (accepts both old 8-char format and new CHURCHNAME+NUMBER format)
export function isValidReferralCode(code: string): boolean {
  // New format: CHURCHNAME + number (e.g., STMARYS60, HOLYTRINITYCHURCH123)
  // Old format: 8 alphanumeric characters (e.g., ABC12345)
  return /^[A-Z0-9]{1,20}$/.test(code) && code.length >= 3
  }

// Calculate monthly subscription price based on plan
export function getMonthlyPrice(subscriptionStatus: string): number {
  switch (subscriptionStatus) {
    case 'monthly':
      return getPricingMonthlyPrice()
    case 'annual':
      return getAnnualPrice() / 12 // Annual price divided by 12
    default:
      return getPricingMonthlyPrice()
  }
} 
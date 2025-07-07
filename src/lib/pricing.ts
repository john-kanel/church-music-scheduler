// Centralized pricing configuration
export const PRICING = {
  monthly: {
    price: 35,
    interval: 'month',
    description: 'Monthly Plan'
  },
  annual: {
    price: 200,
    interval: 'year', 
    description: 'Annual Plan'
  }
} as const

// Helper functions for formatting prices
export const formatPrice = (amount: number): string => {
  return `$${amount.toFixed(2)}`
}

export const getMonthlyPrice = (): number => PRICING.monthly.price
export const getAnnualPrice = (): number => PRICING.annual.price
export const getMonthlyPriceFormatted = (): string => formatPrice(PRICING.monthly.price)
export const getAnnualPriceFormatted = (): string => formatPrice(PRICING.annual.price)

// Calculate annual savings
export const getAnnualSavings = (): number => {
  return (PRICING.monthly.price * 12) - PRICING.annual.price
}

export const getAnnualSavingsFormatted = (): string => {
  return formatPrice(getAnnualSavings())
} 
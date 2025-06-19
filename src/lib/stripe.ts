import { loadStripe } from '@stripe/stripe-js'
import Stripe from 'stripe'

// Client-side Stripe
export const getStripe = () => {
  return loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)
}

// Server-side Stripe
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-05-28.basil',
})

export interface PriceData {
  id: string
  nickname: string | null
  unit_amount: number | null
  currency: string
  recurring: {
    interval: string
    interval_count: number
  } | null
}

export const PRICE_IDS = {
  monthly: 'price_1RbkRKDKZUjfTbRbPIstDXUV',
  annual: 'price_1RbkgaDKZUjfTbRbrVKLe5Hq',
} as const

// Product IDs for reference
export const PRODUCT_IDS = {
  monthly: 'prod_SWo3LqIHLsFE5l',
  annual: 'prod_SWoJBi03wKgdLj',
} as const

export type PlanType = keyof typeof PRICE_IDS 
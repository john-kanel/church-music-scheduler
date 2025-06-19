# Stripe Integration Setup

## Environment Variables Needed

Add these to your `.env` file:

```env
# Stripe Keys
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_live_51RbkI5DKZUjfTbRb0C0f2YlJFAZ4Z4TvC1e5oSMBnb5HO6BPCYpSfaJaF2f5nO3VtRxQ0Gj90bztFZmikTetBxAU00StKH0S7N"
STRIPE_SECRET_KEY="sk_live_..." # You need to provide your secret key
STRIPE_WEBHOOK_SECRET="whsec_..." # Generated when you create webhook
```

## Next Steps in Stripe Dashboard

1. **✅ Products Created:**
   - Monthly Plan: prod_SWo3LqIHLsFE5l
   - Annual Plan: prod_SWoJBi03wKgdLj
   
2. **✅ Price IDs Added:**
   - Monthly: price_1RbkRKDKZUjfTbRbPIstDXUV ($35/month)
   - Annual: price_1RbkgaDKZUjfTbRbrVKLe5Hq ($200/year)

2. **Create Webhook Endpoint:**
   - URL: `https://yourdomain.com/api/stripe/webhook`
   - Events to listen for:
     - `customer.subscription.created`
     - `customer.subscription.updated` 
     - `customer.subscription.deleted`
     - `invoice.payment_succeeded`
     - `invoice.payment_failed`

3. **Enable Customer Portal:**
   - Go to Billing → Customer Portal
   - Enable portal and configure settings

## Files Updated

- ✅ Billing page with two-plan structure ($35/month, $200/year)
- ✅ Homepage highlighting annual savings (52% off)
- ✅ Stripe integration functions
- ✅ API routes for checkout and customer portal
- ✅ Settings page showing plan status

## What Works Now

- Pricing display with savings calculations
- Stripe checkout integration (needs your Price IDs)
- Customer portal integration (needs setup)
- Annual plan highlights $220 savings

## What You Need to Provide

1. ✅ Your Stripe Publishable Key (added)
2. ⚠️ Your Stripe Secret Key (`sk_live_...`)
3. ✅ Your Price IDs (added):
   - Monthly Price ID: `price_1RbkRKDKZUjfTbRbPIstDXUV` (for $35/month)
   - Annual Price ID: `price_1RbkgaDKZUjfTbRbrVKLe5Hq` (for $200/year)
4. ⚠️ Webhook secret after creating webhook endpoint

## ✅ Integration Status

- ✅ **Publishable Key**: Added to configuration
- ✅ **Product IDs**: Monthly (prod_SWo3LqIHLsFE5l), Annual (prod_SWoJBi03wKgdLj)  
- ✅ **Price IDs**: Monthly (price_1RbkRKDKZUjfTbRbPIstDXUV), Annual (price_1RbkgaDKZUjfTbRbrVKLe5Hq)
- ⚠️ **Secret Key**: Still needed for server-side operations
- ⚠️ **Webhook**: Still needs to be configured

## Ready to Test!

Your billing page should now show:
- Monthly plan: $35/month button will create Stripe checkout
- Annual plan: $200/year with "Save $220!" highlighting
- Both buttons will redirect to Stripe checkout (once secret key is added) 
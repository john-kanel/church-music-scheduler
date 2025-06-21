# Railway Environment Variables Checklist

## Required Environment Variables for Railway:

### Authentication
- `NEXTAUTH_SECRET` ✅ (You have this)
- `NEXTAUTH_URL` - Set to your Railway domain (e.g., `https://your-app.up.railway.app`)

### Database  
- `DATABASE_URL` - Should be auto-set by Railway PostgreSQL service

### Email (Optional but recommended)
- `RESEND_API_KEY` - For sending invitation emails

### Optional
- `NODE_ENV=production` - Railway usually sets this automatically

## How to Set Environment Variables in Railway:

1. Go to your Railway project dashboard
2. Click on your app service (not the database)
3. Go to the "Variables" tab
4. Add each variable with its value

## Generate NEXTAUTH_SECRET:
```bash
openssl rand -base64 32
```

## Find your Railway URL:
1. In Railway dashboard, go to your app service
2. Look for the "Deployments" or "Settings" tab
3. Your URL will be something like: `https://your-app-name.up.railway.app`

## Test Commands:
Once you have the correct Railway URL, test these:

```bash
# Replace YOUR_RAILWAY_URL with your actual Railway URL
curl -s https://YOUR_RAILWAY_URL/api/debug/railway
curl -s https://YOUR_RAILWAY_URL/api/auth/session
``` 
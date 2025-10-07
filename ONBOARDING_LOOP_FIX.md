# Onboarding Loop Fix

## What Was The Problem?

Users signing up for a trial were getting stuck in an infinite loop where they'd complete the onboarding prompts (adding service sections, pastor info, etc.), click "Continue", but then see the same prompts again instead of reaching their Dashboard.

**Root Cause:** The database was being updated with `hasCompletedOnboarding: true`, but the user's session token (JWT) wasn't being refreshed. So when the page reloaded, it read the old session data that still said `hasCompletedOnboarding: false`.

## What Was Fixed?

### 1. **Session Update on Completion** (`src/lib/auth.ts`)
- Added support for refreshing the session token when needed
- When `update()` is called on the session, it now fetches fresh user data from the database
- This ensures the token always has the latest `hasCompletedOnboarding` status

### 2. **Onboarding Flow** (`src/components/dashboard/onboarding-flow.tsx`)
- After saving completion status to the database, it now explicitly refreshes the user's session
- Added better error handling to ensure the database update succeeds
- The session is automatically updated so it knows the user completed onboarding

### 3. **Dashboard** (`src/components/dashboard/director-dashboard.tsx`)
- Removed the page reload that was causing issues
- Added automatic detection of session/database mismatches
- If a user's database says "completed" but their session says "not completed", it will automatically refresh

### 4. **Manual Fix Script** (`scripts/fix-stuck-onboarding-user.ts`)
- Created a script to manually fix any user currently stuck in the loop

## For Users Currently Stuck

### Automatic Fix (After Code is Deployed)
Once the fix is deployed, stuck users have two options:

**Option 1: Complete Onboarding Again**
- Go through the onboarding prompts one more time
- This time when they click "Continue", the fix will kick in
- Their session will be updated correctly and they'll reach the Dashboard

**Option 2: Sign Out and Back In**
- If their database already has `hasCompletedOnboarding: true`
- Simply signing out and signing back in will load fresh data from the database
- The automatic detection will handle the rest

### Manual Fix (For Immediate Help)

If you need to fix a specific user right away:

1. **Get the user's email address**

2. **Run the fix script:**
   ```bash
   npx tsx scripts/fix-stuck-onboarding-user.ts user@email.com
   ```

3. **Tell the user to refresh their browser**
   - Press F5 or Cmd+R
   - They should automatically see the Dashboard
   - If not, have them sign out and sign back in

## Testing the Fix

To test that the fix works:

1. **Create a new trial account**
2. **Go through all onboarding steps** (personal info, service parts, pastor info, etc.)
3. **Click "Continue" on the final congratulations screen**
4. **Verify:** You should land on the Dashboard without seeing the onboarding prompts again
5. **Refresh the page** to ensure it doesn't come back

## For the Customer Who Reported This

1. **Ask for their email address**
2. **Run the manual fix script** with their email
3. **Tell them to:**
   - Refresh their browser (F5 or Cmd+R)
   - If that doesn't work, sign out and sign back in
   - They should now see their Dashboard

The fix prevents this from happening to any future users!


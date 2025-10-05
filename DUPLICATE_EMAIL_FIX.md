# 🔴 DUPLICATE TRIAL REMINDER EMAIL FIX

## What Was Wrong

I found **THREE critical issues** causing duplicate trial expiration emails:

### 1. **Weak Database Constraint** 
The unique index used a `WHERE` clause that wasn't strong enough to prevent all duplicates. The partial index only applied when specific conditions were met.

### 2. **Cron Job Running Too Frequently**
Based on the email timestamps (emails sent 4, 9, 14, 19, 24, 29 minutes apart), your cron job appears to be running **every 5 minutes** instead of once daily. This caused the system to:
- Find the same churches over and over
- Try to create reminder emails repeatedly
- Overwhelm the database with duplicate requests

### 3. **Race Conditions**
When the cron ran multiple times concurrently, multiple processes could pass the deduplication check simultaneously before any database record was created, allowing duplicates through.

---

## 🔧 What I Fixed

### 1. **New Database Migration**
Created a stronger unique constraint that will prevent ANY duplicate trial reminders at the database level:
- File: `prisma/migrations/20251005000000_fix_trial_reminder_unique_constraint/migration.sql`
- This migration will also **automatically delete existing duplicates** when applied

### 2. **Improved Cron Job Code**
Enhanced `src/app/api/cron/trial-reminders/route.ts` with:
- Better duplicate detection logic
- Comprehensive error handling for unique constraint violations
- Detailed logging to track what's happening
- Graceful handling of concurrent runs

### 3. **Cleanup Script**
Created `scripts/cleanup-duplicate-trial-reminders.js` to immediately remove existing duplicates

---

## 🚨 IMMEDIATE STEPS TO FIX

### Step 1: Stop the Bleeding (2 minutes)

**Run the cleanup script RIGHT NOW to delete existing duplicates:**

```bash
cd /Users/Exodus/church-music-scheduler
node scripts/cleanup-duplicate-trial-reminders.js
```

This will show you how many duplicates exist and delete them.

### Step 2: Apply the Database Migration (3 minutes)

**Apply the new database constraint to production:**

```bash
# This pushes the migration to your Railway database
npx prisma migrate deploy
```

**IMPORTANT:** If this fails with an error about existing duplicates, run Step 1 again first, then retry this command.

### Step 3: Check Your Cron Schedule on Railway (5 minutes)

**This is CRITICAL** - you need to verify how often your cron jobs are running.

1. **Log into Railway Dashboard**
   - Go to your project
   - Find your cron worker service

2. **Check the Schedule**
   - Look for where you configured the `trial-reminders` job
   - It should run **ONCE per day** (e.g., `0 9 * * *` for 9am daily)
   - If it's running every few minutes, THAT'S your main problem

3. **Correct Schedule Examples:**
   ```
   # Once daily at 9am
   0 9 * * *
   
   # Once daily at 3am  
   0 3 * * *
   ```

4. **WRONG (will cause duplicates):**
   ```
   # Every 5 minutes - BAD!
   */5 * * * *
   
   # Every hour - TOO OFTEN!
   0 * * * *
   ```

### Step 4: Deploy the Code Changes (2 minutes)

**Push the updated code to Railway:**

```bash
git add .
git commit -m "Fix: Prevent duplicate trial reminder emails"
git push origin main
```

Railway will automatically deploy the changes.

### Step 5: Verify the Fix (10 minutes)

**Monitor the logs after deployment:**

1. Go to Railway dashboard
2. Open logs for your main app
3. Wait for the next time the `trial-reminders` cron runs
4. Look for these new log messages:
   ```
   [TRIAL-REMINDERS] Starting trial reminders cron job
   [TRIAL-REMINDERS] Found X churches in trial
   [TRIAL-REMINDERS] ✓ Reminder already exists...
   [TRIAL-REMINDERS] Completed: X queued, Y skipped, 0 errors
   ```

5. You should see mostly "skipped" messages (reminders already exist)
6. You should see NO errors about duplicates

---

## 🎯 Expected Behavior After Fix

### Before (Bad):
- Cron runs every 5 minutes
- Creates duplicate email schedules each time
- Sends same email multiple times per hour
- Customer gets 10+ identical emails

### After (Good):
- Cron runs once per day
- Checks if reminders already exist
- Skips if already created
- Customer gets exactly 1 email per reminder (at 7 days, 1 day, and day-of)

---

## 📊 How to Verify It's Working

### Check 1: Database Query
Run this to see if duplicates exist:

```bash
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.emailSchedule.groupBy({
  by: ['churchId', 'userId', 'reminderOffset'],
  where: { reminderType: 'TRIAL_ENDING_REMINDER' },
  _count: true,
  having: { id: { _count: { gt: 1 } } }
}).then(r => {
  console.log('Duplicate groups found:', r.length);
  console.log(r);
  process.exit(0);
});
"
```

Expected result: **0 duplicate groups**

### Check 2: Monitor Your Email Service
- Check Resend dashboard
- For the next few hours, watch trial reminder emails
- Each customer should receive only 1 email per day

### Check 3: Cron Logs
- In Railway, check the cron worker logs
- The `trial-reminders` job should run only once per day
- You should see: "X skipped" (not "X queued") for subsequent runs

---

## 🔒 Prevention Measures Now in Place

1. **Database Constraint**: Physically prevents duplicates at the database level
2. **Better Deduplication**: Application checks for existing reminders before creating new ones
3. **Error Handling**: Gracefully catches unique constraint violations
4. **Comprehensive Logging**: Makes it easy to see what's happening
5. **Documentation**: Clear warning that this should run once daily

---

## ❓ FAQ

**Q: Will existing customers who received duplicates get more emails?**
A: No. Once the cleanup script runs and the migration is applied, the duplicate scheduled emails will be deleted. Only one reminder per customer will remain.

**Q: Will this affect other email types (event notifications, etc.)?**
A: No. This fix only affects trial ending reminder emails. All other notifications work independently.

**Q: What if I see duplicates again?**
A: Check your Railway cron schedule first. If it's set to run too frequently, that's the issue. The cron should run **once per day maximum**.

**Q: Can I run the cleanup script multiple times?**
A: Yes, it's safe to run multiple times. It will just report "0 duplicates found" if everything is clean.

---

## 📞 Next Steps if Still Having Issues

If you still see duplicate emails after completing all 5 steps above:

1. Run the cleanup script again
2. Check Railway logs for any errors
3. Share the Railway cron configuration
4. Check that the migration was successfully applied with: `npx prisma migrate status`

---

## Summary

- **Root Cause**: Cron running too frequently + weak database constraint
- **Fix Applied**: Stronger constraint + better code + cleanup script
- **Action Required**: Run cleanup script, apply migration, fix cron schedule
- **Expected Result**: Each customer gets exactly 1 trial reminder email per day (at 7d, 1d, 0d before expiry)


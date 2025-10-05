# 🚨 QUICK FIX - Copy and Paste These Commands

Run these commands **IN ORDER** to stop the duplicate emails immediately:

## 1️⃣ Delete Existing Duplicates (RIGHT NOW)
```bash
cd /Users/Exodus/church-music-scheduler
node scripts/cleanup-duplicate-trial-reminders.js
```

## 2️⃣ Apply Database Fix
```bash
npx prisma migrate deploy
```

## 3️⃣ Deploy Code Changes
```bash
git add .
git commit -m "Fix: Prevent duplicate trial reminder emails with stronger constraints and better logging"
git push origin main
```

## 4️⃣ Check Railway Cron Schedule
⚠️ **CRITICAL**: Log into Railway and verify:
- Go to your cron worker service
- Check the schedule for `trial-reminders`
- Should be: `0 9 * * *` (once daily at 9am)
- NOT: `*/5 * * * *` (every 5 minutes)

## 5️⃣ Verify Fix is Working (wait 1 hour, then run):
```bash
node -e "const { PrismaClient } = require('@prisma/client'); const p = new PrismaClient(); p.emailSchedule.findMany({ where: { reminderType: 'TRIAL_ENDING_REMINDER', createdAt: { gte: new Date(Date.now() - 3600000) } } }).then(r => { console.log('Trial reminders created in last hour:', r.length); if(r.length > 10) console.log('⚠️ Still seeing duplicates!'); else console.log('✅ Looks good!'); process.exit(0); });"
```

---

## What Each Command Does

1. **Cleanup script**: Deletes all duplicate trial reminder emails from your database
2. **Migrate deploy**: Adds a database constraint that prevents duplicates from being created
3. **Git commands**: Deploys the improved code with better duplicate detection
4. **Railway check**: Ensures the cron isn't running too often (main cause of duplicates)
5. **Verification**: Checks if new duplicates are still being created

---

## Expected Output

### After Step 1 (Cleanup):
```
✅ CLEANUP COMPLETE!
   Deleted 47 duplicate trial reminder records
   Remaining records: 3
```

### After Step 2 (Migration):
```
Migration applied successfully
```

### After Step 5 (Verification):
```
Trial reminders created in last hour: 0
✅ Looks good!
```

If you see "Still seeing duplicates!" - check your Railway cron schedule (Step 4).


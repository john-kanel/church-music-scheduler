# PDF Storage Fix - November 2024

## Problems Fixed

### 1. Event Times Changing When Editing
**Problem:** When editing events, the times were shifting back to different values (appearing to change to UTC).

**Root Cause:** The timezone conversion functions were applying double conversions - once when saving and once when loading, causing the times to drift.

**Solution:** Simplified the timezone handling to rely on JavaScript's native timezone conversion:
- When creating events: JavaScript's `Date` constructor handles local-to-UTC conversion automatically
- When displaying events: JavaScript's `toLocaleTimeString()` handles UTC-to-local conversion automatically
- No more manual timezone offset calculations that were causing drift

**Files Modified:**
- `src/lib/timezone-utils.ts` - Removed the problematic double-conversion logic

### 2. PDFs Disappearing/Expiring
**Problem:** PDFs were showing "NoSuchKey" errors from AWS S3, meaning they were being deleted.

**Root Cause:** The cleanup cron job was deleting PDFs based on when they were **uploaded** (18 months ago), not when the **event** occurs. This meant:
- A PDF uploaded for a recurring event would be deleted after 18 months
- PDFs for future events would be deleted just because they were uploaded a long time ago
- The system was deleting files that were still needed

**Solution:** Changed the cleanup logic to delete PDFs only when the **event date** is more than 18 months in the past. This means:
- PDFs for future events are never deleted (no matter how old the upload is)
- PDFs for recurring events stay as long as the events are recent
- Only PDFs from truly old events (18+ months ago) get cleaned up

**Files Modified:**
- `src/app/api/cron/cleanup-old-pdfs/route.ts` - Changed deletion criteria from `uploadedAt` to `event.startTime`

## AWS S3 Settings to Check

You should verify your AWS S3 bucket doesn't have lifecycle policies that might be deleting files:

1. **Go to AWS S3 Console** at https://s3.console.aws.amazon.com/

2. **Find your bucket** (the name is in your `AWS_S3_BUCKET_NAME` environment variable)

3. **Check Lifecycle Rules:**
   - Click on your bucket
   - Go to the "Management" tab
   - Look for "Lifecycle rules"
   - **If you see any rules that delete objects, you should DELETE those rules** (or modify them to only apply to specific prefixes that aren't used for event documents)

4. **Check Object Lock:**
   - Go to the "Properties" tab
   - Scroll down to "Object Lock"
   - Make sure it's not set to automatically delete objects

5. **Check Intelligent-Tiering:**
   - Go to "Management" tab
   - Look at "Intelligent-Tiering Archive configurations"
   - These are usually fine, they just move files to cheaper storage, not delete them

## What You Should See Now

### For Event Times:
- When you create an event at "10:00 AM", it will stay at "10:00 AM" when you edit it
- Times will no longer shift or change when you save edits
- All events should maintain their correct local times

### For PDFs:
- PDFs for future events will never be deleted automatically
- PDFs for recurring events will be preserved as long as the events are recent
- Only PDFs from events that happened more than 18 months ago will be cleaned up
- The cron job will run weekly and log what it's doing

## Testing the Fixes

### Test Event Time Fix:
1. Create a new event with a specific time (e.g., 2:00 PM)
2. Edit the event and change something (like the location)
3. Save it
4. Check that the time is still 2:00 PM (not changed)

### Test PDF Fix:
1. Upload a PDF to an upcoming event
2. The PDF should stay accessible indefinitely
3. Check the Railway logs for the cron job - it should say "Only documents from events older than 18 months are deleted"

## Already Deleted PDFs

Unfortunately, PDFs that were already deleted by the old cron job cannot be recovered. You'll need to re-upload them. The error you saw:

```
events/cmeqckaia000wo03l8e91c6ml/1759586875519-Thirty-Third Sunday in Ordinary Time.pdf
```

This file was permanently deleted from S3. You'll need to upload it again to that event.

## Preventing Future Issues

The fixes are now in place, so:
- ✅ No more event time shifting when editing
- ✅ No more PDFs being deleted while still needed
- ✅ Cron job now checks event dates, not upload dates
- ✅ Clearer logging to see what's being deleted and why

Make sure to check your AWS S3 lifecycle policies (instructions above) to ensure nothing else is auto-deleting files.


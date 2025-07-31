# SMS Testing Guide

## Quick Test Commands

### Test SMS API directly:
```bash
curl -X POST http://localhost:3000/api/test-sms \
  -H "Content-Type: application/json" \
  -H "Cookie: your-session-cookie" \
  -d '{
    "to": "+15551234567",
    "message": "Test message from Church Music Pro!"
  }'
```

### Check SMS Status:
```bash
curl -X GET http://localhost:3000/api/test-sms \
  -H "Cookie: your-session-cookie"
```

## Testing via UI

1. **Visit** `/test-sms` in your browser
2. **Enter phone number** (use +1 format for US numbers)
3. **Enter test message**
4. **Click "Send Test SMS"**
5. **Check results** in the interface

## Test Message Examples

### Short Test:
```
Hello from Church Music Pro! 🎵
```

### Event Reminder Test:
```
Reminder: Choir practice tomorrow at 7 PM. Please bring your music folder. - Music Director, St. Mary's Church
```

### Emergency Alert Test:
```
URGENT: Sunday service moved to 11 AM due to weather. Please spread the word! - Pastor John
```

## Common Issues

### "SMS service not configured"
- Check your environment variables
- Verify TEXTMAGIC_USERNAME and TEXTMAGIC_API_KEY are set
- Restart your development server

### "Failed to send SMS"
- Check your TextMagic account balance
- Verify phone number format (+1 for US numbers)
- Check TextMagic account status

### "Insufficient permissions"
- Only DIRECTOR, ASSOCIATE_DIRECTOR, and PASTOR roles can send SMS
- Check your user role in the database

## Phone Number Formats

### Supported formats:
- `+15551234567` (preferred)
- `15551234567`
- `(555) 123-4567`
- `555-123-4567`
- `555.123.4567`

### International:
- `+447860021130` (UK)
- `+33123456789` (France)
- `+61412345678` (Australia)

## Integration with Existing Features

### In Messages Page:
- Select "SMS Only" or "Email & SMS" in send method dropdown
- System will automatically filter recipients based on preferences

### In User Profiles:
- Users can toggle SMS notifications on/off
- Phone number is required for SMS notifications

### In Scheduled Messages:
- SMS messages can be scheduled just like emails
- Will be sent via the cron job system

## Cost Considerations

- **TextMagic charges per SMS** sent
- **Check balance** regularly via the test interface
- **Consider message length** - longer messages cost more
- **Test thoroughly** before sending to large groups
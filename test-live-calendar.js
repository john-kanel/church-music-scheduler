const https = require('https');

// Replace this with your actual calendar feed URL (change webcal:// to https://)
const CALENDAR_URL = 'https://churchmusicpro.com/api/calendar-feed/YOUR_TOKEN_HERE.ics';

console.log('🔧 TESTING LIVE CALENDAR FEED');
console.log('============================');
console.log('URL:', CALENDAR_URL);
console.log('');

if (CALENDAR_URL.includes('YOUR_TOKEN_HERE')) {
  console.log('❌ Please update the CALENDAR_URL with your actual feed URL');
  console.log('');
  console.log('To get your URL:');
  console.log('1. Go to https://churchmusicpro.com/calendar-subscribe');
  console.log('2. Open browser Developer Tools > Network tab');
  console.log('3. Look for the /api/calendar-subscription response');
  console.log('4. Find the feedUrl in the response JSON');
  console.log('5. Replace webcal:// with https:// and update this script');
  process.exit(1);
}

const req = https.get(CALENDAR_URL, (res) => {
  let data = '';
  
  console.log(`📡 Response Status: ${res.statusCode} ${res.statusMessage}`);
  console.log(`📡 Content-Type: ${res.headers['content-type']}`);
  console.log(`📡 Content-Length: ${res.headers['content-length']}`);
  console.log('');
  
  res.on('data', chunk => {
    data += chunk;
  });
  
  res.on('end', () => {
    if (res.statusCode === 200) {
      console.log('✅ Calendar feed loaded successfully!');
      console.log(`📏 Total size: ${data.length} bytes`);
      console.log('');
      console.log('📋 First 500 characters:');
      console.log(data.substring(0, 500));
      console.log('');
      console.log('📋 Last 200 characters:');
      console.log(data.substring(data.length - 200));
      console.log('');
      
      // Basic validation
      const lines = data.split('\r\n');
      console.log(`📊 Total lines: ${lines.length}`);
      
      const requiredFields = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'X-WR-TIMEZONE:UTC',
        'BEGIN:VEVENT',
        'DTSTART:',
        'END:VCALENDAR'
      ];
      
      console.log('🔍 Required fields check:');
      requiredFields.forEach(field => {
        const hasField = data.includes(field);
        console.log(`${hasField ? '✅' : '❌'} ${field}`);
      });
      
      // Check line lengths
      const longLines = lines.filter(line => Buffer.from(line, 'utf8').length > 75);
      if (longLines.length > 0) {
        console.log(`⚠️  Found ${longLines.length} lines exceeding 75 bytes`);
        longLines.slice(0, 3).forEach((line, i) => {
          console.log(`   Line ${i + 1}: ${Buffer.from(line, 'utf8').length} bytes`);
        });
      } else {
        console.log('✅ All lines are within 75 bytes');
      }
      
    } else {
      console.log(`❌ Error: ${res.statusCode} ${res.statusMessage}`);
      console.log('Response:', data);
    }
  });
});

req.on('error', (err) => {
  console.log('❌ Request failed:', err.message);
});

req.setTimeout(10000, () => {
  req.destroy();
  console.log('❌ Request timeout');
});

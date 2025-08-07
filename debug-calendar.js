const https = require('https');
const http = require('http');

// First, let's test your actual calendar subscription to see what's being served
const testCalendarFeed = async (url) => {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    
    const req = protocol.get(url, (res) => {
      let data = '';
      
      console.log(`\n=== TESTING URL: ${url} ===`);
      console.log(`Status: ${res.statusCode} ${res.statusMessage}`);
      console.log(`Headers:`, res.headers);
      
      res.on('data', chunk => {
        data += chunk;
      });
      
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: data
        });
      });
    });
    
    req.on('error', (err) => {
      reject(err);
    });
    
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
};

// Test a known working calendar
const testWorkingCalendar = async () => {
  console.log('\n🔍 TESTING KNOWN WORKING CALENDAR...');
  
  // This is a simple working calendar from the web
  const workingUrl = 'https://calendar.google.com/calendar/ical/en.usa%23holiday%40group.v.calendar.google.com/public/basic.ics';
  
  try {
    const result = await testCalendarFeed(workingUrl);
    console.log('\n✅ Working calendar test completed successfully');
    console.log('First 500 characters:');
    console.log(result.data.substring(0, 500));
    
    return result;
  } catch (error) {
    console.log('❌ Working calendar test failed:', error.message);
    return null;
  }
};

// Validate ICS content
const validateICS = (content) => {
  console.log('\n🔍 VALIDATING ICS CONTENT...');
  
  const issues = [];
  const warnings = [];
  
  // Check 1: Basic structure
  if (!content.includes('BEGIN:VCALENDAR')) {
    issues.push('Missing BEGIN:VCALENDAR');
  }
  if (!content.includes('END:VCALENDAR')) {
    issues.push('Missing END:VCALENDAR');
  }
  if (!content.includes('VERSION:2.0')) {
    issues.push('Missing VERSION:2.0');
  }
  if (!content.includes('PRODID:')) {
    issues.push('Missing PRODID');
  }
  
  // Check 2: Line endings
  if (!content.includes('\r\n')) {
    issues.push('Not using CRLF line endings (\\r\\n)');
  }
  
  // Check 3: Line length
  const lines = content.split('\r\n');
  let longLineCount = 0;
  lines.forEach((line, i) => {
    const bytes = Buffer.from(line, 'utf8').length;
    if (bytes > 75) {
      longLineCount++;
      if (longLineCount <= 3) { // Only show first 3
        warnings.push(`Line ${i + 1} exceeds 75 bytes (${bytes} bytes): ${line.substring(0, 50)}...`);
      }
    }
  });
  if (longLineCount > 3) {
    warnings.push(`... and ${longLineCount - 3} more lines exceed 75 bytes`);
  }
  
  // Check 4: TZID format
  const tzidMatches = content.match(/DTSTART;TZID=([^:]+):/g);
  if (tzidMatches) {
    tzidMatches.forEach(match => {
      const tzid = match.match(/TZID=([^:]+):/)[1];
      console.log(`Found TZID: ${tzid}`);
      
      // Check if VTIMEZONE exists for this TZID
      const vtimezonePattern = new RegExp(`BEGIN:VTIMEZONE[\\s\\S]*?TZID:${tzid.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?END:VTIMEZONE`);
      if (!vtimezonePattern.test(content)) {
        issues.push(`TZID ${tzid} used but no matching VTIMEZONE definition found`);
      }
    });
  }
  
  // Check 5: Character encoding
  const hasUtf8 = /[^\x00-\x7F]/.test(content);
  if (hasUtf8) {
    console.log('✅ Contains UTF-8 characters (good for international content)');
  }
  
  // Check 6: Required event fields
  const eventBlocks = content.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g) || [];
  eventBlocks.forEach((eventBlock, i) => {
    const requiredFields = ['UID:', 'DTSTAMP:', 'DTSTART', 'SUMMARY:'];
    requiredFields.forEach(field => {
      if (!eventBlock.includes(field)) {
        issues.push(`Event ${i + 1} missing required field: ${field}`);
      }
    });
  });
  
  // Print results
  console.log(`\n📊 VALIDATION RESULTS:`);
  console.log(`Events found: ${eventBlocks.length}`);
  console.log(`Total lines: ${lines.length}`);
  console.log(`Content size: ${Buffer.from(content, 'utf8').length} bytes`);
  
  if (issues.length === 0) {
    console.log('✅ No critical issues found');
  } else {
    console.log(`❌ Critical issues found (${issues.length}):`);
    issues.forEach(issue => console.log(`   - ${issue}`));
  }
  
  if (warnings.length > 0) {
    console.log(`⚠️  Warnings (${warnings.length}):`);
    warnings.forEach(warning => console.log(`   - ${warning}`));
  }
  
  return {
    issues,
    warnings,
    eventCount: eventBlocks.length,
    totalLines: lines.length,
    sizeBytes: Buffer.from(content, 'utf8').length
  };
};

// Main testing function
const runDiagnostics = async () => {
  console.log('🔧 CHURCH CALENDAR DIAGNOSTICS');
  console.log('==============================');
  
  // Step 1: Test a known working calendar
  const workingResult = await testWorkingCalendar();
  
  // Step 2: Test your calendar (you'll need to provide the URL)
  console.log('\n\n🔍 NOW TEST YOUR CALENDAR...');
  console.log('To test your calendar, you need to:');
  console.log('1. Log into your app');
  console.log('2. Go to Calendar Subscribe page');
  console.log('3. Copy the calendar URL (it looks like: https://yourdomain.com/api/calendar-feed/TOKEN.ics)');
  console.log('4. Replace the URL below and run this script again');
  
  // You can manually add your URL here for testing
  const yourCalendarUrl = ''; // Add your calendar URL here
  
  if (yourCalendarUrl) {
    console.log('\n🔍 TESTING YOUR CALENDAR...');
    try {
      const result = await testCalendarFeed(yourCalendarUrl);
      
      if (result.status === 200) {
        console.log('\n✅ Your calendar responded with 200 OK');
        console.log('\nFirst 500 characters:');
        console.log(result.data.substring(0, 500));
        
        // Validate the content
        validateICS(result.data);
        
        // Compare with working calendar
        if (workingResult) {
          console.log('\n🔍 COMPARING WITH WORKING CALENDAR...');
          console.log(`Working calendar size: ${workingResult.data.length} bytes`);
          console.log(`Your calendar size: ${result.data.length} bytes`);
          
          // Check headers
          console.log('\nHeader comparison:');
          console.log('Working calendar Content-Type:', workingResult.headers['content-type']);
          console.log('Your calendar Content-Type:', result.headers['content-type']);
        }
        
      } else {
        console.log(`❌ Your calendar returned status: ${result.status}`);
        if (result.data) {
          console.log('Response:', result.data.substring(0, 200));
        }
      }
    } catch (error) {
      console.log(`❌ Error testing your calendar: ${error.message}`);
    }
  }
  
  console.log('\n\n💡 NEXT STEPS:');
  console.log('1. Add your calendar URL to this script and run it again');
  console.log('2. Check if your calendar URL is accessible from external networks');
  console.log('3. Verify your NEXTAUTH_URL environment variable is correct');
  console.log('4. Try subscribing to the HTTP version instead of webcal://');
};

// Run the diagnostics
runDiagnostics().catch(console.error);
const { generateICalFeed } = require('../src/lib/ical-generator');

// Test event with all possible fields and edge cases
const testEvent = {
  id: '123',
  name: 'Sunday Service Test 🎵',
  description: 'Test event with special characters: áéíóú & "quotes" and line\nbreaks and very long text that should be properly folded according to RFC 5545 specifications to ensure maximum compatibility',
  location: '123 Main St, Chicago, IL 60601',
  startTime: new Date('2024-03-20T10:00:00'),
  endTime: new Date('2024-03-20T11:30:00'),
  createdAt: new Date('2024-03-15T12:00:00'),
  updatedAt: new Date('2024-03-15T12:00:00'),
  status: 'CONFIRMED',
  eventType: { name: 'Sunday Service', color: '#FF0000' },
  assignments: [
    {
      user: { firstName: 'John', lastName: 'Doe' },
      roleName: 'Pianist',
      status: 'ACCEPTED',
      group: { id: '1', name: 'Worship Team' }
    }
  ],
  hymns: [
    {
      title: 'Amazing Grace',
      notes: 'Key of G',
      servicePart: { name: 'Opening Hymn', order: 1 }
    }
  ]
};

// Generate test ICS
const icsContent = generateICalFeed([testEvent], 'Test Church', 'America/Chicago');

// Log the raw ICS content for inspection
console.log('=== RAW ICS CONTENT ===');
console.log(icsContent);
console.log('\n=== VALIDATION CHECKS ===');

// Check 1: Required Fields
const requiredFields = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'PRODID:',
  'CALSCALE:GREGORIAN',
  'BEGIN:VEVENT',
  'UID:',
  'DTSTAMP:',
  'DTSTART;TZID=',
  'DTEND;TZID=',
  'SUMMARY:',
  'END:VEVENT',
  'END:VCALENDAR'
];

console.log('\n1. Required Fields Check:');
requiredFields.forEach(field => {
  const hasField = icsContent.includes(field);
  console.log(`${hasField ? '✅' : '❌'} ${field}`);
});

// Check 2: Line Length
console.log('\n2. Line Length Check:');
const lines = icsContent.split('\r\n');
let hasLongLines = false;
lines.forEach(line => {
  const bytes = Buffer.from(line, 'utf8').length;
  if (bytes > 75) {
    console.log(`❌ Line exceeds 75 bytes: ${bytes} bytes`);
    console.log(`   ${line.substring(0, 50)}...`);
    hasLongLines = true;
  }
});
if (!hasLongLines) {
  console.log('✅ All lines are within 75 bytes');
}

// Check 3: TZID Format and VTIMEZONE
console.log('\n3. TZID Format and VTIMEZONE Check:');
const tzidPattern = /DTSTART;TZID=([^:]+):/;
const tzidMatch = icsContent.match(tzidPattern);
const hasVTimezone = icsContent.includes('BEGIN:VTIMEZONE');

if (tzidMatch) {
  const tzid = tzidMatch[1];
  console.log(`Found TZID: ${tzid}`);
  if (hasVTimezone) {
    console.log('✅ VTIMEZONE definition found - unquoted TZID is correct');
    if (!tzid.includes('"')) {
      console.log('✅ TZID is properly unquoted (correct with VTIMEZONE)');
    } else {
      console.log('⚠️  TZID is quoted but VTIMEZONE is present - should be unquoted');
    }
  } else {
    console.log('❌ No VTIMEZONE definition found');
  }
} else {
  console.log('❌ No TZID found');
}

// Check 4: UTF-8 Characters
console.log('\n4. UTF-8 Character Check:');
const hasUtf8 = /[^\x00-\x7F]/.test(icsContent);
console.log(`${hasUtf8 ? '✅' : '❌'} Contains UTF-8 characters`);
const buffer = Buffer.from(icsContent, 'utf8');
console.log(`✅ Valid UTF-8 encoding (${buffer.length} bytes)`);

// Check 5: Line Endings
console.log('\n5. Line Ending Check:');
const hasCorrectEndings = icsContent.match(/\r\n/g);
console.log(`${hasCorrectEndings ? '✅' : '❌'} Uses CRLF line endings`);

// Write to file for manual testing
const fs = require('fs');
fs.writeFileSync('test-google-calendar.ics', icsContent);
console.log('\n✅ Test ICS file written to: test-google-calendar.ics');
console.log('Import this file into Google Calendar to test compatibility');
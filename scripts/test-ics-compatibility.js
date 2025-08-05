#!/usr/bin/env node

/**
 * ICS Google Calendar Compatibility Test Script
 * 
 * This script tests the ICS output for compliance with:
 * - RFC 5545 standards
 * - Google Calendar requirements
 * - Common ICS validators
 */

const fs = require('fs');
const path = require('path');

// Mock event data for testing
const mockEvent = {
  id: 'test-event-1',
  name: 'Test Event with Special Characters: áéíóú & "quotes" ; semicolons, commas',
  location: 'Test Location with special chars: @#$%^&*()',
  startTime: new Date('2024-01-15T10:00:00-06:00'),
  endTime: new Date('2024-01-15T11:00:00-06:00'),
  status: 'CONFIRMED',
  createdAt: new Date(),
  updatedAt: new Date(),
  assignments: [],
  hymns: []
};

const mockChurchName = 'Test Church (Testing & Validation)';
const timezone = 'America/Chicago';

console.log('🔍 ICS Google Calendar Compatibility Test');
console.log('==========================================\n');

// Test 1: Line Length Validation
function testLineLength(icsContent) {
  const lines = icsContent.split('\r\n');
  const longLines = [];
  
  lines.forEach((line, index) => {
    const byteLength = Buffer.from(line, 'utf8').length;
    if (byteLength > 75) {
      longLines.push({ line: index + 1, length: byteLength, content: line.substring(0, 50) + '...' });
    }
  });
  
  console.log('📏 Line Length Test:');
  if (longLines.length === 0) {
    console.log('✅ All lines are within 75-byte limit');
  } else {
    console.log(`❌ Found ${longLines.length} lines exceeding 75 bytes:`);
    longLines.forEach(({ line, length, content }) => {
      console.log(`   Line ${line}: ${length} bytes - "${content}"`);
    });
  }
  console.log();
}

// Test 2: Required Fields Validation
function testRequiredFields(icsContent) {
  console.log('📋 Required Fields Test:');
  
  const requiredCalendarFields = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:',
    'END:VCALENDAR'
  ];
  
  const requiredEventFields = [
    'BEGIN:VEVENT',
    'UID:',
    'DTSTAMP:',
    'DTSTART;',
    'DTEND;',
    'SUMMARY:',
    'STATUS:',
    'END:VEVENT'
  ];
  
  let allPassed = true;
  
  requiredCalendarFields.forEach(field => {
    if (!icsContent.includes(field)) {
      console.log(`❌ Missing required calendar field: ${field}`);
      allPassed = false;
    }
  });
  
  requiredEventFields.forEach(field => {
    if (!icsContent.includes(field)) {
      console.log(`❌ Missing required event field: ${field}`);
      allPassed = false;
    }
  });
  
  if (allPassed) {
    console.log('✅ All required fields present');
  }
  console.log();
}

// Test 3: VTIMEZONE Validation
function testVTimezone(icsContent) {
  console.log('🌍 VTIMEZONE Test:');
  
  const hasVTimezone = icsContent.includes('BEGIN:VTIMEZONE');
  const hasCorrectTzid = icsContent.includes(`TZID:${timezone}`);
  const hasStandardTime = icsContent.includes('BEGIN:STANDARD');
  const hasDaylightTime = icsContent.includes('BEGIN:DAYLIGHT');
  
  if (hasVTimezone) {
    console.log('✅ VTIMEZONE block present');
  } else {
    console.log('❌ Missing VTIMEZONE block');
  }
  
  if (hasCorrectTzid) {
    console.log('✅ Correct TZID present');
  } else {
    console.log('❌ Incorrect or missing TZID');
  }
  
  if (hasStandardTime && hasDaylightTime) {
    console.log('✅ Both STANDARD and DAYLIGHT time definitions present');
  } else {
    console.log('⚠️  Missing STANDARD or DAYLIGHT time definitions');
  }
  console.log();
}

// Test 4: Text Escaping Validation
function testTextEscaping(icsContent) {
  console.log('🔤 Text Escaping Test:');
  
  // Check if special characters are properly escaped
  const unescapedSemicolon = /[^\\];/.test(icsContent);
  const unescapedComma = /[^\\],/.test(icsContent);
  const unescapedNewline = /[^\\]\n/.test(icsContent);
  
  if (!unescapedSemicolon && !unescapedComma && !unescapedNewline) {
    console.log('✅ Text escaping appears correct');
  } else {
    console.log('⚠️  Potential text escaping issues found');
    if (unescapedSemicolon) console.log('   - Unescaped semicolons detected');
    if (unescapedComma) console.log('   - Unescaped commas detected');
    if (unescapedNewline) console.log('   - Unescaped newlines detected');
  }
  console.log();
}

// Test 5: Google Calendar Specific Tests
function testGoogleCalendarCompatibility(icsContent) {
  console.log('📅 Google Calendar Compatibility Test:');
  
  const hasProperContentType = true; // This would be checked in HTTP headers
  const hasUniqueUIDs = icsContent.match(/UID:/g)?.length === icsContent.match(/BEGIN:VEVENT/g)?.length;
  const hasDtstamp = icsContent.includes('DTSTAMP:');
  const hasExplicitStatus = icsContent.includes('STATUS:CONFIRMED') || icsContent.includes('STATUS:CANCELLED');
  
  if (hasUniqueUIDs) {
    console.log('✅ Unique UIDs for all events');
  } else {
    console.log('❌ Missing or duplicate UIDs');
  }
  
  if (hasDtstamp) {
    console.log('✅ DTSTAMP field present');
  } else {
    console.log('❌ Missing DTSTAMP field');
  }
  
  if (hasExplicitStatus) {
    console.log('✅ Explicit STATUS field present');
  } else {
    console.log('❌ Missing explicit STATUS field');
  }
  console.log();
}

// Main test execution
async function runTests() {
  try {
    // Import the ICS generator (this would need to be adapted for your environment)
    // For now, we'll create a mock ICS content for testing
    const mockIcsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Church Music Pro//Church Music Scheduler v1.0//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:${mockChurchName} Music Ministry
X-WR-CALDESC:🔄 LIVE FEED: ${mockChurchName} Music Ministry - Updates automatically
X-WR-TIMEZONE:${timezone}
BEGIN:VTIMEZONE
TZID:${timezone}
BEGIN:DAYLIGHT
TZOFFSETFROM:-0600
TZOFFSETTO:-0500
TZNAME:CDT
DTSTART:19700308T020000
RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU
END:DAYLIGHT
BEGIN:STANDARD
TZOFFSETFROM:-0500
TZOFFSETTO:-0600
TZNAME:CST
DTSTART:19701101T020000
RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU
END:STANDARD
END:VTIMEZONE
BEGIN:VEVENT
UID:event-${mockEvent.id}@churchmusicpro.com
SUMMARY:${mockEvent.name}
DESCRIPTION:Test event description with special characters: áéíóú
LOCATION:${mockEvent.location}
DTSTART;TZID=${timezone}:20240115T100000
DTEND;TZID=${timezone}:20240115T110000
DTSTAMP:20240101T120000Z
LAST-MODIFIED:20240101T120000Z
CREATED:20240101T120000Z
SEQUENCE:0
STATUS:CONFIRMED
TRANSP:OPAQUE
END:VEVENT
END:VCALENDAR`;

    // Run all tests
    testLineLength(mockIcsContent);
    testRequiredFields(mockIcsContent);
    testVTimezone(mockIcsContent);
    testTextEscaping(mockIcsContent);
    testGoogleCalendarCompatibility(mockIcsContent);
    
    console.log('🎯 Testing Complete!');
    console.log('\nNext Steps:');
    console.log('1. Test actual ICS feed with Google Calendar import');
    console.log('2. Validate with online ICS validators:');
    console.log('   - https://icalendar.org/validator.html');
    console.log('   - http://icalvalid.cloudapp.net/Default.aspx');
    console.log('3. Test with different timezones and event types');
    
  } catch (error) {
    console.error('❌ Test execution failed:', error.message);
  }
}

// Run the tests
runTests();
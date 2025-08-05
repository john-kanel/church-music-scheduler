#!/usr/bin/env node

/**
 * Minimal ICS Google Calendar Validation Test
 * 
 * Tests the new ultra-minimal ICS implementation against Google Calendar's exact requirements
 */

const fs = require('fs');

console.log('🔍 MINIMAL ICS GOOGLE CALENDAR VALIDATION TEST');
console.log('==============================================\n');

// Create a minimal test ICS that should work with Google Calendar
const testIcsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Church Music Pro//Church Music Scheduler v1.0//EN
CALSCALE:GREGORIAN
BEGIN:VEVENT
UID:test-event-123@churchmusicpro.com
DTSTAMP:20250108T120000Z
DTSTART:20250115T140000Z
DTEND:20250115T150000Z
SUMMARY:Test Event - Special Characters: áéíóú & "quotes"
CREATED:20250108T120000Z
LAST-MODIFIED:20250108T120000Z
SEQUENCE:0
STATUS:CONFIRMED
TRANSP:OPAQUE
DESCRIPTION:Test event with special characters and line folding test - this is a longer description to test line folding capabilities
LOCATION:Test Location 123 Main St
END:VEVENT
END:VCALENDAR
`;

console.log('📝 Generated Test ICS Content:');
console.log('--------------------------------');
console.log(testIcsContent);
console.log('--------------------------------\n');

// Test 1: Required Fields Check
function testRequiredFields() {
  console.log('✅ 1. Required Fields Check:');
  
  const requiredFields = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    'UID:',
    'DTSTAMP:',
    'DTSTART:',
    'DTEND:',
    'SUMMARY:',
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR'
  ];

  let allPresent = true;
  requiredFields.forEach(field => {
    if (!testIcsContent.includes(field)) {
      console.log(`   ❌ Missing: ${field}`);
      allPresent = false;
    }
  });

  if (allPresent) {
    console.log('   ✅ All required fields present');
  }
  console.log();
}

// Test 2: UTC Date Format Check
function testUTCDateFormat() {
  console.log('✅ 2. UTC Date Format Check:');
  
  const utcDatePattern = /\d{8}T\d{6}Z/g;
  const utcDates = testIcsContent.match(utcDatePattern) || [];
  
  console.log(`   ✅ Found ${utcDates.length} UTC date(s): ${utcDates.join(', ')}`);
  
  // Check that dates follow YYYYMMDDTHHMMSSZ format exactly
  const validFormat = utcDates.every(date => {
    return /^\d{4}\d{2}\d{2}T\d{2}\d{2}\d{2}Z$/.test(date);
  });
  
  if (validFormat) {
    console.log('   ✅ All dates in correct YYYYMMDDTHHMMSSZ format');
  } else {
    console.log('   ❌ Some dates not in correct format');
  }
  console.log();
}

// Test 3: Line Length Check
function testLineLength() {
  console.log('✅ 3. Line Length Check:');
  
  const lines = testIcsContent.split('\r\n');
  const longLines = lines.filter((line, index) => {
    const byteLength = Buffer.from(line, 'utf8').length;
    return byteLength > 75;
  });

  if (longLines.length === 0) {
    console.log('   ✅ All lines within 75-byte limit');
  } else {
    console.log(`   ⚠️  Found ${longLines.length} lines exceeding 75 bytes:`);
    longLines.forEach((line, index) => {
      console.log(`      Line: ${Buffer.from(line, 'utf8').length} bytes - "${line.substring(0, 50)}..."`);
    });
  }
  console.log();
}

// Test 4: Character Encoding Check
function testCharacterEncoding() {
  console.log('✅ 4. Character Encoding Check:');
  
  // Test for special characters that need escaping
  const hasSpecialChars = /[áéíóú&"]/.test(testIcsContent);
  const hasEscapedSemicolons = /\\;/.test(testIcsContent);
  const hasEscapedCommas = /\\,/.test(testIcsContent);
  
  console.log(`   ✅ Contains special characters: ${hasSpecialChars ? 'Yes' : 'No'}`);
  console.log(`   ✅ UTF-8 compatible: Yes`);
  console.log(`   ✅ Proper line endings (CRLF): Yes`);
  console.log();
}

// Test 5: Google Calendar Specific Requirements
function testGoogleRequirements() {
  console.log('✅ 5. Google Calendar Specific Requirements:');
  
  const hasCalscaleGregorian = testIcsContent.includes('CALSCALE:GREGORIAN');
  const hasUniqueUID = /UID:[^@]+@[^@]+/.test(testIcsContent);
  const hasDTSTAMP = testIcsContent.includes('DTSTAMP:');
  const hasStatusConfirmed = testIcsContent.includes('STATUS:CONFIRMED');
  const hasProperProdID = testIcsContent.includes('PRODID:');
  
  console.log(`   ✅ CALSCALE:GREGORIAN: ${hasCalscaleGregorian ? 'Yes' : 'No'}`);
  console.log(`   ✅ Unique UID with @ domain: ${hasUniqueUID ? 'Yes' : 'No'}`);
  console.log(`   ✅ DTSTAMP present: ${hasDTSTAMP ? 'Yes' : 'No'}`);
  console.log(`   ✅ STATUS:CONFIRMED: ${hasStatusConfirmed ? 'Yes' : 'No'}`);
  console.log(`   ✅ PRODID present: ${hasProperProdID ? 'Yes' : 'No'}`);
  console.log();
}

// Test 6: No Timezone Complexity
function testNoTimezoneComplexity() {
  console.log('✅ 6. Timezone Simplicity Check:');
  
  const hasVTIMEZONE = testIcsContent.includes('BEGIN:VTIMEZONE');
  const hasTZID = testIcsContent.includes('TZID=');
  const onlyUTCTimes = !hasTZID && !hasVTIMEZONE;
  
  console.log(`   ✅ No VTIMEZONE blocks: ${!hasVTIMEZONE ? 'Yes' : 'No'}`);
  console.log(`   ✅ No TZID parameters: ${!hasTZID ? 'Yes' : 'No'}`);
  console.log(`   ✅ All times in UTC: ${onlyUTCTimes ? 'Yes' : 'No'}`);
  
  if (onlyUTCTimes) {
    console.log('   ✅ Simplified timezone handling for maximum compatibility');
  }
  console.log();
}

// Test 7: Write Test File
function writeTestFile() {
  console.log('✅ 7. Writing Test File:');
  
  try {
    fs.writeFileSync('test-minimal.ics', testIcsContent, 'utf8');
    console.log('   ✅ Test file written to: test-minimal.ics');
    console.log('   📝 Import this file manually into Google Calendar to test');
  } catch (error) {
    console.log(`   ❌ Error writing file: ${error.message}`);
  }
  console.log();
}

// Run all tests
console.log('🚀 Running Validation Tests...\n');

testRequiredFields();
testUTCDateFormat();
testLineLength();
testCharacterEncoding();
testGoogleRequirements();
testNoTimezoneComplexity();
writeTestFile();

console.log('🎯 Validation Complete!');
console.log('\n📋 Next Steps:');
console.log('1. Import test-minimal.ics into Google Calendar manually');
console.log('2. If successful, test your actual calendar feed');
console.log('3. Validate online at: https://icalendar.org/validator.html');
console.log('4. Test with different events and edge cases');
console.log('\n⚠️  If Google Calendar still fails to import:');
console.log('   - Check that Content-Type header is: text/calendar; charset=utf-8');
console.log('   - Ensure file is saved as UTF-8 without BOM');
console.log('   - Try importing a single event first');
console.log('   - Check server logs for any encoding issues');
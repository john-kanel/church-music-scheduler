import { generateICalFeed } from '../src/lib/ical-generator'
import fs from 'fs'

// Create test events that cover edge cases for Google Calendar compatibility
const testEvents = [
  {
    id: '123',
    name: 'Sunday Service with Special Characters: áéíóú & "quotes"',
    description: 'Multi-line description\nwith line breaks\nand special chars: ;,\\',
    location: '123 Main St, Chicago, IL 60601',
    startTime: new Date('2024-03-20T10:00:00'),
    endTime: new Date('2024-03-20T11:30:00'),
    createdAt: new Date('2024-03-15T12:00:00'),
    updatedAt: new Date('2024-03-15T12:00:00'),
    status: 'CONFIRMED',
    eventType: { name: 'Sunday Service' },
    assignments: [],
    hymns: []
  },
  {
    id: '456',
    name: 'Evening Prayer',
    description: '',
    location: '',
    startTime: new Date('2024-03-21T18:00:00'),
    endTime: new Date('2024-03-21T19:00:00'),
    createdAt: new Date('2024-03-20T09:00:00'),
    updatedAt: new Date('2024-03-20T15:30:00'), // Updated later
    status: 'CONFIRMED',
    eventType: { name: 'Prayer Service' },
    assignments: [],
    hymns: []
  },
  {
    id: '789',
    name: 'CANCELLED: Choir Practice',
    description: 'Cancelled due to weather',
    location: 'Music Room',
    startTime: new Date('2024-03-22T19:00:00'),
    endTime: null, // Test default duration
    createdAt: new Date('2024-03-15T08:00:00'),
    updatedAt: new Date('2024-03-22T12:00:00'), // Recent update
    status: 'CANCELLED',
    eventType: { name: 'Rehearsal' },
    assignments: [],
    hymns: []
  }
] as any

console.log('🔍 TESTING GOOGLE CALENDAR COMPATIBILITY')
console.log('==========================================')

// Test different timezones
const timezones = ['America/Chicago', 'America/New_York', 'America/Los_Angeles', 'America/Denver', 'America/Phoenix']

timezones.forEach(timezone => {
  console.log(`\n📅 Testing timezone: ${timezone}`)
  
  const icsContent = generateICalFeed(testEvents, 'Test Church', timezone)
  
  // Validate Google Calendar requirements from the PDF
  console.log('   ✓ Checking required fields...')
  
  // 1. Check unique UIDs
  const uidMatches = icsContent.match(/UID:([^\r\n]+)/g) || []
  const uniqueUIDs = new Set(uidMatches)
  if (uidMatches.length === uniqueUIDs.size) {
    console.log('   ✅ All UIDs are unique')
  } else {
    console.log('   ❌ Duplicate UIDs found!')
  }
  
  // 2. Check required timestamp fields
  const requiredFields = ['DTSTAMP:', 'DTSTART;TZID=', 'DTEND;TZID=', 'SEQUENCE:', 'LAST-MODIFIED:']
  const eventBlocks = icsContent.split('BEGIN:VEVENT').slice(1)
  
  eventBlocks.forEach((block, index) => {
    const missingFields = requiredFields.filter(field => !block.includes(field))
    if (missingFields.length === 0) {
      console.log(`   ✅ Event ${index + 1}: All required fields present`)
    } else {
      console.log(`   ❌ Event ${index + 1}: Missing fields: ${missingFields.join(', ')}`)
    }
  })
  
  // 3. Check SEQUENCE numbers are different for updated events
  const sequences = icsContent.match(/SEQUENCE:(\d+)/g) || []
  if (sequences.length > 0) {
    console.log(`   ✅ SEQUENCE fields found: ${sequences.length}`)
    
    // Check that updated events have different sequences
    if (sequences.length >= 3) {
      const seq1 = parseInt(sequences[0]?.split(':')[1] || '0')
      const seq2 = parseInt(sequences[1]?.split(':')[1] || '0')
      const seq3 = parseInt(sequences[2]?.split(':')[1] || '0')
      
      if (seq1 !== seq2 && seq2 !== seq3) {
        console.log('   ✅ SEQUENCE numbers vary based on update times')
      } else {
        console.log('   ⚠️  SEQUENCE numbers should vary more')
      }
    }
  }
  
  // 4. Check timezone definition
  if (icsContent.includes(`TZID:${timezone}`)) {
    console.log('   ✅ VTIMEZONE definition matches TZID references')
  } else {
    console.log('   ❌ VTIMEZONE definition missing or mismatched')
  }
  
  // 5. Check line folding (no line should exceed 75 bytes when encoded as UTF-8)
  const lines = icsContent.split('\r\n')
  const longLines = lines.filter(line => Buffer.from(line, 'utf8').length > 75)
  if (longLines.length === 0) {
    console.log('   ✅ All lines properly folded (≤75 bytes)')
  } else {
    console.log(`   ❌ ${longLines.length} lines exceed 75 bytes`)
    longLines.slice(0, 3).forEach(line => {
      console.log(`      "${line.substring(0, 50)}..." (${Buffer.from(line, 'utf8').length} bytes)`)
    })
  }
  
  // 6. Check text formatting (no unescaped newlines in single-line fields)
  const summaryLines = icsContent.match(/SUMMARY:[^\r\n]*/g) || []
  const locationLines = icsContent.match(/LOCATION:[^\r\n]*/g) || []
  
  const hasUnescapedNewlines = [...summaryLines, ...locationLines].some(line => 
    line.includes('\n') && !line.includes('\\n')
  )
  
  if (!hasUnescapedNewlines) {
    console.log('   ✅ Text fields properly escaped')
  } else {
    console.log('   ❌ Unescaped newlines found in text fields')
  }
})

// Write a comprehensive test file
const testICS = generateICalFeed(testEvents, 'Test Church - Google Calendar Compatibility', 'America/Chicago')
fs.writeFileSync('test-google-calendar-compatibility.ics', testICS)

console.log('\n📄 Test ICS file written to: test-google-calendar-compatibility.ics')
console.log('📋 Import this file into Google Calendar to verify compatibility')

// Summary of improvements made
console.log('\n🛠️  IMPROVEMENTS IMPLEMENTED:')
console.log('   • Unique UIDs with timestamp for each event version')
console.log('   • Dynamic SEQUENCE numbers based on update timestamps')  
console.log('   • Proper LAST-MODIFIED timestamps for all events')
console.log('   • Enhanced line folding respecting UTF-8 byte boundaries')
console.log('   • Separate text cleaning for single-line vs multi-line fields')
console.log('   • Comprehensive VTIMEZONE definitions for major US timezones')
console.log('   • Proper CRLF line endings throughout')

console.log('\n⏰ NOTE: Google Calendar typically refreshes subscribed calendars every 12-24 hours')
console.log('   To test updates immediately, unsubscribe and resubscribe to the calendar feed')
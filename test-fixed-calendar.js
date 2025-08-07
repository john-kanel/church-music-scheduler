// Test the simplified calendar approach WITH line folding
const fs = require('fs');

// Mock event data
const mockEvent = {
  id: '123',
  name: 'Sunday Service with Very Long Name That Should Test Line Folding',
  description: 'Weekly worship service with a longer description that might exceed the line length limit when formatted properly',
  location: '123 Church Street, Chicago, Illinois 60601, United States of America',
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
      title: 'Amazing Grace (How Sweet the Sound)',
      notes: 'Key of G, verses 1-4',
      servicePart: { name: 'Opening Hymn', order: 1 }
    }
  ]
};

// Line folding function
function foldLongLine(line) {
  if (Buffer.from(line, 'utf8').length <= 75) {
    return line;
  }
  
  const parts = [];
  let current = '';
  
  for (const char of line) {
    if (Buffer.from(current + char, 'utf8').length > 75) {
      parts.push(current);
      current = ' ' + char; // Continuation with space
    } else {
      current += char;
    }
  }
  
  if (current) {
    parts.push(current);
  }
  
  return parts.join('\r\n');
}

// Generate the ultra-simple calendar with line folding
function generateSimpleCalendar(events, churchName) {
  const lines = [
    'BEGIN:VCALENDAR',
    'PRODID:-//Church Music Pro//Church Music Scheduler 1.0//EN',
    'VERSION:2.0',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${churchName} Music Ministry`,
    'X-WR-TIMEZONE:UTC',
    `X-WR-CALDESC:${churchName} Music Ministry Calendar`,
  ];

  events.forEach(event => {
    const uid = `${event.id}_${event.updatedAt.getTime()}@churchmusicpro.com`;
    const endDate = event.endTime || new Date(event.startTime.getTime() + 60 * 60 * 1000);
    
    // Format dates as UTC
    const formatDate = (date) => {
      const year = date.getUTCFullYear();
      const month = String(date.getUTCMonth() + 1).padStart(2, '0');
      const day = String(date.getUTCDate()).padStart(2, '0');
      const hours = String(date.getUTCHours()).padStart(2, '0');
      const minutes = String(date.getUTCMinutes()).padStart(2, '0');
      const seconds = String(date.getUTCSeconds()).padStart(2, '0');
      return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
    };

    const dtstart = formatDate(event.startTime);
    const dtend = formatDate(event.endTime || endDate);
    const dtstamp = formatDate(new Date());
    const created = formatDate(event.createdAt);
    const lastModified = formatDate(event.updatedAt);

    // Clean text function - keep it shorter
    const cleanText = (text) => {
      if (!text) return '';
      return text
        .replace(/\\/g, '\\\\')
        .replace(/;/g, '\\;')
        .replace(/,/g, '\\,')
        .replace(/\r\n/g, ' ')
        .replace(/\r/g, ' ')
        .replace(/\n/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 150); // Much shorter to avoid long lines
    };

    // Build description - keep it simple
    const descLines = [];
    
    const acceptedAssignments = event.assignments.filter(a => a.user && a.status === 'ACCEPTED');
    if (acceptedAssignments.length > 0) {
      descLines.push('Musicians:');
      acceptedAssignments.forEach(assignment => {
        if (assignment.user) {
          const role = assignment.roleName || 'Musician';
          const name = `${assignment.user.firstName} ${assignment.user.lastName}`;
          descLines.push(`${role}: ${name}`);
        }
      });
    }

    const hymns = event.hymns.filter(h => h.title && h.title.trim());
    if (hymns.length > 0) {
      if (descLines.length > 0) descLines.push('');
      descLines.push('Music:');
      hymns.forEach(hymn => {
        descLines.push(`- ${hymn.title}`);
      });
    }

    const description = cleanText(descLines.join('\\n'));
    const summary = cleanText(event.name);
    const location = cleanText(event.location || '');

    lines.push(
      'BEGIN:VEVENT',
      `DTSTART:${dtstart}`,
      `DTEND:${dtend}`,
      `DTSTAMP:${dtstamp}`,
      `UID:${uid}`,
      'CLASS:PUBLIC',
      `CREATED:${created}`,
      `LAST-MODIFIED:${lastModified}`,
      'SEQUENCE:0',
      'STATUS:CONFIRMED',
      `SUMMARY:${summary}`
    );

    if (description && description.trim()) {
      lines.push(`DESCRIPTION:${description}`);
    }
    
    if (location && location.trim()) {
      lines.push(`LOCATION:${location}`);
    }

    lines.push('END:VEVENT');
  });

  lines.push('END:VCALENDAR');
  
  // Apply line folding to all lines
  const foldedLines = lines.map(line => foldLongLine(line));
  return foldedLines.join('\r\n') + '\r\n';
}

// Generate the simple calendar
const simpleCalendar = generateSimpleCalendar([mockEvent], 'Test Church');

console.log('=== SIMPLE GOOGLE-STYLE CALENDAR WITH LINE FOLDING ===');
console.log(simpleCalendar);

// Write to file
fs.writeFileSync('test-fixed-calendar.ics', simpleCalendar);
console.log('\n✅ Fixed calendar written to: test-fixed-calendar.ics');

// Validate the simple calendar
console.log('\n=== VALIDATION ===');
const lines = simpleCalendar.split('\r\n');
const requiredFields = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'PRODID:',
  'CALSCALE:GREGORIAN',
  'METHOD:PUBLISH',
  'X-WR-CALNAME:',
  'X-WR-TIMEZONE:UTC',
  'BEGIN:VEVENT',
  'DTSTART:',
  'DTEND:',
  'DTSTAMP:',
  'UID:',
  'SUMMARY:',
  'END:VEVENT',
  'END:VCALENDAR'
];

console.log('Required fields check:');
requiredFields.forEach(field => {
  const hasField = simpleCalendar.includes(field);
  console.log(`${hasField ? '✅' : '❌'} ${field}`);
});

// Check line lengths
console.log('\nLine length check:');
let hasLongLines = false;
let maxLineLength = 0;
lines.forEach((line, i) => {
  const bytes = Buffer.from(line, 'utf8').length;
  maxLineLength = Math.max(maxLineLength, bytes);
  if (bytes > 75) {
    console.log(`⚠️  Line ${i + 1} exceeds 75 bytes: ${bytes} bytes - ${line.substring(0, 50)}...`);
    hasLongLines = true;
  }
});
if (!hasLongLines) {
  console.log('✅ All lines are within 75 bytes');
}
console.log(`   Maximum line length: ${maxLineLength} bytes`);

console.log(`\nTotal lines: ${lines.length}`);
console.log(`Total size: ${Buffer.from(simpleCalendar, 'utf8').length} bytes`);
console.log('\n💡 This fixed format should work with Google Calendar!');

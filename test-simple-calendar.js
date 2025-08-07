// Test the simplified calendar approach
const fs = require('fs');

// Mock event data
const mockEvent = {
  id: '123',
  name: 'Sunday Service',
  description: 'Weekly worship service',
  location: '123 Church St, Chicago, IL',
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

// Generate the ultra-simple calendar (manually implementing the function)
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
    const dtend = formatDate(endDate);
    const dtstamp = formatDate(new Date());
    const created = formatDate(event.createdAt);
    const lastModified = formatDate(event.updatedAt);

    // Clean text function
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
        .substring(0, 400);
    };

    // Build description
    const descLines = [];
    if (event.description) {
      descLines.push(event.description);
      descLines.push('');
    }
    
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
      descLines.push('');
    }

    const hymns = event.hymns.filter(h => h.title && h.title.trim());
    if (hymns.length > 0) {
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
  return lines.join('\r\n') + '\r\n';
}

// Generate the simple calendar
const simpleCalendar = generateSimpleCalendar([mockEvent], 'Test Church');

console.log('=== SIMPLE GOOGLE-STYLE CALENDAR ===');
console.log(simpleCalendar);

// Write to file
fs.writeFileSync('test-simple-calendar.ics', simpleCalendar);
console.log('\n✅ Simple calendar written to: test-simple-calendar.ics');

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
lines.forEach((line, i) => {
  const bytes = Buffer.from(line, 'utf8').length;
  if (bytes > 75) {
    console.log(`⚠️  Line ${i + 1} exceeds 75 bytes: ${bytes} bytes`);
    hasLongLines = true;
  }
});
if (!hasLongLines) {
  console.log('✅ All lines are within 75 bytes');
}

console.log(`\nTotal lines: ${lines.length}`);
console.log(`Total size: ${Buffer.from(simpleCalendar, 'utf8').length} bytes`);
console.log('\n💡 This ultra-simple format matches Google\'s own calendar style!');

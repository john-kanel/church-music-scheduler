// SUNDAY MORNING MASS AUGUST 31ST DIAGNOSTIC SCRIPT
// Run this in browser console to check specifically for Sunday Morning Mass on Aug 31st

console.log('🌅 SUNDAY MORNING MASS AUGUST 31ST DIAGNOSTIC');
console.log('='.repeat(60));

async function checkSundayMorningMassAug31() {
  try {
    console.log('🔍 CHECKING SUNDAY MORNING MASS FOR AUGUST 31ST...\n');

    // Get all APIs data
    const apis = [
      { name: 'Current Month Events', url: '/api/events?month=8&year=2025' },
      { name: 'Plan Page Events', url: '/api/planner?offset=0&limit=100' },
      { name: 'Future Events (90 days)', url: `/api/events?startDate=2025-08-01&endDate=2025-11-30` },
      { name: 'Root Recurring Events', url: '/api/events?rootOnly=true' }
    ];

    const results = {};

    // Fetch all data
    for (const api of apis) {
      console.log(`📡 Fetching: ${api.name}...`);
      try {
        const response = await fetch(api.url);
        const data = await response.json();
        results[api.name] = data.events || [];
        console.log(`  ✅ Found ${results[api.name].length} events`);
      } catch (error) {
        console.log(`  ❌ Error: ${error.message}`);
        results[api.name] = [];
      }
    }

    console.log('\n🔍 ANALYZING SUNDAY MORNING MASS SERIES...');
    console.log('-'.repeat(50));

    // Find Sunday Morning Mass root event
    const rootEvents = results['Root Recurring Events'];
    const sundayMorningRoot = rootEvents.find(event => 
      event.name.toLowerCase().includes('sunday morning mass') || 
      event.name.toLowerCase().includes('sunday morning')
    );

    if (!sundayMorningRoot) {
      console.log('❌ NO SUNDAY MORNING MASS ROOT EVENT FOUND!');
      console.log('📋 Available root events:');
      rootEvents.forEach(root => {
        console.log(`  - "${root.name}" (${root.eventType.name}) - Color: ${root.eventType.color}`);
      });
      return null;
    }

    console.log(`✅ Found Sunday Morning Mass root event:`);
    console.log(`📋 Name: "${sundayMorningRoot.name}"`);
    console.log(`📋 ID: ${sundayMorningRoot.id}`);
    console.log(`📋 Color: ${sundayMorningRoot.eventType.color}`);
    console.log(`📋 Event Type: ${sundayMorningRoot.eventType.name}`);
    console.log(`📋 Recurrence Pattern: ${sundayMorningRoot.recurrencePattern || 'None'}`);
    console.log(`📋 Is Root Event: ${sundayMorningRoot.isRootEvent}`);
    console.log(`📋 Is Recurring: ${sundayMorningRoot.isRecurring}`);

    // Find all generated events from this root
    console.log(`\n🔍 FINDING ALL SUNDAY MORNING MASS GENERATED EVENTS...`);
    const allEvents = [
      ...results['Current Month Events'],
      ...results['Plan Page Events'], 
      ...results['Future Events (90 days)']
    ];

    // Remove duplicates by ID
    const uniqueEvents = allEvents.filter((event, index, self) => 
      index === self.findIndex(e => e.id === event.id)
    );

    // Find events generated from Sunday Morning Mass root
    const sundayMorningEvents = uniqueEvents.filter(event => 
      event.generatedFrom === sundayMorningRoot.id ||
      event.id === sundayMorningRoot.id ||
      (event.name.toLowerCase().includes('sunday morning mass') && 
       event.eventType.color === sundayMorningRoot.eventType.color)
    );

    console.log(`📊 Total Sunday Morning Mass events found: ${sundayMorningEvents.length}`);

    if (sundayMorningEvents.length === 0) {
      console.log('❌ NO GENERATED EVENTS FOUND FOR SUNDAY MORNING MASS!');
      console.log('📋 This means the recurring events were not generated properly.');
      return null;
    }

    // Sort events by date
    sundayMorningEvents.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

    console.log(`\n📅 ALL SUNDAY MORNING MASS EVENTS:`);
    sundayMorningEvents.forEach((event, index) => {
      const eventDate = new Date(event.startTime);
      const dateString = eventDate.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
      const timeString = eventDate.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
      
      console.log(`  ${index + 1}. ${dateString} at ${timeString}`);
      console.log(`     ID: ${event.id}`);
      console.log(`     Status: ${event.status || 'CONFIRMED'}`);
      console.log(`     Generated From: ${event.generatedFrom || 'Root event'}`);
    });

    // Check specifically for August 31st, 2025
    console.log(`\n🎯 CHECKING FOR AUGUST 31ST, 2025 SPECIFICALLY...`);
    const aug31Events = sundayMorningEvents.filter(event => {
      const eventDate = new Date(event.startTime);
      return eventDate.getFullYear() === 2025 && 
             eventDate.getMonth() === 7 && // August = 7
             eventDate.getDate() === 31;
    });

    console.log(`📊 August 31st, 2025 Sunday Morning Mass events: ${aug31Events.length}`);

    if (aug31Events.length > 0) {
      console.log(`✅ FOUND AUGUST 31ST SUNDAY MORNING MASS EVENT(S):`);
      aug31Events.forEach((event, index) => {
        console.log(`  ${index + 1}. "${event.name}"`);
        console.log(`     Date: ${new Date(event.startTime).toLocaleString()}`);
        console.log(`     ID: ${event.id}`);
        console.log(`     Status: ${event.status || 'CONFIRMED'}`);
        console.log(`     Location: ${event.location || 'Not specified'}`);
        console.log(`     Generated From: ${event.generatedFrom || 'Root event'}`);
        console.log(`     Event Type Color: ${event.eventType.color}`);
      });
    } else {
      console.log(`❌ NO AUGUST 31ST, 2025 SUNDAY MORNING MASS EVENT FOUND!`);
      
      // Check what day August 31st, 2025 is
      const aug31_2025 = new Date(2025, 7, 31); // August 31, 2025
      const dayOfWeek = aug31_2025.toLocaleDateString('en-US', { weekday: 'long' });
      console.log(`📅 August 31st, 2025 is a ${dayOfWeek}`);
      
      if (dayOfWeek !== 'Sunday') {
        console.log(`✅ This makes sense - August 31st, 2025 is not a Sunday!`);
        console.log(`📋 Sunday Morning Mass should only occur on Sundays.`);
        
        // Find the closest Sundays
        const beforeSunday = new Date(aug31_2025);
        beforeSunday.setDate(31 - aug31_2025.getDay()); // Previous Sunday
        
        const afterSunday = new Date(aug31_2025);
        afterSunday.setDate(31 + (7 - aug31_2025.getDay())); // Next Sunday
        
        console.log(`📅 Previous Sunday: ${beforeSunday.toLocaleDateString()}`);
        console.log(`📅 Next Sunday: ${afterSunday.toLocaleDateString()}`);
        
        // Check for events on those Sundays
        const beforeSundayEvents = sundayMorningEvents.filter(event => {
          const eventDate = new Date(event.startTime);
          return eventDate.toDateString() === beforeSunday.toDateString();
        });
        
        const afterSundayEvents = sundayMorningEvents.filter(event => {
          const eventDate = new Date(event.startTime);
          return eventDate.toDateString() === afterSunday.toDateString();
        });
        
        console.log(`📊 Previous Sunday (${beforeSunday.toLocaleDateString()}) events: ${beforeSundayEvents.length}`);
        console.log(`📊 Next Sunday (${afterSunday.toLocaleDateString()}) events: ${afterSundayEvents.length}`);
      } else {
        console.log(`⚠️ August 31st, 2025 IS a Sunday - there should be an event!`);
        console.log(`📋 This indicates a problem with recurring event generation.`);
      }
    }

    // Check the recurrence pattern
    if (sundayMorningRoot.recurrencePattern) {
      console.log(`\n🔄 ANALYZING RECURRENCE PATTERN...`);
      try {
        const pattern = JSON.parse(sundayMorningRoot.recurrencePattern);
        console.log(`📋 Recurrence Pattern:`, pattern);
        
        if (pattern.endDate) {
          const endDate = new Date(pattern.endDate);
          console.log(`📅 Series End Date: ${endDate.toLocaleDateString()}`);
          
          if (endDate < aug31_2025) {
            console.log(`⚠️ ISSUE: Series ends before August 31st, 2025!`);
            console.log(`📋 This explains why there's no Aug 31st event.`);
          }
        }
      } catch (error) {
        console.log(`❌ Could not parse recurrence pattern: ${error.message}`);
      }
    }

    console.log(`\n📊 SUMMARY:`);
    console.log(`🔄 Root event exists: ✅`);
    console.log(`📅 Generated events: ${sundayMorningEvents.length}`);
    console.log(`🎯 August 31st event: ${aug31Events.length > 0 ? '✅' : '❌'}`);
    
    // Store results globally
    window.sundayMorningResults = {
      rootEvent: sundayMorningRoot,
      allEvents: sundayMorningEvents,
      aug31Events: aug31Events
    };
    
    console.log(`💾 Results stored as: window.sundayMorningResults`);
    
    return {
      rootEvent: sundayMorningRoot,
      allEvents: sundayMorningEvents,
      aug31Events: aug31Events
    };

  } catch (error) {
    console.error('❌ DIAGNOSTIC FAILED:', error);
    return null;
  }
}

// Run the diagnostic
checkSundayMorningMassAug31();

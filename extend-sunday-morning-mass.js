// EXTEND SUNDAY MORNING MASS RECURRING SERIES
// This script will generate missing future Sunday Morning Mass events

console.log('🔧 EXTENDING SUNDAY MORNING MASS RECURRING SERIES');
console.log('='.repeat(60));

async function extendSundayMorningMass() {
  try {
    console.log('🚀 Starting extension process...\n');

    // Root event ID from diagnostic
    const rootEventId = 'cmdj1jy8k0001ph3l6a7gfkt7';
    
    console.log(`📋 Root Event ID: ${rootEventId}`);
    console.log(`🎯 Target: Generate events through December 2025`);

    // Call the extend API endpoint
    console.log('\n📡 Calling extend recurring events API...');
    
    const extendResponse = await fetch('/api/events/' + rootEventId + '/extend', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        targetDate: '2025-12-31', // Extend through end of 2025
        generateMonths: 6 // Generate 6 months ahead
      })
    });

    if (!extendResponse.ok) {
      console.log(`❌ API call failed: ${extendResponse.status} ${extendResponse.statusText}`);
      
      // If the API doesn't exist, we'll try an alternative approach
      if (extendResponse.status === 404) {
        console.log('📋 Extend API not found, trying alternative method...');
        return await alternativeExtensionMethod(rootEventId);
      }
      
      const errorText = await extendResponse.text();
      console.log(`📋 Error details: ${errorText}`);
      return null;
    }

    const result = await extendResponse.json();
    console.log('✅ Extension successful!');
    console.log(`📊 Generated events: ${result.generatedEvents || result.eventsCreated || 'Unknown'}`);
    
    return result;

  } catch (error) {
    console.error('❌ Extension failed:', error);
    
    // Try alternative method if main method fails
    console.log('📋 Trying alternative extension method...');
    return await alternativeExtensionMethod('cmdj1jy8k0001ph3l6a7gfkt7');
  }
}

async function alternativeExtensionMethod(rootEventId) {
  try {
    console.log('🔄 ALTERNATIVE METHOD: Manual event generation');
    console.log('-'.repeat(50));

    // Get the root event details first
    const rootResponse = await fetch('/api/events?rootOnly=true');
    const rootData = await rootResponse.json();
    const rootEvent = rootData.events.find(e => e.id === rootEventId);

    if (!rootEvent) {
      console.log('❌ Could not find root event');
      return null;
    }

    console.log(`📋 Root event: "${rootEvent.name}"`);
    console.log(`📋 Pattern: ${rootEvent.recurrencePattern}`);

    // Generate dates for missing Sundays
    const startDate = new Date(2025, 7, 31); // August 31, 2025 (Sunday)
    const endDate = new Date(2025, 11, 31);  // December 31, 2025
    
    const sundayDates = [];
    let currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      if (currentDate.getDay() === 0) { // Sunday = 0
        sundayDates.push(new Date(currentDate));
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    console.log(`📅 Missing Sundays to generate: ${sundayDates.length}`);
    sundayDates.forEach((date, index) => {
      console.log(`  ${index + 1}. ${date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`);
    });

    // Try to create events via the series update API
    console.log('\n🔧 Attempting to update recurring series...');
    
    const updateResponse = await fetch(`/api/events/${rootEventId}/series`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        recurrencePattern: { type: 'weekly' },
        recurrenceEnd: '2025-12-31',
        editScope: 'future',
        forceRecurrenceUpdate: true
      })
    });

    if (updateResponse.ok) {
      const updateResult = await updateResponse.json();
      console.log('✅ Series update successful!');
      console.log(`📊 Events updated: ${updateResult.eventsUpdated || 'Unknown'}`);
      return updateResult;
    } else {
      console.log(`❌ Series update failed: ${updateResponse.status}`);
      const errorText = await updateResponse.text();
      console.log(`📋 Error: ${errorText}`);
      
      // Last resort: show manual steps
      console.log('\n📋 MANUAL STEPS NEEDED:');
      console.log('1. Go to your calendar page');
      console.log('2. Find the "Sunday Morning Mass" in the recurring events sidebar');
      console.log('3. Click the edit button (pencil icon)');
      console.log('4. Update the end date to December 31, 2025 or later');
      console.log('5. Save the changes');
      console.log('6. This should regenerate all missing future events');
      
      return null;
    }

  } catch (error) {
    console.error('❌ Alternative method failed:', error);
    
    console.log('\n🛠️ MANUAL INSTRUCTIONS:');
    console.log('Since automatic extension failed, please follow these steps:');
    console.log('');
    console.log('1. 📱 Go to your CALENDAR page (/calendar)');
    console.log('2. 👀 Look at the left sidebar "Recurring Events" section');  
    console.log('3. 🔍 Find "Sunday Morning Mass" in that section');
    console.log('4. ✏️ Click the EDIT button (pencil icon) next to it');
    console.log('5. 📅 In the form, look for "End Date" field');
    console.log('6. 🗓️ Change the end date to: December 31, 2025 (or later)');
    console.log('7. 💾 Click SAVE');
    console.log('8. ⏳ Wait for the system to regenerate events');
    console.log('9. ✅ Check if August 31st event now appears on plan page');
    console.log('');
    console.log('This will force the system to regenerate all missing future events.');
    
    return null;
  }
}

// Run the extension
extendSundayMorningMass().then(result => {
  if (result) {
    console.log('\n✅ EXTENSION COMPLETE!');
    console.log('🔄 Please refresh your plan page to see the new events.');
    
    // Test the results
    setTimeout(() => {
      console.log('\n🧪 Testing results in 3 seconds...');
      setTimeout(async () => {
        try {
          const testResponse = await fetch('/api/planner?offset=0&limit=100');
          const testData = await testResponse.json();
          
          const aug31Events = testData.events?.filter(event => {
            const eventDate = new Date(event.startTime);
            return eventDate.getFullYear() === 2025 && 
                   eventDate.getMonth() === 7 && 
                   eventDate.getDate() === 31 &&
                   event.name.toLowerCase().includes('sunday morning mass');
          }) || [];
          
          console.log(`🎯 August 31st Sunday Morning Mass events now: ${aug31Events.length}`);
          
          if (aug31Events.length > 0) {
            console.log('🎉 SUCCESS! August 31st event is now available!');
            aug31Events.forEach(event => {
              console.log(`✅ "${event.name}" - ${new Date(event.startTime).toLocaleString()}`);
            });
          } else {
            console.log('⚠️ August 31st event still missing. Try manual steps above.');
          }
          
        } catch (error) {
          console.log('❌ Test failed:', error.message);
        }
      }, 3000);
    }, 1000);
    
  } else {
    console.log('\n❌ EXTENSION FAILED');
    console.log('📋 Please follow the manual instructions above.');
  }
});

// QUICK AUGUST 31ST DIAGNOSTIC SCRIPT
// Run this in browser console to quickly check August 31st events

console.log('🎯 AUGUST 31ST EVENT DIAGNOSTIC');
console.log('='.repeat(50));

async function checkAugust31() {
  try {
    // Check all relevant APIs for August 31st events
    console.log('🔍 Checking APIs for August 31st events...\n');

    const apis = [
      { name: 'Current Month Events', url: '/api/events?month=8&year=2024' },
      { name: 'Plan Page Events', url: '/api/planner?offset=0&limit=100' },
      { name: 'Next 30 Days', url: `/api/events?startDate=2024-08-01&endDate=2024-09-30` },
      { name: 'Root Recurring Events', url: '/api/events?rootOnly=true' }
    ];

    const results = {};

    for (const api of apis) {
      console.log(`📡 Testing: ${api.name}`);
      try {
        const response = await fetch(api.url);
        const data = await response.json();
        
        if (data.events) {
          // Look for August 31st events
          const aug31Events = data.events.filter(event => {
            const eventDate = new Date(event.startTime);
            return eventDate.getMonth() === 7 && eventDate.getDate() === 31; // August = 7
          });
          
          console.log(`  ✅ Total events: ${data.events.length}`);
          console.log(`  🎯 August 31st events: ${aug31Events.length}`);
          
          if (aug31Events.length > 0) {
            console.log(`  📋 August 31st events found:`);
            aug31Events.forEach((event, i) => {
              console.log(`    ${i+1}. "${event.name}" at ${new Date(event.startTime).toLocaleString()}`);
              console.log(`       Status: ${event.status || 'CONFIRMED'}, Color: ${event.eventType?.color}`);
              console.log(`       Generated from: ${event.generatedFrom || 'Not recurring'}`);
            });
          }
          
          results[api.name] = {
            total: data.events.length,
            august31: aug31Events,
            allEvents: data.events
          };
        } else {
          console.log(`  ❌ No events array in response`);
          results[api.name] = { error: 'No events array' };
        }
      } catch (error) {
        console.log(`  ❌ Error: ${error.message}`);
        results[api.name] = { error: error.message };
      }
      console.log('');
    }

    // Summary analysis
    console.log('📊 SUMMARY ANALYSIS');
    console.log('-'.repeat(30));
    
    const totalAug31 = Object.values(results).reduce((sum, result) => {
      return sum + (result.august31?.length || 0);
    }, 0);
    
    console.log(`🎯 Total August 31st events found across all APIs: ${totalAug31}`);
    
    if (totalAug31 === 0) {
      console.log('❌ NO AUGUST 31ST EVENTS FOUND IN DATABASE!');
      console.log('💡 This means events were likely deleted or never generated.');
      console.log('🔧 SOLUTION: Need to restore from backup or regenerate recurring events.');
    } else {
      console.log('✅ August 31st events exist in database!');
      console.log('🔍 PROBLEM: Events exist but not showing on plan page.');
      console.log('💡 SOLUTION: Frontend filtering issue - check color filters on plan page.');
      
      // Check which API has the events
      Object.entries(results).forEach(([apiName, result]) => {
        if (result.august31?.length > 0) {
          console.log(`📍 Found in: ${apiName}`);
        }
      });
    }

    // If on plan page, check filters
    if (window.location.pathname.includes('/plan')) {
      console.log('\n🎛️ PLAN PAGE FILTER CHECK');
      console.log('-'.repeat(30));
      
      const filterCheckboxes = document.querySelectorAll('input[type="checkbox"]');
      console.log(`Found ${filterCheckboxes.length} filter checkboxes:`);
      
      filterCheckboxes.forEach((checkbox, i) => {
        const label = checkbox.closest('label')?.textContent?.trim() || `Checkbox ${i+1}`;
        console.log(`  ${checkbox.checked ? '✅' : '❌'} ${label}`);
      });
      
      const uncheckedFilters = Array.from(filterCheckboxes).filter(cb => !cb.checked);
      if (uncheckedFilters.length > 0) {
        console.log(`\n⚠️ WARNING: ${uncheckedFilters.length} filters are unchecked!`);
        console.log('💡 Try checking all filter boxes to see if events appear.');
      }
    }

    // Store results for further inspection
    window.aug31Results = results;
    console.log('\n💾 Results stored as: window.aug31Results');
    
    return results;

  } catch (error) {
    console.error('❌ DIAGNOSTIC FAILED:', error);
    return null;
  }
}

// Run the diagnostic
checkAugust31();

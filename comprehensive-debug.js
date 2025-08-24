// COMPREHENSIVE RECURRING EVENTS DIAGNOSTIC SCRIPT
// Run this in browser console on your church music pro site

console.log('🔍 COMPREHENSIVE RECURRING EVENTS DIAGNOSTIC');
console.log('='.repeat(60));

async function comprehensiveDiagnostic() {
  try {
    console.log('📊 PHASE 1: API DATA ANALYSIS');
    console.log('-'.repeat(40));

    // Get current date info
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    
    console.log(`Current date: ${now.toISOString()}`);
    console.log(`Looking for August 31st events...`);

    // 1. TEST CURRENT MONTH API (should include Aug 31st if we're in August)
    console.log('\n1️⃣ Testing Current Month API (/api/events)...');
    const eventsResponse = await fetch(`/api/events?month=${currentMonth}&year=${currentYear}`);
    const eventsData = await eventsResponse.json();
    
    console.log(`✅ Current month events found: ${eventsData.events?.length || 0}`);
    
    // Look specifically for August 31st
    const aug31Events = eventsData.events?.filter(event => {
      const eventDate = new Date(event.startTime);
      return eventDate.getMonth() === 7 && eventDate.getDate() === 31; // August = month 7
    }) || [];
    
    console.log(`🎯 August 31st events found: ${aug31Events.length}`);
    if (aug31Events.length > 0) {
      console.log('📋 August 31st events details:', aug31Events);
    }

    // 2. TEST PLAN PAGE API
    console.log('\n2️⃣ Testing Plan Page API (/api/planner)...');
    const planResponse = await fetch('/api/planner?offset=0&limit=100');
    const planData = await planResponse.json();
    
    console.log(`✅ Plan page events found: ${planData.events?.length || 0}`);
    
    // Look for August 31st in plan data
    const planAug31 = planData.events?.filter(event => {
      const eventDate = new Date(event.startTime);
      return eventDate.getMonth() === 7 && eventDate.getDate() === 31;
    }) || [];
    
    console.log(`🎯 August 31st events in plan API: ${planAug31.length}`);
    if (planAug31.length > 0) {
      console.log('📋 Plan API August 31st events:', planAug31);
    }

    // 3. TEST ROOT RECURRING EVENTS
    console.log('\n3️⃣ Testing Root Recurring Events (/api/events?rootOnly=true)...');
    const rootResponse = await fetch('/api/events?rootOnly=true');
    const rootData = await rootResponse.json();
    
    console.log(`✅ Root recurring events found: ${rootData.events?.length || 0}`);
    rootData.events?.forEach((root, index) => {
      console.log(`📋 Root ${index + 1}: "${root.name}" (${root.eventType.name}) - Color: ${root.eventType.color}`);
    });

    // 4. CHECK ALL FUTURE EVENTS (next 90 days)
    console.log('\n4️⃣ Testing Future Events (next 90 days)...');
    const futureStart = now.toISOString().split('T')[0];
    const futureEnd = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    const futureResponse = await fetch(`/api/events?startDate=${futureStart}&endDate=${futureEnd}`);
    const futureData = await futureResponse.json();
    
    console.log(`✅ Future events (90 days) found: ${futureData.events?.length || 0}`);
    
    // Group by month for better analysis
    const eventsByMonth = {};
    futureData.events?.forEach(event => {
      const eventDate = new Date(event.startTime);
      const monthKey = `${eventDate.getFullYear()}-${String(eventDate.getMonth() + 1).padStart(2, '0')}`;
      if (!eventsByMonth[monthKey]) eventsByMonth[monthKey] = [];
      eventsByMonth[monthKey].push(event);
    });
    
    console.log('📅 Events by month:');
    Object.keys(eventsByMonth).sort().forEach(month => {
      console.log(`  ${month}: ${eventsByMonth[month].length} events`);
    });

    console.log('\n📊 PHASE 2: FRONTEND FILTERING ANALYSIS');
    console.log('-'.repeat(40));

    // 5. CHECK PLAN PAGE FILTER STATE
    console.log('\n5️⃣ Checking Plan Page Filter State...');
    const planFilters = localStorage.getItem('eventPlannerFilters');
    console.log('💾 Saved plan filters:', planFilters ? JSON.parse(planFilters) : 'None');

    // 6. CHECK IF WE'RE ON PLAN PAGE AND CAN ACCESS FILTER STATE
    if (window.location.pathname.includes('/plan')) {
      console.log('\n6️⃣ Analyzing Plan Page Frontend State...');
      
      // Try to access React state (this might not work but worth trying)
      const reactElements = document.querySelectorAll('[data-reactroot]');
      console.log('🔍 React elements found:', reactElements.length);
      
      // Check for filter checkboxes
      const filterCheckboxes = document.querySelectorAll('input[type="checkbox"]');
      console.log('☑️ Filter checkboxes found:', filterCheckboxes.length);
      
      filterCheckboxes.forEach((checkbox, index) => {
        const label = checkbox.parentElement?.textContent || checkbox.nextElementSibling?.textContent || 'Unknown';
        console.log(`  Checkbox ${index + 1}: ${label} - Checked: ${checkbox.checked}`);
      });
    }

    // 7. DETAILED EVENT ANALYSIS
    console.log('\n7️⃣ Detailed Event Analysis...');
    const allEvents = [
      ...(eventsData.events || []), 
      ...(planData.events || []), 
      ...(futureData.events || [])
    ];
    
    // Remove duplicates by ID
    const uniqueEvents = allEvents.filter((event, index, self) => 
      index === self.findIndex(e => e.id === event.id)
    );
    
    console.log(`📊 Total unique events found: ${uniqueEvents.length}`);
    
    // Analyze by generatedFrom (recurring series)
    const recurringSeriesMap = {};
    uniqueEvents.forEach(event => {
      if (event.generatedFrom) {
        if (!recurringSeriesMap[event.generatedFrom]) {
          recurringSeriesMap[event.generatedFrom] = [];
        }
        recurringSeriesMap[event.generatedFrom].push(event);
      }
    });
    
    console.log(`🔄 Recurring series found: ${Object.keys(recurringSeriesMap).length}`);
    Object.keys(recurringSeriesMap).forEach(rootId => {
      const events = recurringSeriesMap[rootId];
      const rootEvent = rootData.events?.find(r => r.id === rootId);
      const seriesName = rootEvent?.name || 'Unknown Series';
      
      console.log(`📅 "${seriesName}" series (${rootId}):`);
      console.log(`  Generated events: ${events.length}`);
      
      if (events.length > 0) {
        const dates = events.map(e => new Date(e.startTime).toLocaleDateString()).sort();
        console.log(`  Dates: ${dates.slice(0, 5).join(', ')}${dates.length > 5 ? ` (and ${dates.length - 5} more)` : ''}`);
        
        // Check for August 31st specifically
        const hasAug31 = events.some(e => {
          const date = new Date(e.startTime);
          return date.getMonth() === 7 && date.getDate() === 31;
        });
        console.log(`  Has August 31st: ${hasAug31 ? '✅ YES' : '❌ NO'}`);
      }
    });

    console.log('\n📊 PHASE 3: SUMMARY & RECOMMENDATIONS');
    console.log('-'.repeat(40));

    // Summary
    const hasApiData = (eventsData.events?.length > 0) || (planData.events?.length > 0) || (futureData.events?.length > 0);
    const hasAug31InAnyAPI = aug31Events.length > 0 || planAug31.length > 0;
    
    console.log(`\n📋 DIAGNOSTIC SUMMARY:`);
    console.log(`🔍 Events found in APIs: ${hasApiData ? '✅ YES' : '❌ NO'}`);
    console.log(`🎯 August 31st events in APIs: ${hasAug31InAnyAPI ? '✅ YES' : '❌ NO'}`);
    console.log(`🔄 Root recurring events: ${rootData.events?.length || 0}`);
    console.log(`📅 Future events (90 days): ${futureData.events?.length || 0}`);

    if (!hasApiData) {
      console.log(`\n❌ PROBLEM: No events found in any API!`);
      console.log(`📋 This suggests events may have been deleted from database.`);
      console.log(`💡 SOLUTION: Restore from Railway backup.`);
    } else if (!hasAug31InAnyAPI) {
      console.log(`\n❌ PROBLEM: August 31st events missing from APIs!`);
      console.log(`📋 Events exist but August 31st specifically is missing.`);
      console.log(`💡 SOLUTION: Check recurring event generation or manual creation.`);
    } else {
      console.log(`\n⚠️ PROBLEM: Events exist in API but not showing on frontend!`);
      console.log(`📋 This suggests a frontend filtering issue.`);
      console.log(`💡 SOLUTION: Check plan page color filters or React state.`);
    }

    return {
      eventsData,
      planData,
      rootData,
      futureData,
      uniqueEvents,
      recurringSeriesMap,
      hasApiData,
      hasAug31InAnyAPI
    };

  } catch (error) {
    console.error('❌ DIAGNOSTIC ERROR:', error);
    return null;
  }
}

// Run the comprehensive diagnostic
console.log('🚀 Starting diagnostic... Please wait...\n');
comprehensiveDiagnostic().then(results => {
  if (results) {
    console.log('\n✅ DIAGNOSTIC COMPLETE!');
    console.log('📋 Check the detailed analysis above.');
    console.log('🔍 Results stored in:', results);
    
    // Store results globally for further inspection
    window.debugResults = results;
    console.log('💾 Results available as: window.debugResults');
  } else {
    console.log('❌ DIAGNOSTIC FAILED - Check errors above');
  }
});

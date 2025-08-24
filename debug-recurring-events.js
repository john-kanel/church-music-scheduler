// Debug script to investigate recurring events
// Run this in the browser console on your site

console.log('=== RECURRING EVENTS DEBUG SCRIPT ===');

// 1. Check if user is logged in
const session = localStorage.getItem('next-auth.session-token') || 
                sessionStorage.getItem('next-auth.session-token');
console.log('1. Session exists:', !!session);

// 2. Check local storage for filter settings
const savedFilters = localStorage.getItem('eventPlannerFilters');
console.log('2. Saved filters:', savedFilters ? JSON.parse(savedFilters) : 'None');

// 3. Test API calls manually
async function testAPIs() {
  console.log('3. Testing API calls...');
  
  try {
    // Test current month events
    const currentDate = new Date();
    const month = currentDate.getMonth() + 1;
    const year = currentDate.getFullYear();
    
    console.log(`Testing current month: ${month}/${year}`);
    const currentResponse = await fetch(`/api/events?month=${month}&year=${year}`);
    const currentData = await currentResponse.json();
    console.log('Current month events:', currentData.events?.length || 0);
    
    // Test next month events
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    
    console.log(`Testing next month: ${nextMonth}/${nextYear}`);
    const nextResponse = await fetch(`/api/events?month=${nextMonth}&year=${nextYear}`);
    const nextData = await nextResponse.json();
    console.log('Next month events:', nextData.events?.length || 0);
    
    // Test plan page API
    console.log('Testing plan page API...');
    const planResponse = await fetch('/api/planner?offset=0&limit=50');
    const planData = await planResponse.json();
    console.log('Plan page events:', planData.events?.length || 0);
    
    // Test root recurring events
    console.log('Testing root events...');
    const rootResponse = await fetch('/api/events?rootOnly=true');
    const rootData = await rootResponse.json();
    console.log('Root recurring events:', rootData.events?.length || 0);
    
    // Show event details for analysis
    if (currentData.events?.length > 0) {
      console.log('Sample current month event:', currentData.events[0]);
    }
    if (nextData.events?.length > 0) {
      console.log('Sample next month event:', nextData.events[0]);
    }
    if (planData.events?.length > 0) {
      console.log('Sample plan event:', planData.events[0]);
    }
    if (rootData.events?.length > 0) {
      console.log('Sample root event:', rootData.events[0]);
    }
    
    return {
      currentMonth: currentData.events || [],
      nextMonth: nextData.events || [],
      planEvents: planData.events || [],
      rootEvents: rootData.events || []
    };
    
  } catch (error) {
    console.error('API test error:', error);
    return null;
  }
}

// Run the tests
testAPIs().then(results => {
  if (results) {
    console.log('=== SUMMARY ===');
    console.log('Current month events:', results.currentMonth.length);
    console.log('Next month events:', results.nextMonth.length);  
    console.log('Plan page events:', results.planEvents.length);
    console.log('Root recurring events:', results.rootEvents.length);
    
    // Analyze event types and colors
    const allEvents = [...results.currentMonth, ...results.nextMonth, ...results.planEvents];
    const uniqueColors = [...new Set(allEvents.map(e => e.eventType?.color))];
    const uniqueTypes = [...new Set(allEvents.map(e => e.eventType?.name))];
    
    console.log('Unique event colors found:', uniqueColors);
    console.log('Unique event types found:', uniqueTypes);
    
    // Check for future events
    const now = new Date();
    const futureEvents = allEvents.filter(e => new Date(e.startTime) > now);
    console.log('Future events found:', futureEvents.length);
    
    if (futureEvents.length > 0) {
      console.log('Sample future event:', futureEvents[0]);
    }
  }
});

console.log('Debug script loaded. Check results above.');

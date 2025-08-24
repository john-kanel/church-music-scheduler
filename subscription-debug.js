// SUBSCRIPTION STATUS DIAGNOSTIC
// Check current subscription status and identify the issue

console.log('💳 SUBSCRIPTION STATUS DIAGNOSTIC');
console.log('='.repeat(50));

async function checkSubscriptionStatus() {
  try {
    console.log('🔍 Checking subscription status...\n');

    // Check multiple endpoints to see subscription status
    const endpoints = [
      { name: 'Dashboard API', url: '/api/dashboard' },
      { name: 'Church Info', url: '/api/church' },
      { name: 'Billing Status', url: '/api/billing/status' },
      { name: 'Subscription Check', url: '/api/subscription/status' }
    ];

    const results = {};

    for (const endpoint of endpoints) {
      console.log(`📡 Testing: ${endpoint.name}...`);
      try {
        const response = await fetch(endpoint.url);
        const status = response.status;
        
        if (response.ok) {
          const data = await response.json();
          console.log(`  ✅ Status: ${status} - OK`);
          results[endpoint.name] = { status, data };
          
          // Look for subscription-related fields
          if (data.subscriptionStatus) {
            console.log(`  📋 Subscription Status: ${data.subscriptionStatus}`);
          }
          if (data.church?.subscriptionStatus) {
            console.log(`  📋 Church Subscription: ${data.church.subscriptionStatus}`);
          }
          if (data.isActive !== undefined) {
            console.log(`  📋 Is Active: ${data.isActive}`);
          }
        } else {
          console.log(`  ❌ Status: ${status} - ${response.statusText}`);
          const errorText = await response.text();
          results[endpoint.name] = { status, error: errorText };
          
          if (status === 403) {
            console.log(`  🚨 403 Forbidden - Subscription issue detected!`);
          }
        }
      } catch (error) {
        console.log(`  ❌ Error: ${error.message}`);
        results[endpoint.name] = { error: error.message };
      }
      console.log('');
    }

    // Check local session data
    console.log('🔍 Checking local session data...');
    const sessionData = localStorage.getItem('next-auth.session-token') || 
                       sessionStorage.getItem('next-auth.session-token');
    console.log(`📋 Session token exists: ${!!sessionData}`);

    // Check if we can access user info
    console.log('\n👤 Checking user session...');
    try {
      const userResponse = await fetch('/api/auth/session');
      if (userResponse.ok) {
        const userData = await userResponse.json();
        console.log(`✅ User session active: ${!!userData.user}`);
        if (userData.user) {
          console.log(`📋 User ID: ${userData.user.id}`);
          console.log(`📋 User Role: ${userData.user.role}`);
          console.log(`📋 Church ID: ${userData.user.churchId}`);
        }
        results.userSession = userData;
      } else {
        console.log(`❌ Session check failed: ${userResponse.status}`);
      }
    } catch (error) {
      console.log(`❌ Session check error: ${error.message}`);
    }

    // Test the specific endpoint that's failing
    console.log('\n🎯 Testing recurring series edit endpoint...');
    const rootEventId = 'cmdj1jy8k0001ph3l6a7gfkt7'; // From previous diagnostic
    
    try {
      const editResponse = await fetch(`/api/events/${rootEventId}/series`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          recurrenceEnd: '2025-12-31',
          editScope: 'future'
        })
      });
      
      console.log(`📋 Edit response status: ${editResponse.status}`);
      
      if (editResponse.status === 403) {
        const errorText = await editResponse.text();
        console.log(`🚨 403 Error details: ${errorText}`);
        
        if (errorText.includes('Subscription') || errorText.includes('expired')) {
          console.log(`💡 CONFIRMED: Subscription check is blocking the edit!`);
        }
      }
      
      results.editTest = { status: editResponse.status };
      
    } catch (error) {
      console.log(`❌ Edit test error: ${error.message}`);
    }

    console.log('\n📊 SUMMARY & RECOMMENDATIONS');
    console.log('-'.repeat(40));

    // Analyze results
    const has403Errors = Object.values(results).some(r => r.status === 403);
    const hasSubscriptionData = Object.values(results).some(r => 
      r.data?.subscriptionStatus || r.data?.church?.subscriptionStatus
    );

    if (has403Errors) {
      console.log('🚨 SUBSCRIPTION ISSUE DETECTED!');
      console.log('📋 Multiple endpoints returning 403 Forbidden');
      console.log('💡 SOLUTIONS:');
      console.log('  1. Clear browser cache and cookies');
      console.log('  2. Log out and log back in');
      console.log('  3. Check Railway database subscription status directly');
      console.log('  4. Verify Stripe webhook is working');
    } else if (!hasSubscriptionData) {
      console.log('⚠️ Cannot determine subscription status');
      console.log('💡 Try logging out and back in');
    } else {
      console.log('✅ Subscription appears to be working');
      console.log('💡 The error might be a cached response');
    }

    // Store results
    window.subscriptionResults = results;
    console.log('\n💾 Results stored as: window.subscriptionResults');

    return results;

  } catch (error) {
    console.error('❌ DIAGNOSTIC FAILED:', error);
    return null;
  }
}

// Run the diagnostic
checkSubscriptionStatus();

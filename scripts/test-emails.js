// Simple email testing script for Church Music Pro
const TEST_EMAIL = 'john.kanel@hey.com'

console.log('🎵 Church Music Pro Email Test')
console.log(`📧 Testing emails to: ${TEST_EMAIL}`)
console.log('\nThis script will test 10 different email templates with sample data.')
console.log('\n⚠️  Note: This is a development script to test email copy and formatting.')

// Sample email content for testing
const emailTests = [
  {
    name: 'Invitation Email',
    description: 'New musician invitation with login credentials',
    data: {
      recipientName: 'John Kanel',
      churchName: 'St. Mary\'s Catholic Church',
      inviterName: 'Sarah Thompson',
      temporaryPassword: 'TempPass123!'
    }
  },
  {
    name: 'Welcome Email',
    description: 'Welcome email after trial signup',
    data: {
      recipientName: 'John Kanel',
      churchName: 'St. Mary\'s Catholic Church',
      trialDays: 30
    }
  },
  {
    name: 'Payment Confirmation',
    description: 'Subscription payment confirmation',
    data: {
      recipientName: 'John Kanel',
      churchName: 'St. Mary\'s Catholic Church',
      planName: 'Professional Plan',
      planPrice: 29.99,
      planInterval: 'month'
    }
  },
  {
    name: 'Referral Promotion',
    description: 'Invitation to refer other churches',
    data: {
      recipientName: 'John Kanel',
      churchName: 'St. Mary\'s Catholic Church',
      referralCode: 'STMARYS2024'
    }
  },
  {
    name: 'Message Email',
    description: 'Communication between users',
    data: {
      recipientName: 'John Kanel',
      subject: 'Rehearsal Update for Sunday Service',
      message: 'Hi John,\n\nJust wanted to let you know that we\'ve moved tomorrow\'s rehearsal from 7:00 PM to 6:30 PM. Please arrive a few minutes early so we can run through the new hymn arrangement.\n\nLooking forward to seeing you there!\n\nBlessings,\nSarah',
      senderName: 'Sarah Thompson',
      churchName: 'St. Mary\'s Catholic Church'
    }
  },
  {
    name: 'Event Reminder',
    description: 'Automated musician event notification',
    data: {
      firstName: 'John',
      eventName: 'Sunday Morning Mass',
      eventTime: 'January 26, 2025 at 10:00 AM',
      location: 'Main Sanctuary',
      hoursBeforeEvent: 24
    }
  },
  {
    name: 'Pastor Monthly Report',
    description: 'Monthly music schedule summary for pastor',
    data: {
      pastorName: 'Father John',
      churchName: 'St. Mary\'s Catholic Church',
      month: 'January 2025',
      eventCount: 8
    }
  },
  {
    name: 'Pastor Daily Digest',
    description: 'Daily activity updates for pastor',
    data: {
      pastorName: 'Father John',
      churchName: 'St. Mary\'s Catholic Church',
      date: 'January 27, 2025',
      activityCount: 5
    }
  },
  {
    name: 'Referral Invitation',
    description: 'Invite other churches with referral code',
    data: {
      referrerName: 'Sarah Thompson',
      referrerChurch: 'St. Mary\'s Catholic Church',
      recipientName: 'John Kanel',
      referralCode: 'STMARYS2024'
    }
  },
  {
    name: 'Referral Success',
    description: 'Notification of successful referral reward',
    data: {
      referrerName: 'John Kanel',
      referredPerson: 'Father Michael',
      referredChurch: 'Holy Trinity Parish',
      rewardAmount: 29.99,
      totalRewards: 3
    }
  }
]

async function testEmailAPI() {
  console.log('\n🧪 Testing email API endpoint...')
  
  try {
    // Test the API endpoint that sends emails
    const response = await fetch('http://localhost:3000/api/test-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        testEmail: TEST_EMAIL,
        emailTests: emailTests
      })
    })

    if (response.ok) {
      const result = await response.json()
      console.log('✅ Email API test successful!')
      console.log('📧 Check your email for all 10 test templates')
    } else {
      console.log('❌ Email API test failed:', response.statusText)
      console.log('🔧 You may need to create the /api/test-email endpoint')
    }
  } catch (error) {
    console.log('❌ Could not connect to email API:', error.message)
    console.log('🔧 Make sure your Next.js dev server is running on port 3000')
  }
}

// Display the test plan
console.log('\n📋 Email Test Plan:')
emailTests.forEach((test, index) => {
  console.log(`   ${index + 1}. ${test.name} - ${test.description}`)
})

console.log('\n🚀 To send these emails, we need to create an API endpoint.')
console.log('📝 I\'ll create /api/test-email for you to run this test.')

module.exports = { emailTests, TEST_EMAIL } 
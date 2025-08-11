const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function setupChurchAccount() {
  try {
    console.log('🏛️ Setting up church and director account...')
    
    // Prompt for church information (you can edit these values)
    const CHURCH_NAME = "Your Church Name" // EDIT THIS
    const CHURCH_EMAIL = "director@yourchurch.com" // EDIT THIS  
    const DIRECTOR_FIRST_NAME = "Director" // EDIT THIS
    const DIRECTOR_LAST_NAME = "Name" // EDIT THIS
    const DIRECTOR_PASSWORD = "admin123" // EDIT THIS
    
    console.log(`\n📝 Creating church: ${CHURCH_NAME}`)
    console.log(`📧 Director email: ${CHURCH_EMAIL}`)
    
    // Create church
    const church = await prisma.church.create({
      data: {
        name: CHURCH_NAME,
        email: CHURCH_EMAIL,
        subscriptionStatus: 'TRIAL',
        subscriptionEnds: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
      }
    })
    
    console.log(`✅ Created church with ID: ${church.id}`)
    
    // Create director account
    console.log(`\n👑 Creating director account...`)
    const hashedPassword = await bcrypt.hash(DIRECTOR_PASSWORD, 12)
    
    const director = await prisma.user.create({
      data: {
        email: CHURCH_EMAIL,
        password: hashedPassword,
        firstName: DIRECTOR_FIRST_NAME,
        lastName: DIRECTOR_LAST_NAME,
        role: 'DIRECTOR',
        isVerified: true,
        churchId: church.id,
        emailNotifications: true,
        smsNotifications: false,
        hasCompletedOnboarding: true
      }
    })
    
    console.log(`✅ Created director account:`)
    console.log(`   ID: ${director.id}`)
    console.log(`   Email: ${director.email}`)
    console.log(`   Password: ${DIRECTOR_PASSWORD}`)
    console.log(`   Role: ${director.role}`)
    
    // Create default service parts
    console.log(`\n🎵 Creating default service parts...`)
    const serviceParts = [
      { name: 'Prelude', order: 1 },
      { name: 'Call to Worship', order: 2 },
      { name: 'Opening Hymn', order: 3 },
      { name: 'Anthem', order: 4 },
      { name: 'Offering', order: 5 },
      { name: 'Communion', order: 6 },
      { name: 'Closing Hymn', order: 7 },
      { name: 'Postlude', order: 8 }
    ]
    
    for (const part of serviceParts) {
      await prisma.servicePart.create({
        data: {
          ...part,
          churchId: church.id,
          createdById: director.id
        }
      })
    }
    
    console.log(`✅ Created ${serviceParts.length} service parts`)
    
    // Create default event type
    console.log(`\n📅 Creating default event type...`)
    await prisma.eventType.create({
      data: {
        name: 'Sunday Service',
        color: '#3B82F6',
        churchId: church.id,
        createdById: director.id
      }
    })
    
    console.log(`✅ Created default event type`)
    
    console.log(`\n🎉 Setup complete!`)
    console.log(`\n🔑 LOGIN CREDENTIALS:`)
    console.log(`   URL: https://churchmusicpro.com/login`)
    console.log(`   Email: ${CHURCH_EMAIL}`)
    console.log(`   Password: ${DIRECTOR_PASSWORD}`)
    console.log(`\n⚠️  IMPORTANT: Change your password immediately after logging in!`)
    
  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

setupChurchAccount()


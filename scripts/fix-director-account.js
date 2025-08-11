const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function fixDirectorAccount() {
  try {
    console.log('🔍 Checking current users in database...')
    
    // Find all users
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        churchId: true,
        isVerified: true
      }
    })
    
    console.log(`Found ${users.length} users:`)
    users.forEach(user => {
      console.log(`- ${user.firstName} ${user.lastName} (${user.email}) - Role: ${user.role} - Verified: ${user.isVerified}`)
    })
    
    // Find all churches
    const churches = await prisma.church.findMany({
      select: {
        id: true,
        name: true,
        email: true
      }
    })
    
    console.log(`\n🏛️ Found ${churches.length} churches:`)
    churches.forEach(church => {
      console.log(`- ${church.name} (${church.email}) - ID: ${church.id}`)
    })
    
    // Check if there's a director account
    const directors = users.filter(user => user.role === 'DIRECTOR')
    console.log(`\n👑 Found ${directors.length} director(s)`)
    
    if (directors.length === 0) {
      console.log('\n❌ No director account found!')
      
      if (churches.length > 0) {
        const church = churches[0]
        console.log(`\n🛠️ Creating director account for church: ${church.name}`)
        
        // Create director account
        const hashedPassword = await bcrypt.hash('admin123', 12)
        
        const newDirector = await prisma.user.create({
          data: {
            email: church.email || 'director@churchmusicpro.com',
            password: hashedPassword,
            firstName: 'Director',
            lastName: 'Account',
            role: 'DIRECTOR',
            isVerified: true,
            churchId: church.id,
            emailNotifications: true,
            smsNotifications: false
          }
        })
        
        console.log(`✅ Created director account:`)
        console.log(`   Email: ${newDirector.email}`)
        console.log(`   Password: admin123`)
        console.log(`   Role: ${newDirector.role}`)
        console.log(`\n🔑 You can now log in with these credentials and change the password in settings.`)
      } else {
        console.log('\n❌ No churches found! Database might be empty.')
      }
    } else {
      console.log('\n✅ Director account exists!')
      const director = directors[0]
      console.log(`   Email: ${director.email}`)
      console.log(`   Name: ${director.firstName} ${director.lastName}`)
      
      // Reset password to known value
      console.log('\n🔐 Resetting password to: admin123')
      const hashedPassword = await bcrypt.hash('admin123', 12)
      
      await prisma.user.update({
        where: { id: director.id },
        data: { 
          password: hashedPassword,
          isVerified: true
        }
      })
      
      console.log(`✅ Password reset for ${director.email}`)
      console.log(`   Email: ${director.email}`)
      console.log(`   Password: admin123`)
      console.log(`\n🔑 You can now log in with these credentials.`)
    }
    
  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

fixDirectorAccount()

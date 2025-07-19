import { resend, getLogoHTML } from './resend'
import { getEmailLogoHtml } from '../components/emails/email-logo'
import { prisma } from './db'
import { generateMonthlyReportPDF, generateWeeklyReportPDF } from './pdf-generator'

export async function sendMusicianEventNotification(
  email: string,
  firstName: string,
  event: any,
  hoursBeforeEvent: number
) {
  const timeframe = hoursBeforeEvent < 24 
    ? `${hoursBeforeEvent} hour${hoursBeforeEvent !== 1 ? 's' : ''}`
    : `${Math.floor(hoursBeforeEvent / 24)} day${Math.floor(hoursBeforeEvent / 24) !== 1 ? 's' : ''}`

  const subject = `Reminder: ${event.name} in ${timeframe}`

  // Fetch hymns and documents for this event (if event.id exists)
  let eventHymns = []
  let eventDocuments = []
  
  if (event.id) {
    // Real event - fetch from database
    [eventHymns, eventDocuments] = await Promise.all([
      prisma.eventHymn.findMany({
        where: { eventId: event.id },
        include: {
          servicePart: true
        },
        orderBy: { createdAt: 'asc' } // Order by creation time to maintain service order
      }),
      prisma.eventDocument.findMany({
        where: { eventId: event.id },
        orderBy: { uploadedAt: 'asc' }
      })
    ])
  } else {
    // Test event - use sample data
    eventHymns = [
      {
        id: 'test-1',
        title: 'Amazing Grace',
        notes: 'Key of G',
        servicePart: { name: 'Opening Hymn' },
        createdAt: new Date()
      },
      {
        id: 'test-2', 
        title: 'Be Still My Soul',
        notes: null,
        servicePart: { name: 'Communion Song' },
        createdAt: new Date()
      },
      {
        id: 'test-3',
        title: 'Go in Peace',
        notes: 'Repeat verse 2',
        servicePart: { name: 'Closing Hymn' },
        createdAt: new Date()
      }
    ]
    
    eventDocuments = [
      {
        id: 'test-doc-1',
        originalFilename: 'Amazing Grace - Sheet Music.pdf',
        uploadedAt: new Date()
      },
      {
        id: 'test-doc-2', 
        originalFilename: 'Be Still My Soul - Lyrics.pdf',
        uploadedAt: new Date()
      }
    ]
  }

  // Generate music section HTML
  const generateMusicSection = () => {
    // If no service parts at all, show "No music provided"
    if (eventHymns.length === 0) {
      return `
        <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin: 0 0 15px 0; color: #1f2937;">🎵 Music for this Service</h3>
          <p style="margin: 0; color: #6b7280; font-style: italic;">No music provided for this event</p>
        </div>
      `
    }

    // Generate hymn list
    const hymnsList = eventHymns.map((hymn: any, index: number) => {
      const servicePartName = hymn.servicePart?.name || 'Other'
      const title = hymn.title
      const notes = hymn.notes ? ` (${hymn.notes})` : ''
      
      return `${index + 1}. ${servicePartName}: ${title}${notes}`
    }).join('\n')

    // Generate document links if any
    let documentsSection = ''
    if (eventDocuments.length > 0) {
      const documentLinks = eventDocuments.map((doc: any) => {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://churchmusicpro.com'
        const viewUrl = event.id 
          ? `${baseUrl}/api/events/${event.id}/documents/${doc.id}/view`
          : `${baseUrl}/sample-music-files` // Test link for sample documents
        return `• <a href="${viewUrl}" style="color: #660033; text-decoration: none;">${doc.originalFilename}</a>`
      }).join('\n')

      documentsSection = `
        <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #e5e7eb;">
          <h4 style="margin: 0 0 8px 0; color: #1f2937; font-size: 14px;">📁 Music Files (${eventDocuments.length}):</h4>
          <div style="font-size: 14px; line-height: 1.6; color: #4b5563;">
${documentLinks}
          </div>
        </div>
      `
    }

    return `
      <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin: 0 0 15px 0; color: #1f2937;">🎵 Music for this Service</h3>
        <div style="white-space: pre-line; font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif; color: #4b5563; line-height: 1.6; font-size: 14px;">
${hymnsList}
        </div>
        ${documentsSection}
      </div>
    `
  }

  const musiciansList = event.assignments && event.assignments.length > 0
    ? event.assignments
        .filter((assignment: any) => assignment.user)
        .map((assignment: any) => `${assignment.user.firstName} ${assignment.user.lastName}`)
        .join(', ')
    : 'No assignments yet'

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <!-- Logo Section -->
      <div style="background: #f8f9fa; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; border-bottom: 3px solid #660033;">
        ${getEmailLogoHtml()}
        <h1 style="color: #333; margin: 0; font-size: 24px;">🎵 Event Reminder</h1>
      </div>
      
      <div style="background: white; padding: 30px 20px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);">
      
      <p>Hi ${firstName},</p>
      
      <p>This is a reminder that you're scheduled for the following event:</p>
      
      <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin: 0 0 15px 0; color: #1f2937;">${event.name}</h3>
        <p style="margin: 5px 0;"><strong>Date & Time:</strong> ${new Date(event.startTime).toLocaleString()}</p>
        <p style="margin: 5px 0;"><strong>Location:</strong> ${event.location}</p>
        ${event.description ? `<p style="margin: 5px 0;"><strong>Description:</strong> ${event.description}</p>` : ''}
        <p style="margin: 5px 0;"><strong>Duration:</strong> ${event.endTime ? 
          `${Math.round((new Date(event.endTime).getTime() - new Date(event.startTime).getTime()) / (1000 * 60))} minutes` : 
          'TBD'}</p>
      </div>
      
      ${generateMusicSection()}
      
      <div style="background-color: #ecfdf5; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <h4 style="margin: 0 0 10px 0; color: #065f46;">Other Musicians Assigned:</h4>
        <p style="margin: 0;">${musiciansList}</p>
      </div>
      
      <p>Thank you for your service in the music ministry!</p>
      
      <p style="color: #6b7280; font-size: 14px;">
        This is an automated reminder. If you have any questions, please contact your music director.
      </p>
      </div>
    </div>
  `

  await resend.emails.send({
    from: 'Church Music Pro <notifications@churchmusicpro.com>',
    to: email,
    subject,
    html: htmlContent
  })
}

export async function sendPastorMonthlyReport(
  email: string,
  firstName: string,
  churchName: string,
  events: any[],
  month: Date
) {
  const monthName = month.toLocaleString('default', { month: 'long', year: 'numeric' })
  const subject = `Monthly Music Schedule Report - ${monthName}`

  // Generate PDF attachment with all events and music
  let pdfAttachment = null
  let pdfError = false

  try {
    // Fetch detailed event data with hymns for each event
    const eventsWithMusic = await Promise.all(events.map(async (event) => {
      try {
        // Fetch hymns for this event
        const eventHymns = await prisma.eventHymn.findMany({
          where: { eventId: event.id },
          include: {
            servicePart: true
          },
          orderBy: [
            { servicePart: { order: 'asc' } },
            { createdAt: 'asc' }
          ]
        })

        return {
          ...event,
          hymns: eventHymns
        }
      } catch (error) {
        console.error(`Error fetching hymns for event ${event.id}:`, error)
        return {
          ...event,
          hymns: []
        }
      }
    }))

    const pdfBuffer = await generateMonthlyReportPDF(
      churchName,
      eventsWithMusic,
      month,
      true // Include music
    )

    const filename = `${churchName.replace(/[^a-zA-Z0-9]/g, '_')}_Monthly_Report_${month.getFullYear()}_${(month.getMonth() + 1).toString().padStart(2, '0')}.pdf`
    
    pdfAttachment = {
      filename,
      content: pdfBuffer
    }
  } catch (error) {
    console.error('Error generating monthly report PDF:', error)
    pdfError = true
  }

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <!-- Logo Section -->
      <div style="background: #f8f9fa; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; border-bottom: 3px solid #660033;">
        ${getEmailLogoHtml()}
        <h1 style="color: #333; margin: 0; font-size: 24px;">📊 Monthly Music Schedule Report</h1>
      </div>
      
      <div style="background: white; padding: 30px 20px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);">
      
      <p>Dear ${firstName},</p>
      
      <p>Here is the music schedule for ${churchName} for <strong>${monthName}</strong>:</p>
      
      ${pdfError ? `
        <div style="background-color: #fef2f2; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ef4444;">
          <p style="margin: 0; color: #dc2626; font-size: 14px;">
            <strong>Note:</strong> PDF generation failed. Please see the schedule details below.
          </p>
        </div>
      ` : `
        <div style="background-color: #f0f9ff; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6;">
          <p style="margin: 0; color: #1d4ed8; font-size: 14px;">
            <strong>PDF Attached:</strong> A detailed PDF report with all events, assignments, and music is attached to this email.
          </p>
        </div>
      `}
      
      <div style="margin: 20px 0;">
        ${events.map((event: any) => `
          <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 10px 0; border-left: 4px solid #660033;">
            <h4 style="margin: 0 0 10px 0; color: #1f2937;">${event.name}</h4>
            <p style="margin: 5px 0;"><strong>Date:</strong> ${new Date(event.startTime).toLocaleDateString()}</p>
            <p style="margin: 5px 0;"><strong>Time:</strong> ${new Date(event.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
            <p style="margin: 5px 0;"><strong>Location:</strong> ${event.location}</p>
            ${event.assignments && event.assignments.length > 0 ? `
              <p style="margin: 5px 0;"><strong>Musicians:</strong> ${event.assignments.filter((a: any) => a.user).map((a: any) => `${a.user.firstName} ${a.user.lastName}`).join(', ')}</p>
            ` : ''}
          </div>
        `).join('')}
      </div>
      
      <p style="margin-top: 30px;">
        <strong>Summary:</strong> ${events.length} event${events.length !== 1 ? 's' : ''} scheduled for ${monthName}
      </p>
      
      <p style="color: #6b7280; font-size: 14px;">
        This report is automatically generated on the 27th of each month. 
        If you have any questions about the music schedule, please contact your music director.
      </p>
      </div>
    </div>
  `

  const emailData: any = {
    from: 'Church Music Pro <notifications@churchmusicpro.com>',
    to: email,
    subject,
    html: htmlContent
  }

  // Add PDF attachment if generated successfully
  if (pdfAttachment && !pdfError) {
    emailData.attachments = [pdfAttachment]
  }

  await resend.emails.send(emailData)
}

export async function sendPastorDailyDigest(
  email: string,
  firstName: string,
  churchName: string,
  activities: any[],
  date: Date
) {
  const dateString = date.toLocaleDateString()
  const subject = `Daily Music Ministry Update - ${dateString}`

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <!-- Logo Section -->
      <div style="background: #f8f9fa; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; border-bottom: 3px solid #660033;">
        ${getEmailLogoHtml()}
        <h1 style="color: #333; margin: 0; font-size: 24px;">📰 Daily Music Ministry Update</h1>
      </div>
      
      <div style="background: white; padding: 30px 20px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);">
      
      <p>Dear ${firstName},</p>
      
      <p>Here are the music ministry updates for ${churchName} from <strong>${dateString}</strong>:</p>
      
      <div style="margin: 20px 0;">
        ${activities.map(activity => `
          <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 10px 0;">
            <p style="margin: 0;"><strong>${activity.description}</strong></p>
            <p style="margin: 5px 0 0 0; color: #6b7280; font-size: 14px;">
              ${new Date(activity.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        `).join('')}
      </div>
      
      <p style="color: #6b7280; font-size: 14px;">
        This digest is sent daily when there are changes to the music schedule. 
        You can unsubscribe from these notifications in your account settings.
      </p>
      </div>
    </div>
  `

  await resend.emails.send({
    from: 'Church Music Pro <notifications@churchmusicpro.com>',
    to: email,
    subject,
    html: htmlContent
  })
}

export async function sendPastorWeeklyReport(
  email: string,
  firstName: string,
  churchName: string,
  events: any[],
  weekStartDate: Date
) {
  const weekEndDate = new Date(weekStartDate)
  weekEndDate.setDate(weekStartDate.getDate() + 6)
  
  const dateRange = `${weekStartDate.toLocaleDateString()} - ${weekEndDate.toLocaleDateString()}`
  const subject = `Weekly Music Schedule Report - ${dateRange}`

  // Generate PDF attachment with all events and music
  let pdfAttachment = null
  let pdfError = false

  try {
    // Fetch detailed event data with hymns for each event
    const eventsWithMusic = await Promise.all(events.map(async (event) => {
      try {
        // Fetch hymns for this event
        const eventHymns = await prisma.eventHymn.findMany({
          where: { eventId: event.id },
          include: {
            servicePart: true
          },
          orderBy: [
            { servicePart: { order: 'asc' } },
            { createdAt: 'asc' }
          ]
        })

        return {
          ...event,
          hymns: eventHymns
        }
      } catch (error) {
        console.error(`Error fetching hymns for event ${event.id}:`, error)
        return {
          ...event,
          hymns: []
        }
      }
    }))

    const pdfBuffer = await generateWeeklyReportPDF(
      churchName,
      eventsWithMusic,
      weekStartDate,
      true // Include music
    )

    const filename = `${churchName.replace(/[^a-zA-Z0-9]/g, '_')}_Weekly_Report_${weekStartDate.toISOString().split('T')[0]}.pdf`
    
    pdfAttachment = {
      filename,
      content: pdfBuffer
    }
  } catch (error) {
    console.error('Error generating weekly report PDF:', error)
    pdfError = true
  }

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <!-- Logo Section -->
      <div style="background: #f8f9fa; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; border-bottom: 3px solid #660033;">
        ${getEmailLogoHtml()}
        <h1 style="color: #333; margin: 0; font-size: 24px;">📅 Weekly Music Schedule Report</h1>
      </div>
      
      <div style="background: white; padding: 30px 20px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);">
      
      <p>Dear ${firstName},</p>
      
      <p>Here is the music schedule for ${churchName} for the week of <strong>${dateRange}</strong>:</p>
      
      ${pdfError ? `
        <div style="background-color: #fef2f2; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ef4444;">
          <p style="margin: 0; color: #dc2626; font-size: 14px;">
            <strong>Note:</strong> PDF generation failed. Please see the schedule details below.
          </p>
        </div>
      ` : `
        <div style="background-color: #f0f9ff; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6;">
          <p style="margin: 0; color: #1d4ed8; font-size: 14px;">
            <strong>PDF Attached:</strong> A detailed PDF report with all events, assignments, and music is attached to this email.
          </p>
        </div>
      `}
      
      <div style="margin: 20px 0;">
        ${events.map((event: any) => `
          <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 10px 0; border-left: 4px solid #660033;">
            <h4 style="margin: 0 0 10px 0; color: #1f2937;">${event.name}</h4>
            <p style="margin: 5px 0;"><strong>Date:</strong> ${new Date(event.startTime).toLocaleDateString()}</p>
            <p style="margin: 5px 0;"><strong>Time:</strong> ${new Date(event.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
            <p style="margin: 5px 0;"><strong>Location:</strong> ${event.location}</p>
            ${event.assignments && event.assignments.length > 0 ? `
              <p style="margin: 5px 0;"><strong>Musicians:</strong> ${event.assignments.filter((a: any) => a.user).map((a: any) => `${a.user.firstName} ${a.user.lastName}`).join(', ')}</p>
            ` : ''}
          </div>
        `).join('')}
      </div>
      
      <p style="margin-top: 30px;">
        <strong>Summary:</strong> ${events.length} event${events.length !== 1 ? 's' : ''} scheduled for this week
      </p>
      
      <p style="color: #6b7280; font-size: 14px;">
        This report is automatically generated on your selected day of the week. 
        If you have any questions about the music schedule, please contact your music director.
      </p>
      </div>
    </div>
  `

  const emailData: any = {
    from: 'Church Music Pro <notifications@churchmusicpro.com>',
    to: email,
    subject,
    html: htmlContent
  }

  // Add PDF attachment if generated successfully
  if (pdfAttachment && !pdfError) {
    emailData.attachments = [pdfAttachment]
  }

  await resend.emails.send(emailData)
} 
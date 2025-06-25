import { resend } from './resend'

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

  const musiciansList = event.assignments
    .map((assignment: any) => `${assignment.user.firstName} ${assignment.user.lastName}`)
    .join(', ')

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                      <h2 style="color: #660033;">Event Reminder</h2>
      
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
      
      <div style="background-color: #ecfdf5; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <h4 style="margin: 0 0 10px 0; color: #065f46;">Other Musicians Assigned:</h4>
        <p style="margin: 0;">${musiciansList}</p>
      </div>
      
      <p>Thank you for your service in the music ministry!</p>
      
      <p style="color: #6b7280; font-size: 14px;">
        This is an automated reminder. If you have any questions, please contact your music director.
      </p>
    </div>
  `

  await resend.emails.send({
    from: 'Church Music Scheduler <notifications@churchmusicscheduler.com>',
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

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                      <h2 style="color: #660033;">Monthly Music Schedule Report</h2>
      
      <p>Dear ${firstName},</p>
      
      <p>Here is the music schedule for ${churchName} for <strong>${monthName}</strong>:</p>
      
      <div style="margin: 20px 0;">
        ${events.map(event => `
          <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 10px 0; border-left: 4px solid #660033;">
            <h4 style="margin: 0 0 10px 0; color: #1f2937;">${event.name}</h4>
            <p style="margin: 5px 0;"><strong>Date:</strong> ${new Date(event.startTime).toLocaleDateString()}</p>
            <p style="margin: 5px 0;"><strong>Time:</strong> ${new Date(event.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
            <p style="margin: 5px 0;"><strong>Location:</strong> ${event.location}</p>
            ${event.assignments.length > 0 ? `
              <p style="margin: 5px 0;"><strong>Musicians:</strong> ${event.assignments.map((a: any) => `${a.user.firstName} ${a.user.lastName}`).join(', ')}</p>
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
  `

  await resend.emails.send({
    from: 'Church Music Scheduler <notifications@churchmusicscheduler.com>',
    to: email,
    subject,
    html: htmlContent
  })
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
                      <h2 style="color: #660033;">Daily Music Ministry Update</h2>
      
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
  `

  await resend.emails.send({
    from: 'Church Music Scheduler <notifications@churchmusicscheduler.com>',
    to: email,
    subject,
    html: htmlContent
  })
} 
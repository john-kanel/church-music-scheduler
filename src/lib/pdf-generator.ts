import jsPDF from 'jspdf'

interface PDFEvent {
  id: string
  name: string
  startTime: string
  endTime?: string
  location: string
  description?: string
  assignments: {
    roleName: string
    user?: {
      firstName: string
      lastName: string
    }
    group?: {
      name: string
    }
  }[]
  eventType: {
    name: string
  }
}

interface PDFHymn {
  title: string
  notes?: string
  servicePart?: {
    name: string
  }
}

export async function generateMonthlyReportPDF(
  churchName: string,
  events: PDFEvent[],
  month: Date,
  includeMusic: boolean = true
): Promise<Buffer> {
  try {
    const pdf = new jsPDF()
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    let yPosition = 20

    // Header
    pdf.setFontSize(20)
    pdf.setFont('helvetica', 'bold')
    const monthName = month.toLocaleString('default', { month: 'long', year: 'numeric' })
    const title = `${churchName} - Monthly Music Schedule`
    pdf.text(title, pageWidth / 2, yPosition, { align: 'center' })
    
    yPosition += 10
    pdf.setFontSize(14)
    pdf.setFont('helvetica', 'normal')
    pdf.text(monthName, pageWidth / 2, yPosition, { align: 'center' })
    
    yPosition += 20

    // Sort events chronologically
    const sortedEvents = events.sort((a, b) => {
      const dateA = new Date(a.startTime)
      const dateB = new Date(b.startTime)
      return dateA.getTime() - dateB.getTime()
    })

    if (sortedEvents.length === 0) {
      pdf.setFontSize(12)
      pdf.text('No events scheduled for this month', pageWidth / 2, yPosition, { align: 'center' })
    } else {
      // Process each event and fetch hymns if needed
      for (const event of sortedEvents) {
        let eventHymns: PDFHymn[] = []
        
        if (includeMusic) {
          try {
            // In a real implementation, this would fetch from the API
            // For now, we'll leave it empty as the automation-emails will handle the API call
            eventHymns = []
          } catch (error) {
            console.error(`Error fetching hymns for event ${event.id}:`, error)
          }
        }

        // Check if we need a new page
        if (yPosition > pageHeight - 60) {
          pdf.addPage()
          yPosition = 20
        }

        const eventDate = new Date(event.startTime)
        const eventEndDate = event.endTime ? new Date(event.endTime) : null
        
        // Event title
        pdf.setFont('helvetica', 'bold')
        pdf.text(event.name, 20, yPosition)
        yPosition += 7

        // Date and time
        pdf.setFont('helvetica', 'normal')
        const dateStr = eventDate.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })
        const timeStr = eventDate.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        }) + (eventEndDate ? ` - ${eventEndDate.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        })}` : '')
        
        pdf.text(`Date: ${dateStr}`, 25, yPosition)
        yPosition += 5
        pdf.text(`Time: ${timeStr}`, 25, yPosition)
        yPosition += 5

        // Location
        if (event.location) {
          pdf.text(`Location: ${event.location}`, 25, yPosition)
          yPosition += 5
        }

        // Event type
        pdf.text(`Type: ${event.eventType.name}`, 25, yPosition)
        yPosition += 5

        // Assignments summary
        if (event.assignments && event.assignments.length > 0) {
          const assignedCount = event.assignments.filter(a => a.user).length
          const openCount = event.assignments.filter(a => !a.user).length
          const totalSpots = event.assignments.length
          
          pdf.text(`Assignments: ${assignedCount}/${totalSpots} filled (${openCount} open)`, 25, yPosition)
          yPosition += 5

          // List assignments
          event.assignments.forEach((assignment) => {
            if (yPosition > pageHeight - 20) {
              pdf.addPage()
              yPosition = 20
            }
            
            const assigneeText = assignment.user 
              ? `${assignment.user.firstName} ${assignment.user.lastName}`
              : assignment.group?.name || 'Open'
            
            pdf.text(`  • ${assignment.roleName}: ${assigneeText}`, 30, yPosition)
            yPosition += 4
          })
        }

        // Music section (if enabled and hymns are available)
        if (includeMusic && eventHymns && eventHymns.length > 0) {
          yPosition += 2
          pdf.text(`Music & Service Parts (${eventHymns.length} items):`, 25, yPosition)
          yPosition += 5

          eventHymns.forEach((hymn: PDFHymn, index: number) => {
            if (yPosition > pageHeight - 20) {
              pdf.addPage()
              yPosition = 20
            }
            
            const servicePartName = hymn.servicePart?.name || 'Other'
            const hymnText = `  ${index + 1}. ${servicePartName}: ${hymn.title}${hymn.notes ? ` (${hymn.notes})` : ''}`
            
            // Handle long hymn titles that might need wrapping
            const hymnLines = pdf.splitTextToSize(hymnText, pageWidth - 60)
            if (hymnLines.length === 1) {
              pdf.text(hymnLines[0], 30, yPosition)
              yPosition += 4
            } else {
              // Multi-line hymn entry
              hymnLines.forEach((line: string, lineIndex: number) => {
                if (yPosition > pageHeight - 20) {
                  pdf.addPage()
                  yPosition = 20
                }
                pdf.text(line, lineIndex === 0 ? 30 : 35, yPosition)
                yPosition += 4
              })
            }
          })
          yPosition += 2
        }

        // Description
        if (event.description) {
          yPosition += 2
          const lines = pdf.splitTextToSize(event.description, pageWidth - 50)
          pdf.text(`Description: ${lines[0]}`, 25, yPosition)
          if (lines.length > 1) {
            for (let i = 1; i < lines.length; i++) {
              yPosition += 4
              pdf.text(lines[i], 25, yPosition)
            }
          }
          yPosition += 5
        }

        yPosition += 10 // Space between events
      }
    }

    // Summary section
    if (yPosition > pageHeight - 40) {
      pdf.addPage()
      yPosition = 20
    }

    yPosition += 10
    pdf.setFont('helvetica', 'bold')
    pdf.text('Monthly Summary:', 20, yPosition)
    yPosition += 7

    pdf.setFont('helvetica', 'normal')
    pdf.text(`Total Events: ${sortedEvents.length}`, 25, yPosition)
    yPosition += 5

    const totalAssignments = sortedEvents.reduce((sum, event) => sum + event.assignments.length, 0)
    const filledAssignments = sortedEvents.reduce((sum, event) => 
      sum + event.assignments.filter(a => a.user).length, 0)
    
    pdf.text(`Total Assignments: ${filledAssignments}/${totalAssignments} filled`, 25, yPosition)
    yPosition += 5

    // Event types breakdown
    const eventTypeCount = sortedEvents.reduce((acc, event) => {
      acc[event.eventType.name] = (acc[event.eventType.name] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    pdf.text('Events by Type:', 25, yPosition)
    yPosition += 5

    Object.entries(eventTypeCount).forEach(([type, count]) => {
      pdf.text(`  • ${type}: ${count}`, 30, yPosition)
      yPosition += 4
    })

    // Footer
    const footerY = pageHeight - 15
    pdf.setFontSize(8)
    pdf.setFont('helvetica', 'normal')
    pdf.text(`Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`, 20, footerY)
    
    // Add page numbers
    const totalPages = pdf.getNumberOfPages()
    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i)
      pdf.text(`Page ${i} of ${totalPages}`, pageWidth - 20, footerY, { align: 'right' })
    }

    // Return the PDF as a buffer
    const pdfArrayBuffer = pdf.output('arraybuffer')
    return Buffer.from(pdfArrayBuffer)

  } catch (error) {
    console.error('Error generating monthly report PDF:', error)
    throw new Error('PDF generation failed')
  }
}

export async function generateWeeklyReportPDF(
  churchName: string,
  events: PDFEvent[],
  weekStartDate: Date,
  includeMusic: boolean = true
): Promise<Buffer> {
  try {
    const pdf = new jsPDF()
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    let yPosition = 20

    // Calculate week end date
    const weekEndDate = new Date(weekStartDate)
    weekEndDate.setDate(weekStartDate.getDate() + 6)

    // Header
    pdf.setFontSize(20)
    pdf.setFont('helvetica', 'bold')
    const title = `${churchName} - Weekly Music Schedule`
    pdf.text(title, pageWidth / 2, yPosition, { align: 'center' })
    
    yPosition += 10
    pdf.setFontSize(14)
    pdf.setFont('helvetica', 'normal')
    const dateRange = `${weekStartDate.toLocaleDateString()} - ${weekEndDate.toLocaleDateString()}`
    pdf.text(dateRange, pageWidth / 2, yPosition, { align: 'center' })
    
    yPosition += 20

    // Filter and sort events for this week
    const weekEvents = events.filter(event => {
      const eventDate = new Date(event.startTime)
      return eventDate >= weekStartDate && eventDate <= weekEndDate
    }).sort((a, b) => {
      const dateA = new Date(a.startTime)
      const dateB = new Date(b.startTime)
      return dateA.getTime() - dateB.getTime()
    })

    if (weekEvents.length === 0) {
      pdf.setFontSize(12)
      pdf.text('No events scheduled for this week', pageWidth / 2, yPosition, { align: 'center' })
    } else {
      // Use the same event processing logic as monthly report
      for (const event of weekEvents) {
        let eventHymns: PDFHymn[] = []
        
        if (includeMusic) {
          try {
            eventHymns = []
          } catch (error) {
            console.error(`Error fetching hymns for event ${event.id}:`, error)
          }
        }

        // Check if we need a new page
        if (yPosition > pageHeight - 60) {
          pdf.addPage()
          yPosition = 20
        }

        const eventDate = new Date(event.startTime)
        const eventEndDate = event.endTime ? new Date(event.endTime) : null
        
        // Event title
        pdf.setFont('helvetica', 'bold')
        pdf.text(event.name, 20, yPosition)
        yPosition += 7

        // Date and time
        pdf.setFont('helvetica', 'normal')
        const dateStr = eventDate.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })
        const timeStr = eventDate.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        }) + (eventEndDate ? ` - ${eventEndDate.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        })}` : '')
        
        pdf.text(`Date: ${dateStr}`, 25, yPosition)
        yPosition += 5
        pdf.text(`Time: ${timeStr}`, 25, yPosition)
        yPosition += 5

        // Location
        if (event.location) {
          pdf.text(`Location: ${event.location}`, 25, yPosition)
          yPosition += 5
        }

        // Event type
        pdf.text(`Type: ${event.eventType.name}`, 25, yPosition)
        yPosition += 5

        // Assignments
        if (event.assignments && event.assignments.length > 0) {
          const assignedCount = event.assignments.filter(a => a.user).length
          const openCount = event.assignments.filter(a => !a.user).length
          const totalSpots = event.assignments.length
          
          pdf.text(`Assignments: ${assignedCount}/${totalSpots} filled (${openCount} open)`, 25, yPosition)
          yPosition += 5

          event.assignments.forEach((assignment) => {
            if (yPosition > pageHeight - 20) {
              pdf.addPage()
              yPosition = 20
            }
            
            const assigneeText = assignment.user 
              ? `${assignment.user.firstName} ${assignment.user.lastName}`
              : assignment.group?.name || 'Open'
            
            pdf.text(`  • ${assignment.roleName}: ${assigneeText}`, 30, yPosition)
            yPosition += 4
          })
        }

        // Music section (if enabled and hymns are available)
        if (includeMusic && eventHymns && eventHymns.length > 0) {
          yPosition += 2
          pdf.text(`Music & Service Parts (${eventHymns.length} items):`, 25, yPosition)
          yPosition += 5

          eventHymns.forEach((hymn: PDFHymn, index: number) => {
            if (yPosition > pageHeight - 20) {
              pdf.addPage()
              yPosition = 20
            }
            
            const servicePartName = hymn.servicePart?.name || 'Other'
            const hymnText = `  ${index + 1}. ${servicePartName}: ${hymn.title}${hymn.notes ? ` (${hymn.notes})` : ''}`
            
            const hymnLines = pdf.splitTextToSize(hymnText, pageWidth - 60)
            if (hymnLines.length === 1) {
              pdf.text(hymnLines[0], 30, yPosition)
              yPosition += 4
            } else {
              hymnLines.forEach((line: string, lineIndex: number) => {
                if (yPosition > pageHeight - 20) {
                  pdf.addPage()
                  yPosition = 20
                }
                pdf.text(line, lineIndex === 0 ? 30 : 35, yPosition)
                yPosition += 4
              })
            }
          })
          yPosition += 2
        }

        // Description
        if (event.description) {
          yPosition += 2
          const lines = pdf.splitTextToSize(event.description, pageWidth - 50)
          pdf.text(`Description: ${lines[0]}`, 25, yPosition)
          if (lines.length > 1) {
            for (let i = 1; i < lines.length; i++) {
              yPosition += 4
              pdf.text(lines[i], 25, yPosition)
            }
          }
          yPosition += 5
        }

        yPosition += 10
      }
    }

    // Weekly summary
    if (yPosition > pageHeight - 40) {
      pdf.addPage()
      yPosition = 20
    }

    yPosition += 10
    pdf.setFont('helvetica', 'bold')
    pdf.text('Weekly Summary:', 20, yPosition)
    yPosition += 7

    pdf.setFont('helvetica', 'normal')
    pdf.text(`Total Events: ${weekEvents.length}`, 25, yPosition)
    yPosition += 5

    const totalAssignments = weekEvents.reduce((sum, event) => sum + event.assignments.length, 0)
    const filledAssignments = weekEvents.reduce((sum, event) => 
      sum + event.assignments.filter(a => a.user).length, 0)
    
    pdf.text(`Total Assignments: ${filledAssignments}/${totalAssignments} filled`, 25, yPosition)

    // Footer
    const footerY = pageHeight - 15
    pdf.setFontSize(8)
    pdf.setFont('helvetica', 'normal')
    pdf.text(`Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`, 20, footerY)
    
    // Add page numbers
    const totalPages = pdf.getNumberOfPages()
    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i)
      pdf.text(`Page ${i} of ${totalPages}`, pageWidth - 20, footerY, { align: 'right' })
    }

    return Buffer.from(pdf.output('arraybuffer'))

  } catch (error) {
    console.error('Error generating weekly report PDF:', error)
    throw new Error('PDF generation failed')
  }
} 
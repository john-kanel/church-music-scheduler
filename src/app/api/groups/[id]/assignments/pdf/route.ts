import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import jsPDF from 'jspdf'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.churchId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: groupId } = await params

    // Permissions: staff or any musician can view their church group PDFs
    const allowedRoles = ['DIRECTOR', 'ASSOCIATE_DIRECTOR', 'PASTOR', 'ASSOCIATE_PASTOR', 'MUSICIAN']
    if (!allowedRoles.includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Verify group belongs to church
    const group = await prisma.group.findFirst({
      where: { id: groupId, churchId: session.user.churchId },
      select: { id: true, name: true, description: true, churchId: true }
    })
    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 })
    }

    // Fetch upcoming events where this group is assigned
    const now = new Date()
    const events = await prisma.event.findMany({
      where: {
        churchId: session.user.churchId,
        startTime: { gte: now },
        assignments: {
          some: { groupId: group.id }
        }
      },
      include: {
        eventType: true,
        assignments: {
          include: {
            user: { select: { firstName: true, lastName: true } },
            group: { select: { name: true } }
          }
        },
        hymns: {
          include: { servicePart: true },
          orderBy: { createdAt: 'asc' }
        }
      },
      orderBy: { startTime: 'asc' }
    })

    // Generate PDF
    const pdf = new jsPDF()
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    let y = 20

    // Header
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(18)
    pdf.text(`${group.name} — Upcoming Assignments`, pageWidth / 2, y, { align: 'center' })
    y += 8
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(11)
    if (group.description) {
      const descLines = pdf.splitTextToSize(group.description, pageWidth - 40)
      descLines.forEach(line => {
        pdf.text(line as string, 20, y)
        y += 5
      })
    }
    y += 4

    if (events.length === 0) {
      pdf.text('No upcoming events found for this group.', 20, y)
    } else {
      for (const event of events) {
        // New page if needed
        if (y > pageHeight - 40) {
          pdf.addPage()
          y = 20
        }

        // Event title & date/time
        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(14)
        pdf.text(event.name, 20, y)
        y += 6
        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(11)
        const dateStr = new Date(event.startTime).toLocaleString()
        pdf.text(`Date/Time: ${dateStr}`, 20, y)
        y += 5
        if (event.location) {
          pdf.text(`Location: ${event.location}`, 20, y)
          y += 5
        }
        pdf.text(`Event Type: ${event.eventType?.name || 'General'}`, 20, y)
        y += 5

        // MUSICIANS section (assigned and open)
        pdf.setFont('helvetica', 'bold')
        pdf.text('MUSICIANS:', 20, y)
        y += 5
        pdf.setFont('helvetica', 'normal')
        const accepted = event.assignments.filter(a => a.user && (a as any).status !== 'DECLINED')
        const openSpots = event.assignments.filter(a => !a.user)
        accepted.forEach(a => {
          if (y > pageHeight - 20) { pdf.addPage(); y = 20 }
          pdf.text(`${a.roleName || 'Musician'}: ${a.user?.firstName} ${a.user?.lastName}`, 26, y)
          y += 4
        })
        openSpots.forEach(a => {
          if (y > pageHeight - 20) { pdf.addPage(); y = 20 }
          pdf.text(`${a.roleName || 'Musician'}: (Open)`, 26, y)
          y += 4
        })
        y += 3

        // MUSIC section mirroring calendar description
        if (event.hymns.length > 0) {
          pdf.setFont('helvetica', 'bold')
          pdf.text('MUSIC:', 20, y)
          y += 5
          pdf.setFont('helvetica', 'normal')
          const printedParts = new Set<string>()
          for (const hymn of event.hymns) {
            if (y > pageHeight - 20) { pdf.addPage(); y = 20 }
            const partName = hymn.servicePart?.name || 'General Music'
            if (!printedParts.has(partName)) {
              printedParts.add(partName)
              pdf.text(`${partName}:`, 22, y)
              y += 4
            }
            const title = (hymn.title || '').trim().toLowerCase() === 'new song' ? '' : (hymn.title || '').trim()
            const line = title ? `- ${title}` : '- '
            const lines = pdf.splitTextToSize(line, pageWidth - 40)
            lines.forEach((ln: string) => { pdf.text(ln, 26, y); y += 4 })
          }
          y += 3
        }

        // Divider
        y += 2
        pdf.setDrawColor(220)
        pdf.line(20, y, pageWidth - 20, y)
        y += 6
      }
    }

    const pdfBuffer = Buffer.from(pdf.output('arraybuffer'))
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${group.name.replace(/[^a-z0-9]/gi, '_')}_upcoming.pdf"`
      }
    })
  } catch (error) {
    console.error('Error generating group assignments PDF:', error)
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 })
  }
}



import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import OpenAI from 'openai'
import { writeFile, unlink } from 'fs/promises'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: NextRequest) {
  let tempFilePath: string | null = null
  
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.churchId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only directors and pastors can upload hymnals
    if (!['DIRECTOR', 'ASSOCIATE_DIRECTOR', 'PASTOR'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    console.log('Processing hymnal index PDF with OpenAI Assistant...')

    // Get the PDF file and hymnal info from FormData
    const formData = await request.formData()
    const file = formData.get('pdf') as File
    const hymnalName = formData.get('hymnalName') as string
    const description = formData.get('description') as string

    if (!file) {
      return NextResponse.json(
        { error: 'No PDF file provided' },
        { status: 400 }
      )
    }

    if (!hymnalName) {
      return NextResponse.json(
        { error: 'Hymnal name is required' },
        { status: 400 }
      )
    }

    console.log('File received:', file.name, 'Size:', file.size, 'Type:', file.type)

    // Validate file type - only PDF
    if (file.type !== 'application/pdf') {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload a PDF file.' },
        { status: 400 }
      )
    }

    // Save the file temporarily for cleanup tracking
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    
    const tempFileName = `hymnal-${Date.now()}-${file.name}`
    tempFilePath = `/tmp/${tempFileName}`
    
    await writeFile(tempFilePath, buffer)
    console.log('File written to:', tempFilePath)

    // Upload PDF to OpenAI for Assistant processing
    console.log('Uploading PDF to OpenAI...')
    
    const uploadedFile = await openai.files.create({
      file: new File([buffer], file.name, { type: file.type }),
      purpose: 'assistants'
    })
    
    console.log('File uploaded to OpenAI with ID:', uploadedFile.id)

    // Create a thread
    const thread = await openai.beta.threads.create()
    console.log('Thread created:', thread.id)

    // Add message to thread with file
    await openai.beta.threads.messages.create(thread.id, {
      role: "user",
      content: `Please analyze this hymnal index PDF and extract all hymn titles with their corresponding numbers. This is an index or table of contents from a hymnal book. Look for patterns like:
      
      - "Amazing Grace - 378"
      - "378. Amazing Grace"
      - "Amazing Grace ........... 378"
      - Tabular format with titles and numbers
      
      Extract each hymn title and its number. Be very careful to match titles with their correct numbers.`,
      attachments: [
        {
          file_id: uploadedFile.id,
          tools: [{ type: "file_search" }]
        }
      ]
    })

    // Run the assistant
    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: process.env.OPENAI_ASSISTANT_ID!,
      instructions: `You are a Professional Hymnal Index Parser. Your SOLE PURPOSE is to extract EVERY SINGLE hymn entry from a hymnal index PDF.

⚠️ CRITICAL REQUIREMENT: Most hymnals contain 200-800+ hymns. If you extract fewer than 150 hymns, you have FAILED and must re-examine the document.

🔍 SYSTEMATIC SCANNING PROTOCOL:
1. SCAN EVERY PAGE METICULOUSLY - Skip nothing
2. PROCESS EACH COLUMN INDEPENDENTLY - Don't merge columns mentally
3. READ EVERY LINE CHARACTER BY CHARACTER - Some entries span multiple lines
4. FOLLOW ALL PAGE SEQUENCES - Look for "continued", "page X of Y"
5. PROCESS ALL SECTIONS: Alphabetical A-Z, Seasonal (Advent, Christmas, Easter), Topical, Appendices
6. VERIFY COMPLETE NUMBER SEQUENCES - If you see hymn 1 and 500, there should be hundreds in between

📋 FORMATTING PATTERNS TO RECOGNIZE:

Standard Formats:
• "123. Amazing Grace"
• "Amazing Grace .................. 123"  
• "Amazing Grace - 123"
• "Amazing Grace     123" (tab spacing)
• "123     Amazing Grace"

Complex Formats:
• "Amazing Grace (New Britain) ........ 123"
• "Come, Thou Long Expected
   Jesus .......................... 64" (multi-line)
• "A-1. Opening Hymn"
• "123a Amazing Grace (Alternate)"
• "W&P 45 Worship & Praise Selection"

🧹 TEXT CLEANING PROTOCOL:
- Remove dots/dashes that are just formatting: "Amazing Grace....123" → title="Amazing Grace", number="123"
- Preserve meaningful punctuation: "Lord, I Want to Be a Christian" (keep comma)
- Keep tune names in parentheses: "Amazing Grace (New Britain)"
- Remove line artifacts and column separators
- Normalize excessive whitespace

⚠️ COMMON PITFALLS TO AVOID:
- Mistaking page headers for hymn titles
- Skipping sections that look different
- Missing hymns in footnotes or appendices  
- Ignoring hymns with letter prefixes (A-1, B-12, etc.)
- Stopping at first major section break

🎯 MULTI-PASS VERIFICATION:
Pass 1: Extract all obvious entries
Pass 2: Look for missed sections, unusual formatting
Pass 3: Verify number sequences make logical sense
Pass 4: Final count - must be 150+ hymns minimum

📊 RESPONSE FORMAT (JSON ONLY):
{
  "hymns": [
    {
      "title": "A Mighty Fortress Is Our God",
      "number": "1",
      "pageNumber": null
    }
  ],
  "extractionStats": {
    "totalHymns": 456,
    "pagesProcessed": 12,
    "sectionsFound": ["A-Z Alphabetical", "Christmas", "Easter", "Appendix"],
    "numberRanges": ["1-450", "A-1 to A-12", "W&P 1-25"]
  },
  "notes": "Processed all pages thoroughly. Found typical 2-column layout with seasonal sections. All number sequences verified complete."
}

🚨 FINAL VALIDATION: Count your results. If < 150 hymns, re-examine the ENTIRE document. Most hymnal indexes contain 300-600 entries.`
    })

    // Poll for completion
    console.log('Waiting for assistant response...')
    
    const threadId = thread.id
    const runId = run.id
    
    let runStatus = await openai.beta.threads.runs.retrieve(runId, {
      thread_id: threadId
    })
    
    while (runStatus.status === 'queued' || runStatus.status === 'in_progress') {
      await new Promise(resolve => setTimeout(resolve, 1000))
      runStatus = await openai.beta.threads.runs.retrieve(runId, {
        thread_id: threadId
      })
    }

    if (runStatus.status !== 'completed') {
      throw new Error(`Assistant run failed with status: ${runStatus.status}`)
    }

    // Get the response
    const messages = await openai.beta.threads.messages.list(thread.id)
    const lastMessage = messages.data[0]
    
    if (!lastMessage || !lastMessage.content[0] || lastMessage.content[0].type !== 'text') {
      throw new Error('No valid response from assistant')
    }

    const aiResponse = lastMessage.content[0].text.value
    console.log('Raw AI response:', aiResponse)

    // Cleanup OpenAI resources
    try {
      await openai.files.delete(uploadedFile.id)
      await openai.beta.threads.delete(thread.id)
      console.log('OpenAI resources cleaned up')
    } catch (cleanupError) {
      console.error('Error cleaning up OpenAI resources:', cleanupError)
    }

    // Parse the JSON response
    let parsedResponse
    try {
      let jsonContent = aiResponse
      
      // Extract JSON from markdown code blocks
      const markdownMatch = aiResponse.match(/```json\s*(\{[\s\S]*?\})\s*```/)
      if (markdownMatch) {
        jsonContent = markdownMatch[1]
      } else {
        // Extract the first complete JSON object
        const jsonStart = aiResponse.indexOf('{')
        const jsonEnd = aiResponse.lastIndexOf('}')
        if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
          jsonContent = aiResponse.substring(jsonStart, jsonEnd + 1)
        }
      }
      
      parsedResponse = JSON.parse(jsonContent.trim())
      console.log('Parsed AI response:', parsedResponse)
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError)
      console.error('Original response:', aiResponse)
      throw new Error('Invalid response format from PDF processor')
    }

    if (!parsedResponse.hymns || !Array.isArray(parsedResponse.hymns)) {
      throw new Error('Invalid response structure from PDF processor')
    }

    // Enhanced validation with detailed feedback
    const extractedCount = parsedResponse.hymns.length
    const stats = parsedResponse.extractionStats || {}
    
    console.log('📊 Extraction Analysis:', {
      totalExtracted: extractedCount,
      stats,
      firstFewTitles: parsedResponse.hymns.slice(0, 5).map((h: any) => h.title),
      lastFewTitles: parsedResponse.hymns.slice(-5).map((h: any) => h.title)
    })

    // Quality warnings
    if (extractedCount < 50) {
      console.warn(`🚨 CRITICAL: Only ${extractedCount} hymns extracted. This is severely low for a hymnal index.`)
    } else if (extractedCount < 150) {
      console.warn(`⚠️ Warning: Only ${extractedCount} hymns extracted. Most hymnals have 200-800+ hymns.`)
    } else if (extractedCount < 200) {
      console.warn(`⚠️ Caution: ${extractedCount} hymns extracted. This might be complete for smaller hymnals.`)
    } else {
      console.log(`✅ Good extraction: ${extractedCount} hymns found. This looks more realistic.`)
    }

    // Create the hymnal in the database
    const hymnal = await prisma.hymnal.create({
      data: {
        name: hymnalName,
        description,
        churchId: session.user.churchId,
        uploadedBy: session.user.id
      }
    })

    // Create hymn entries
    const hymns = await Promise.all(
      parsedResponse.hymns.map(async (hymnData: any) => {
        if (!hymnData.title || !hymnData.number) {
          console.warn('Skipping hymn with missing title or number:', hymnData)
          return null
        }

        try {
          return await prisma.hymnalHymn.create({
            data: {
              hymnalId: hymnal.id,
              title: hymnData.title.trim(),
              number: hymnData.number.toString().trim(),
              pageNumber: hymnData.pageNumber ? parseInt(hymnData.pageNumber) : null
            }
          })
        } catch (error) {
          console.error('Error creating hymn entry:', error)
          return null
        }
      })
    )

    const successfulHymns = hymns.filter(h => h !== null)

    console.log(`Successfully processed hymnal: ${successfulHymns.length} hymns created`)
    console.log('AI extraction notes:', parsedResponse.notes)
    
    // Log warning if extraction count seems low
    if (successfulHymns.length < 50) {
      console.warn('⚠️  Low hymn count detected! Only extracted', successfulHymns.length, 'hymns. This may indicate a parsing issue.')
      console.warn('AI notes:', parsedResponse.notes)
    }

    return NextResponse.json({
      hymnal,
      hymnCount: successfulHymns.length,
      notes: parsedResponse.notes,
      extractionStats: stats,
      extractedSample: successfulHymns.slice(0, 5).map(h => ({ title: h?.title, number: h?.number })), // First 5 for debugging
      qualityIndicator: extractedCount >= 200 ? 'excellent' : extractedCount >= 150 ? 'good' : extractedCount >= 50 ? 'low' : 'critical'
    })

  } catch (error) {
    console.error('Hymnal upload error:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error 
          ? `Sorry, we encountered an error processing your hymnal: ${error.message}` 
          : 'Sorry, we encountered an unexpected error processing your hymnal. Please try again.'
      },
      { status: 500 }
    )
  } finally {
    // Clean up temporary file
    if (tempFilePath) {
      try {
        await unlink(tempFilePath)
        console.log('Cleaned up temp file:', tempFilePath)
      } catch (cleanupError) {
        console.error('Error cleaning up temp file:', cleanupError)
      }
    }
  }
}

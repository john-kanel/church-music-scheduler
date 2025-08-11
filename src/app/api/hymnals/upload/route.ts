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
      instructions: `You are a Hymnal Index Parser specialized in reading hymnal indexes and table of contents from PDF files. You must extract ALL hymn entries, even if there are hundreds.

TASK: Extract ALL hymn titles and their corresponding numbers from a hymnal index PDF. This is likely a multi-page index with hundreds of entries.

EXTRACTION RULES:
1. SCAN ALL PAGES thoroughly - hymnals typically have 200-800+ hymns
2. Look for these common patterns:
   - "123. Title of Hymn"
   - "Title of Hymn .................. 123"
   - "Title of Hymn - 123"
   - "Title of Hymn    123" (tabs/spaces)
   - Multi-column layouts (2-3 columns per page)
3. Handle sectioned indexes (alphabetical, topical, seasonal)
4. Extract from ALL sections: Christmas, Easter, General, etc.
5. Numbers can be: 123, A-1, 123a, 123b, etc.
6. Handle multi-line titles that wrap to next line
7. Ignore headers like "HYMNS", "INDEX", page numbers, alphabet dividers
8. Clean titles: remove extra dots, dashes, formatting

COMMON HYMNAL FORMATS:
- Two-column layout with numbers on left, titles on right
- Three-column layout: Number | Title | Page
- Alphabetical sections with subsections
- Seasonal/topical groupings
- Mix of numbered and lettered hymns

CRITICAL: If you only find 8-10 hymns in a hymnal index, you're missing content. 
Most hymnals have 200-800+ hymns. Re-examine the document more thoroughly.

RESPONSE FORMAT:
Return ONLY a JSON object with this exact structure:
{
  "hymns": [
    {
      "title": "A Mighty Fortress Is Our God",
      "number": "1",
      "pageNumber": null
    },
    {
      "title": "Amazing Grace",
      "number": "378", 
      "pageNumber": null
    }
  ],
  "notes": "Found X hymns across Y pages. Format: [describe the layout you found]"
}

IMPORTANT: 
- Extract EVERY hymn entry you can find
- If you find fewer than 50 hymns, re-examine the document
- Clean up titles (remove dots, extra spaces)
- Skip entries missing either title or number
- Be thorough - check every page and column`
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
      extractedSample: successfulHymns.slice(0, 5).map(h => ({ title: h?.title, number: h?.number })) // First 5 for debugging
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

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
      instructions: `You are a Hymnal Index Parser specialized in reading hymnal indexes and table of contents from PDF files.

TASK: Extract hymn titles and their corresponding numbers from a hymnal index PDF.

EXTRACTION RULES:
1. Look for patterns like "Title - Number", "Number. Title", "Title ........ Number"
2. Extract both the hymn title and its number
3. Handle various formatting styles (dots, dashes, tabs, etc.)
4. Be very careful to match each title with its correct number
5. Ignore page headers, footers, and section titles
6. Handle multi-line titles carefully
7. Numbers can be numeric (123) or alphanumeric (A-1, 123a)
8. Clean up titles (remove extra spaces, formatting artifacts)

RESPONSE FORMAT:
Return ONLY a JSON object with this exact structure:
{
  "hymns": [
    {
      "title": "Amazing Grace",
      "number": "378",
      "pageNumber": null
    },
    {
      "title": "How Great Thou Art", 
      "number": "A-45",
      "pageNumber": 125
    }
  ],
  "notes": "Found X hymns in the index. Format appears to be [description of format found]"
}

IMPORTANT: 
- Include pageNumber if you can identify the page where the hymn appears
- Clean up titles to remove formatting artifacts
- Ensure each hymn has both title and number
- If you find a title without a number or vice versa, skip that entry
- Be precise with number extraction - don't guess or approximate`
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

    return NextResponse.json({
      hymnal,
      hymnCount: successfulHymns.length,
      notes: parsedResponse.notes
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

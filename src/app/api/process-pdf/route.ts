import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { writeFile, unlink } from 'fs/promises';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  let tempFilePath: string | null = null;
  
  try {
    console.log('Processing document with OpenAI Assistant...');

    // Get the document file from FormData (could be PDF or Word doc)
    const formData = await request.formData();
    const file = formData.get('document') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No document file provided' },
        { status: 400 }
      );
    }

    console.log('File received:', file.name, 'Size:', file.size, 'Type:', file.type);

    // Validate file type
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload a PDF or Word document (.pdf, .doc, .docx)' },
        { status: 400 }
      );
    }

    // Save the file temporarily for cleanup tracking
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    // Create temp file path for cleanup tracking only
    const tempFileName = `temp-${Date.now()}-${file.name}`;
    tempFilePath = `/tmp/${tempFileName}`;
    
    // Write file to temp location for cleanup tracking
    await writeFile(tempFilePath, buffer);
    console.log('File written to:', tempFilePath);

    // Upload document to OpenAI for Assistant processing
    console.log('Uploading document to OpenAI...');
    
    const uploadedFile = await openai.files.create({
      file: new File([buffer], file.name, { type: file.type }),
      purpose: 'assistants'
    });
    
    console.log('File uploaded to OpenAI with ID:', uploadedFile.id);

    // Create a thread
    const thread = await openai.beta.threads.create();
    console.log('Thread created:', thread.id);

    // Add message to thread with file
    await openai.beta.threads.messages.create(thread.id, {
      role: "user",
      content: `Please analyze this church music document and extract all song titles and their service parts. This document may be a PDF or Word document containing musical scores, sheet music, service bulletins, or worship guides with song information that needs to be identified. Look carefully for song titles that may appear above musical staves, in headers, footers, within the musical notation itself, or in formatted text lists.`,
      attachments: [
        {
          file_id: uploadedFile.id,
          tools: [{ type: "file_search" }]
        }
      ]
    });

    // Run the assistant
    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: process.env.OPENAI_ASSISTANT_ID!,
      instructions: `You are a Church Music Document Analyzer specialized in reading musical scores, sheet music, and church service bulletins from PDF and Word documents.

TASK: Extract song titles and service parts from church music documents (PDF or Word) that may contain:
- Musical notation/scores with titles above staves
- Sheet music with song titles in headers/footers
- Service bulletins with hymn lists
- Liturgical music with Latin or English titles
- Hymn book pages with numbered hymns
- Contemporary worship song sheets
- Instrumental pieces with descriptive titles

EXTRACTION RULES:
1. Look carefully for song titles that appear above musical staves
2. Check headers, footers, and margins for song titles
3. Extract titles from sheet music even if embedded in musical notation
4. Include hymn numbers if present (e.g., "Amazing Grace #378")
5. Identify service parts from context and placement
6. Read both English and Latin titles
7. Don't include composer names in song titles
8. Mark instrumental pieces appropriately

SERVICE PART ASSIGNMENT:
Based on musical context, liturgical placement, and document structure:
- Prelude, Processional, Opening Hymn, Entrance Song
- Kyrie, Gloria, Alleluia, Gospel Acclamation
- Offertory, Offertory Hymn, Preparation Song
- Sanctus, Memorial Acclamation, Great Amen
- Communion, Communion Hymn, Communion Song
- Recessional, Closing Hymn, Postlude
- Psalm, Responsorial Psalm, Anthem
- Special Music, Solo, Meditation

RESPONSE FORMAT:
Return ONLY a JSON object with this exact structure:
{
  "songs": [
    {
      "servicePartName": "Opening Hymn",
      "songTitle": "Amazing Grace #378",
      "notes": ""
    }
  ],
  "notes": "Brief explanation of what musical content was found"
}

IMPORTANT: Look closely at the actual content of the PDF. If it contains musical scores or sheet music, the song titles are typically displayed prominently above the musical staves or in the document headers. Don't just say you can't read it - analyze the visual content carefully for any text that indicates song titles.`
    });

    // Poll for completion
    console.log('Waiting for assistant response...');
    console.log('Thread ID:', thread.id);
    console.log('Run ID:', run.id);
    
    if (!thread.id || !run.id) {
      throw new Error(`Missing IDs - Thread: ${thread.id}, Run: ${run.id}`);
    }
    
    // Store IDs in separate variables to avoid any scope issues
    const threadId = thread.id;
    const runId = run.id;
    
    // Debug values before API call
    console.log('About to call retrieve with threadId:', threadId, 'runId:', runId);
    console.log('Types:', typeof threadId, typeof runId);
    
    // Use the correct OpenAI SDK v5.8.2 method signature
    let runStatus = await openai.beta.threads.runs.retrieve(runId, {
      thread_id: threadId
    });
    
    while (runStatus.status === 'queued' || runStatus.status === 'in_progress') {
      await new Promise(resolve => setTimeout(resolve, 1000));
      runStatus = await openai.beta.threads.runs.retrieve(runId, {
        thread_id: threadId
      });
    }

    if (runStatus.status !== 'completed') {
      throw new Error(`Assistant run failed with status: ${runStatus.status}`);
    }

    // Get the response
    const messages = await openai.beta.threads.messages.list(thread.id);
    const lastMessage = messages.data[0];
    
    if (!lastMessage || !lastMessage.content[0] || lastMessage.content[0].type !== 'text') {
      throw new Error('No valid response from assistant');
    }

    const aiResponse = lastMessage.content[0].text.value;
    console.log('Raw AI response:', aiResponse);

    // Cleanup OpenAI resources
    try {
      await openai.files.delete(uploadedFile.id);
      await openai.beta.threads.delete(thread.id);
      console.log('OpenAI resources cleaned up');
    } catch (cleanupError) {
      console.error('Error cleaning up OpenAI resources:', cleanupError);
    }

    // Parse the JSON response
    let parsedResponse;
    try {
      // Extract JSON from the response - look for content between { and }
      let jsonContent = aiResponse;
      
      // First try to find JSON in markdown code blocks
      const markdownMatch = aiResponse.match(/```json\s*(\{[\s\S]*?\})\s*```/);
      if (markdownMatch) {
        jsonContent = markdownMatch[1];
      } else {
        // If no markdown, try to extract the first complete JSON object
        const jsonStart = aiResponse.indexOf('{');
        const jsonEnd = aiResponse.lastIndexOf('}');
        if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
          jsonContent = aiResponse.substring(jsonStart, jsonEnd + 1);
        }
      }
      
      parsedResponse = JSON.parse(jsonContent.trim());
      console.log('Parsed AI response:', parsedResponse);
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      console.error('Original response:', aiResponse);
      throw new Error('Invalid response format from document processor');
    }

    if (!parsedResponse.songs || !Array.isArray(parsedResponse.songs)) {
      throw new Error('Invalid response structure from document processor');
    }

    console.log('Successfully processed PDF, returning suggestions:', parsedResponse.songs.length, 'songs');

    return NextResponse.json({
      suggestions: parsedResponse.songs,
      notes: parsedResponse.notes
    });

  } catch (error) {
    console.error('AI processing error:', error);
    
    return NextResponse.json(
      { 
        error: error instanceof Error 
          ? `Sorry, we encountered an error processing your document: ${error.message}` 
          : 'Sorry, we encountered an unexpected error processing your document. Please try again or add songs manually.'
      },
      { status: 500 }
    );
  } finally {
    // Clean up temporary file
    if (tempFilePath) {
      try {
        await unlink(tempFilePath);
        console.log('Cleaned up temp file:', tempFilePath);
      } catch (cleanupError) {
        console.error('Error cleaning up temp file:', cleanupError);
      }
    }
  }
} 
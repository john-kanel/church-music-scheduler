# PDF Processing Setup Guide

## Overview
The PDF processing feature allows directors to upload service bulletins and automatically extract music information using AI.

## Required Environment Variables

Add these to your `.env.local` file:

```env
# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_ASSISTANT_ID=your_assistant_id_here
```

## OpenAI Assistant Setup

1. **Create OpenAI Assistant:**
   - Go to [OpenAI Platform](https://platform.openai.com/)
   - Navigate to Assistants > Create Assistant
   - Use the prompt from this document (see below)
   - Enable "File search" capability
   - Save and copy the Assistant ID

2. **Assistant System Instructions:**
```
You are a Church Music PDF Analyzer. Extract hymn and song information from church service bulletins, worship guides, and music sheets.

TASK: Analyze uploaded PDFs and extract song titles with their corresponding service parts.

RESPONSE FORMAT: Always respond with valid JSON:
{
  "songs": [
    {
      "servicePartName": "Opening Hymn",
      "songTitle": "Amazing Grace #378",
      "notes": ""
    }
  ],
  "notes": "Any general observations about the document"
}

EXTRACTION RULES:
1. Extract only song titles - ignore verse/stanza specifications
2. Keep song titles in original language
3. Include hymn numbers at the end of the title when present (e.g., "Holy God We Praise Thy Name #536")
4. Use the most accurate format available (contemporary vs traditional)
5. For songs spanning multiple service parts, assign to the most logical one
6. If service part is unclear, use "Custom" as servicePartName
7. If song title is unclear, include [unclear] in the title

COMMON SERVICE PARTS:
- Prelude, Processional, Opening Hymn, Entrance Antiphon
- Kyrie, Gloria, Responsorial Psalm, Gospel Acclamation, Alleluia  
- Offertory Hymn, Presentation of Gifts
- Sanctus, Memorial Acclamation, Great Amen, Lord's Prayer
- Lamb of God, Communion Hymn, Communion Antiphon
- Recessional Hymn, Postlude, Closing Song

SPECIAL CASES:
- Multiple songs for same service part: Create separate entries
- Instrumental pieces: Include title like "Prelude (Instrumental)"
- Composer info: Add to notes field if clearly stated
- Multiple services in one PDF: Return error message "This PDF contains multiple services. Please upload a PDF for a single service only."

Focus on extracting actionable music information for church music directors.
```

## File Storage

PDFs are temporarily stored locally during processing and automatically cleaned up after AI analysis.

## Auto-Deletion System

The system includes a weekly cron job that will automatically delete PDF files older than 18 months from events.

### Cron Job Setup

1. **Add to Railway Environment Variables:**
```env
CRON_SECRET=your_secure_random_string_here
```

2. **Set up the weekly cron job in Railway:**
   - URL: `https://your-app.railway.app/api/cron/cleanup-old-pdfs`
   - Method: GET
   - Schedule: `0 2 * * 0` (Every Sunday at 2 AM)
   - Headers: `Authorization: Bearer your_cron_secret_here`

3. **Manual Testing:**
   You can test the cron job manually by making a POST request to the same endpoint with the authorization header.

## Testing

To test the PDF processing:

1. Ensure environment variables are set
2. Create an OpenAI Assistant with the provided instructions
3. Upload a PDF through the "Auto Populate Service Parts" button in event creation
4. Review and edit AI suggestions before accepting

## Error Handling

- File size limit: 10MB
- File type: PDF only
- Processing timeout: 30 seconds
- Fallback: Manual entry if AI processing fails

## Cost Considerations

- OpenAI API charges apply for each PDF processed
- File search capability may incur additional costs
- Monitor usage through OpenAI dashboard 
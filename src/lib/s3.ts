import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

// Initialize S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
})

const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME!

// File upload function
export async function uploadFileToS3(
  file: Buffer | Uint8Array | string,
  fileName: string,
  contentType: string,
  folder: string = 'uploads'
): Promise<{ success: boolean; key: string; url?: string; error?: string }> {
  try {
    const key = `${folder}/${Date.now()}-${fileName}`
    
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: file,
      ContentType: contentType,
      // Add metadata for better organization
      Metadata: {
        uploadedAt: new Date().toISOString(),
        originalName: fileName,
      },
    })

    await s3Client.send(command)

    return {
      success: true,
      key,
      url: `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`,
    }
  } catch (error) {
    console.error('Error uploading to S3:', error)
    return {
      success: false,
      key: '',
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    }
  }
}

// Generate presigned URL for secure file access
export async function getPresignedUrl(
  key: string,
  expiresIn: number = 3600 // 1 hour default
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    })

    const url = await getSignedUrl(s3Client, command, { expiresIn })

    return {
      success: true,
      url,
    }
  } catch (error) {
    console.error('Error generating presigned URL:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    }
  }
}

// Delete file from S3
export async function deleteFileFromS3(key: string): Promise<{ success: boolean; error?: string }> {
  try {
    const command = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    })

    await s3Client.send(command)

    return {
      success: true,
    }
  } catch (error) {
    console.error('Error deleting from S3:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    }
  }
}

// Check if file exists in S3
export async function checkFileExists(key: string): Promise<{ exists: boolean; error?: string }> {
  try {
    const command = new HeadObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    })

    await s3Client.send(command)

    return {
      exists: true,
    }
  } catch (error: any) {
    if (error.name === 'NotFound') {
      return {
        exists: false,
      }
    }
    
    console.error('Error checking file existence:', error)
    return {
      exists: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    }
  }
}

// Helper function to get file extension and content type
export function getContentType(fileName: string): string {
  const extension = fileName.split('.').pop()?.toLowerCase()
  
  const contentTypes: Record<string, string> = {
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    txt: 'text/plain',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    mp4: 'video/mp4',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
  }

  return contentTypes[extension || ''] || 'application/octet-stream'
}

// Helper function to validate file size
export function validateFileSize(fileSize: number, maxSizeMB: number = 10): boolean {
  const maxSizeBytes = maxSizeMB * 1024 * 1024
  return fileSize <= maxSizeBytes
}

// Helper function to validate file type
export function validateFileType(fileName: string, allowedTypes: string[]): boolean {
  const extension = fileName.split('.').pop()?.toLowerCase()
  return extension ? allowedTypes.includes(extension) : false
} 
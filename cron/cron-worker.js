#!/usr/bin/env node

const https = require('https');

// Configuration
const CRON_SECRET = process.env.CRON_SECRET;
const APP_URL = process.env.APP_URL || process.env.RAILWAY_STATIC_URL;

if (!CRON_SECRET) {
  console.error('CRON_SECRET environment variable is required');
  process.exit(1);
}

if (!APP_URL) {
  console.error('APP_URL or RAILWAY_STATIC_URL environment variable is required');
  process.exit(1);
}

// Function to make HTTP POST requests
function makeRequest(path) {
  return new Promise((resolve, reject) => {
    const url = `${APP_URL}${path}`;
    console.log(`Making request to: ${url}`);
    
    const options = {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CRON_SECRET}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(url, options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log(`Response from ${path}:`, res.statusCode, data);
        resolve({ statusCode: res.statusCode, data });
      });
    });

    req.on('error', (error) => {
      console.error(`Error calling ${path}:`, error.message);
      reject(error);
    });

    req.end();
  });
}

// Main execution
async function runCronJobs() {
  const jobType = process.argv[2];
  
  console.log(`Starting cron job: ${jobType}`);
  console.log(`Target URL: ${APP_URL}`);
  
  try {
    switch (jobType) {
      case 'notifications':
        await makeRequest('/api/cron/send-notifications');
        break;
        
      case 'cleanup-pdfs':
        await makeRequest('/api/cron/cleanup-old-pdfs');
        break;
        
      case 'cleanup-tokens':
        await makeRequest('/api/cron/cleanup-reset-tokens');
        break;
        
      case 'send-scheduled-emails':
        await makeRequest('/api/cron/send-scheduled-emails');
        break;
        
      case 'trial-reminders':
        await makeRequest('/api/cron/trial-reminders');
        break;
      
      case 'sync-google-calendar':
        await makeRequest('/api/google-calendar/sync');
        break;
        
      default:
        console.error('Invalid job type. Use: notifications, cleanup-pdfs, cleanup-tokens, send-scheduled-emails, trial-reminders, or sync-google-calendar');
        process.exit(1);
    }
    
    console.log(`Cron job ${jobType} completed successfully`);
  } catch (error) {
    console.error(`Cron job ${jobType} failed:`, error.message);
    process.exit(1);
  }
}

runCronJobs(); 
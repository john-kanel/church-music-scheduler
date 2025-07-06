// Simple email-safe logo that matches the website header
export function getEmailLogoHtml() {
  return `
    <div style="text-align: center; padding: 20px 0; margin: 0 auto; width: 100%;">
      <div style="display: inline-block; vertical-align: middle;">
        <table cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto;">
          <tr>
            <td style="vertical-align: middle; text-align: center;">
              <img
                src="https://church-music-scheduler-production.up.railway.app/logo.png"
                alt="Church Music Scheduler Logo"
                style="width: 48px; height: 48px; object-fit: contain; display: block; margin: 0 auto;"
              />
            </td>
            <td style="vertical-align: middle; padding-left: 12px;">
              <span style="font-family: 'Montserrat', 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 24px; font-weight: bold; color: #111827; margin: 0; display: inline-block;">
                Church Music Scheduler
              </span>
            </td>
          </tr>
        </table>
      </div>
    </div>
  `;
}

// Alternative version with fallback for when images don't load
export function getEmailLogoHtmlWithFallback() {
  return `
    <div style="text-align: center; padding: 20px 0; margin: 0 auto; width: 100%;">
      <div style="display: inline-block; vertical-align: middle;">
        <table cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto;">
          <tr>
            <td style="vertical-align: middle; text-align: center;">
              <img
                src="https://church-music-scheduler-production.up.railway.app/logo.png"
                alt="Church Music Scheduler Logo"
                style="width: 48px; height: 48px; object-fit: contain; display: block; margin: 0 auto;"
                onerror="this.style.display='none';"
              />
            </td>
            <td style="vertical-align: middle; padding-left: 12px;">
              <span style="font-family: 'Montserrat', 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 24px; font-weight: bold; color: #111827; margin: 0; display: inline-block;">
                Church Music Scheduler
              </span>
            </td>
          </tr>
        </table>
      </div>
    </div>
  `;
} 
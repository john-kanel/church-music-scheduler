// Returns the logo as a base64 <img> tag for use in all emails
export function getEmailLogoHtml() {
  return `
    <img
      src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAACDQAAAK8CAYAAAAax30yAAAACXBIWXMAABnWAAAZ1gEY0crtAAAE5WlUWHRYTUw6Y29tLmFkb2JlLnhtcAAAAAAAPD94cGFja2V0IGJlZ2luPSfvu78nIGlkPSdXNU0wTXBDZWhpSHpyZVN6TlRjemtjOWQnPz4KPHg6eG1wbWV0YSB4bWxuczp4PSdhZG9iZT... (TRUNCATED FOR BREVITY - use your full base64 string here) ..."
      alt="Church Music Scheduler Logo"
      style="display:block;width:100%;max-width:600px;margin:0 auto;"
    />
    <div style="text-align:center;font-family:Montserrat,sans-serif;font-size:18px;color:#800000;margin-top:8px;">
      ORGANIZE • SCHEDULE • WORSHIP
    </div>
  `;
} 
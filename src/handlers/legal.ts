// Legal Pages - Privacy Policy and Terms of Service

const baseStyles = `
  <style>
    :root {
      --bg-primary: #0a0a0a;
      --bg-secondary: #111111;
      --border: #262626;
      --text-primary: #fafafa;
      --text-secondary: #a1a1aa;
      --text-tertiary: #71717a;
      --accent: #f97316;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background: var(--bg-primary);
      color: var(--text-primary);
      line-height: 1.7;
    }
    nav {
      padding: 16px 24px;
      background: rgba(10, 10, 10, 0.9);
      backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--border);
      position: sticky;
      top: 0;
      z-index: 100;
    }
    .nav-inner {
      max-width: 800px;
      margin: 0 auto;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .logo {
      display: flex;
      align-items: center;
      gap: 10px;
      font-weight: 600;
      font-size: 18px;
      color: var(--text-primary);
      text-decoration: none;
    }
    .logo svg { width: 24px; height: 24px; color: var(--accent); }
    .content {
      max-width: 800px;
      margin: 0 auto;
      padding: 64px 24px;
    }
    h1 {
      font-size: 36px;
      font-weight: 700;
      margin-bottom: 8px;
    }
    .updated {
      color: var(--text-tertiary);
      font-size: 14px;
      margin-bottom: 48px;
    }
    h2 {
      font-size: 20px;
      font-weight: 600;
      margin-top: 40px;
      margin-bottom: 16px;
      color: var(--text-primary);
    }
    p, ul {
      color: var(--text-secondary);
      margin-bottom: 16px;
    }
    ul { padding-left: 24px; }
    li { margin-bottom: 8px; }
    a { color: var(--accent); }
    .highlight {
      background: var(--bg-secondary);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 16px 20px;
      margin: 24px 0;
    }
    footer {
      padding: 32px 24px;
      border-top: 1px solid var(--border);
      text-align: center;
      color: var(--text-tertiary);
      font-size: 14px;
    }
    footer a { color: var(--text-secondary); text-decoration: none; margin: 0 16px; }
    footer a:hover { color: var(--text-primary); }
  </style>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23f97316' stroke-width='2'><rect x='3' y='4' width='18' height='18' rx='2'/><line x1='16' y1='2' x2='16' y2='6'/><line x1='8' y1='2' x2='8' y2='6'/><line x1='3' y1='10' x2='21' y2='10'/></svg>">
`;

const navBar = `
  <nav>
    <div class="nav-inner">
      <a href="/" class="logo">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="4" width="18" height="18" rx="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        InboxBuddy
      </a>
    </div>
  </nav>
`;

const footer = `
  <footer>
    <a href="/">Home</a>
    <a href="/privacy">Privacy</a>
    <a href="/terms">Terms</a>
  </footer>
`;

export function renderPrivacyPolicy(): Response {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Privacy Policy - InboxBuddy</title>
  <meta name="description" content="InboxBuddy Privacy Policy - How we handle your data">
  ${baseStyles}
</head>
<body>
  ${navBar}
  <div class="content">
    <h1>Privacy Policy</h1>
    <p class="updated">Last updated: January 2025</p>

    <p>InboxBuddy ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, and safeguard your information when you use our AI scheduling assistant service.</p>

    <h2>Information We Collect</h2>
    <p>When you use InboxBuddy, we collect:</p>
    <ul>
      <li><strong>Account Information:</strong> Your email address and name from Google OAuth</li>
      <li><strong>Calendar Data:</strong> Access to your Google Calendar to check availability and create events</li>
      <li><strong>Email Content:</strong> Email threads where InboxBuddy is CC'd, to understand scheduling requests</li>
    </ul>

    <h2>How We Use Your Information</h2>
    <p>We use your information solely to:</p>
    <ul>
      <li>Check your calendar availability</li>
      <li>Propose meeting times to email participants</li>
      <li>Create calendar events when meetings are confirmed</li>
      <li>Send scheduling-related emails on your behalf</li>
    </ul>

    <div class="highlight">
      <strong>We do NOT:</strong>
      <ul>
        <li>Sell your data to third parties</li>
        <li>Use your emails for advertising</li>
        <li>Train AI models on your personal data</li>
        <li>Store email content longer than necessary for scheduling</li>
      </ul>
    </div>

    <h2>Data Storage & Security</h2>
    <p>Your data is processed on Cloudflare's edge network with the following security measures:</p>
    <ul>
      <li>OAuth tokens are encrypted using AES-256-GCM before storage</li>
      <li>Session tokens are cryptographically signed (HMAC-SHA256)</li>
      <li>All data transmission uses HTTPS/TLS encryption</li>
      <li>We use Cloudflare's secure infrastructure (D1, KV, Durable Objects)</li>
    </ul>

    <h2>Third-Party Services</h2>
    <p>InboxBuddy integrates with:</p>
    <ul>
      <li><strong>Google:</strong> For authentication, calendar access, and email (<a href="https://policies.google.com/privacy" target="_blank">Google Privacy Policy</a>)</li>
      <li><strong>Anthropic Claude:</strong> For AI-powered email understanding (<a href="https://www.anthropic.com/privacy" target="_blank">Anthropic Privacy Policy</a>)</li>
      <li><strong>Cloudflare:</strong> For hosting and infrastructure (<a href="https://www.cloudflare.com/privacypolicy/" target="_blank">Cloudflare Privacy Policy</a>)</li>
    </ul>

    <h2>Data Retention</h2>
    <p>We retain your data as follows:</p>
    <ul>
      <li><strong>Account data:</strong> Until you delete your account</li>
      <li><strong>Conversation metadata:</strong> 90 days after last activity</li>
      <li><strong>OAuth tokens:</strong> Until revoked or expired</li>
    </ul>

    <h2>Your Rights</h2>
    <p>You have the right to:</p>
    <ul>
      <li>Access your personal data</li>
      <li>Delete your account and associated data</li>
      <li>Revoke Google Calendar/Gmail access at any time via <a href="https://myaccount.google.com/permissions" target="_blank">Google Account Settings</a></li>
      <li>Export your data upon request</li>
    </ul>

    <h2>Contact Us</h2>
    <p>For privacy-related questions or requests, contact us at <a href="https://x.com/whoiskatrin" target="_blank">@whoiskatrin</a> on X (Twitter).</p>

    <h2>Changes to This Policy</h2>
    <p>We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last updated" date.</p>
  </div>
  ${footer}
</body>
</html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

export function renderTermsOfService(): Response {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Terms of Service - InboxBuddy</title>
  <meta name="description" content="InboxBuddy Terms of Service">
  ${baseStyles}
</head>
<body>
  ${navBar}
  <div class="content">
    <h1>Terms of Service</h1>
    <p class="updated">Last updated: January 2025</p>

    <p>Welcome to InboxBuddy. By using our service, you agree to these Terms of Service ("Terms"). Please read them carefully.</p>

    <h2>1. Description of Service</h2>
    <p>InboxBuddy is an AI-powered scheduling assistant that:</p>
    <ul>
      <li>Monitors email threads where it's CC'd</li>
      <li>Checks your Google Calendar for availability</li>
      <li>Proposes meeting times to participants</li>
      <li>Creates calendar events when meetings are confirmed</li>
    </ul>

    <h2>2. Account Requirements</h2>
    <p>To use InboxBuddy, you must:</p>
    <ul>
      <li>Have a valid Google account</li>
      <li>Grant access to Google Calendar and Gmail</li>
      <li>Be at least 18 years old or have parental consent</li>
      <li>Provide accurate account information</li>
    </ul>

    <h2>3. Acceptable Use</h2>
    <p>You agree NOT to use InboxBuddy to:</p>
    <ul>
      <li>Send spam or unsolicited emails</li>
      <li>Harass, abuse, or harm others</li>
      <li>Violate any applicable laws or regulations</li>
      <li>Interfere with or disrupt the service</li>
      <li>Attempt to gain unauthorized access to our systems</li>
    </ul>

    <h2>4. Service Availability</h2>
    <div class="highlight">
      <p>InboxBuddy is provided "as is" and "as available". We do not guarantee:</p>
      <ul>
        <li>100% uptime or availability</li>
        <li>That the service will be error-free</li>
        <li>That all scheduling requests will be processed correctly</li>
      </ul>
    </div>

    <h2>5. Limitation of Liability</h2>
    <p>To the maximum extent permitted by law, InboxBuddy and its creators shall not be liable for:</p>
    <ul>
      <li>Missed meetings due to service errors</li>
      <li>Incorrect calendar entries</li>
      <li>Any indirect, incidental, or consequential damages</li>
      <li>Loss of data or business opportunities</li>
    </ul>

    <h2>6. Intellectual Property</h2>
    <p>The InboxBuddy service, including its design, code, and branding, is owned by us. You retain ownership of your data and content.</p>

    <h2>7. Account Termination</h2>
    <p>We reserve the right to suspend or terminate your account if you:</p>
    <ul>
      <li>Violate these Terms</li>
      <li>Abuse the service</li>
      <li>Engage in fraudulent activity</li>
    </ul>
    <p>You may delete your account at any time through the dashboard.</p>

    <h2>8. Changes to Terms</h2>
    <p>We may modify these Terms at any time. Continued use of InboxBuddy after changes constitutes acceptance of the new Terms.</p>

    <h2>9. Governing Law</h2>
    <p>These Terms are governed by the laws of the jurisdiction where InboxBuddy operates, without regard to conflict of law principles.</p>

    <h2>10. Contact</h2>
    <p>For questions about these Terms, contact us at <a href="https://x.com/whoiskatrin" target="_blank">@whoiskatrin</a> on X (Twitter).</p>
  </div>
  ${footer}
</body>
</html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

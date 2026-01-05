# InboxBuddy - AI-Powered Scheduling Assistant

**"Just CC meetme@inboxbuddy.dev - your AI schedules the meeting."**

InboxBuddy is a personal AI-powered scheduling assistant built on Cloudflare's Agents SDK. It eliminates the endless back-and-forth of meeting coordination by integrating directly into your existing email workflow.

## Features

- **Email-First Workflow**: Simply CC `meetme@inboxbuddy.dev` in any email thread
- **AI-Powered Understanding**: Uses Claude to parse conversations and extract scheduling intent
- **Smart Time Detection**: Understands requests like "Friday at 10am" and books directly if available
- **Calendar Integration**: Checks Google Calendar for availability in real-time
- **Smart Proposals**: Suggests time slots that work with your schedule
- **Automatic Booking**: Creates calendar events with all attendees once confirmed
- **Real-time Dashboard**: View and manage conversations via WebSocket-powered UI
- **Cancellation & Rescheduling**: Handle meeting changes via email replies

## Architecture

Built entirely on Cloudflare's edge platform using the **Agents SDK**:

| Component | Technology | Purpose |
|-----------|------------|---------|
| **SchedulingAgent** | Agents SDK | Handles email conversations, calendar checks, booking |
| **DashboardAgent** | Agents SDK | Real-time WebSocket updates for the dashboard |
| **Email Workers** | Email Routing | Inbound email handling |
| **D1 Database** | D1 | Store conversations, users, settings |
| **KV Storage** | KV | Encrypted OAuth token storage |
| **AI** | Claude via AI Gateway | Natural language understanding |
| **Dashboard** | React + Vite | User interface |

## Setup Instructions

### Prerequisites

1. **Cloudflare account** with:
   - Domain configured with Cloudflare DNS
   - Email Routing enabled
   - Workers Paid plan (for Durable Objects)

2. **Google Cloud project** with:
   - Google Calendar API enabled
   - OAuth 2.0 credentials (Web application)

3. **Anthropic API key**

### Step 1: Clone and Install

```bash
git clone <repo>
cd meetme
npm install
cd dashboard && npm install && cd ..
```

### Step 2: Create Cloudflare Resources

```bash
# Login to Cloudflare
npx wrangler login

# Create D1 database
npx wrangler d1 create meetme-db
# Copy the database_id to wrangler.jsonc

# Create KV namespace for tokens
npx wrangler kv namespace create TOKENS
# Copy the id to wrangler.jsonc

# Run database migrations
npx wrangler d1 execute meetme-db --file=./migrations/0001_initial_schema.sql
npx wrangler d1 execute meetme-db --file=./migrations/0002_add_include_weekends.sql
npx wrangler d1 execute meetme-db --file=./migrations/0003_add_meeting_settings.sql
```

### Step 3: Configure Secrets

```bash
npx wrangler secret put ANTHROPIC_API_KEY
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
npx wrangler secret put ENCRYPTION_KEY      # Random 32+ char string
npx wrangler secret put SESSION_SECRET      # Random 32+ char string for HMAC signing
```

### Step 4: Configure Email Routing

1. Go to Cloudflare Dashboard > Email > Email Routing
2. Enable Email Routing for your domain
3. Create a custom address: `meetme@yourdomain.com`
4. Route it to: "Send to Worker" and select `meetme`

### Step 5: Configure Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create/select a project
3. Enable Google Calendar API
4. Configure OAuth consent screen (add scopes for calendar and profile)
5. Create OAuth 2.0 credentials (Web application)
6. Add authorized redirect URI: `https://yourdomain.com/auth/callback`
7. Add authorized JavaScript origin: `https://yourdomain.com`

### Step 6: Build and Deploy

```bash
# Build dashboard
cd dashboard && npm run build && cd ..

# Deploy to Cloudflare
npm run deploy
```

### Step 7: First Login

1. Visit `https://yourdomain.com`
2. Click "Continue with Google"
3. Grant calendar permissions
4. Start scheduling!

## Usage

### Basic Flow

1. **Start**: CC `meetme@yourdomain.com` in any email about scheduling
2. **Propose**: InboxBuddy checks your calendar and proposes available times
3. **Confirm**: Reply with your preference ("Option 2" or "Tuesday works")
4. **Done**: Meeting is booked with calendar invites sent

### Smart Booking

If you specify an exact time and it's available, InboxBuddy books it directly:

```
To: colleague@example.com
Cc: meetme@inboxbuddy.dev
Subject: Coffee chat

Hey! Let's grab coffee Wednesday at 10am?
```

If Wednesday 10am is free, InboxBuddy books it immediately without asking for confirmation.

### Rescheduling & Cancellation

Reply to any scheduled meeting thread:
- "Can we reschedule?" - InboxBuddy offers new times
- "Please cancel" - InboxBuddy cancels the meeting

## Project Structure

```
meetme/
├── src/
│   ├── index.ts                 # Main worker entry point
│   ├── types/                   # TypeScript definitions
│   ├── agents/
│   │   ├── scheduling-agent.ts  # Email & calendar handling (Agents SDK)
│   │   ├── dashboard-agent.ts   # Real-time dashboard (Agents SDK)
│   │   └── conversation.ts      # Deprecated stub (migration compatibility)
│   ├── handlers/
│   │   ├── email.ts             # Inbound email processing
│   │   ├── landing.ts           # Landing page HTML
│   │   └── legal.ts             # Privacy & Terms pages
│   ├── services/
│   │   ├── ai.ts                # Claude integration
│   │   ├── calendar.ts          # Google Calendar API
│   │   └── email.ts             # Outbound email
│   └── utils/
│       └── helpers.ts           # Time slots, formatting
├── dashboard/                   # React dashboard app
│   ├── src/
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── components/
│   └── vite.config.ts
├── public/                      # Static assets (built dashboard)
├── migrations/
│   ├── 0001_initial_schema.sql  # Users, conversations, email_log
│   ├── 0002_add_include_weekends.sql  # Weekend availability setting
│   └── 0003_add_meeting_settings.sql  # Duration & title prefix
└── wrangler.jsonc
```

## API Endpoints

### Authentication
- `GET /auth/config` - Get Google Client ID for OAuth
- `POST /auth/google/verify` - Exchange auth code for session

### Dashboard API
- `GET /api/me` - Current user info
- `GET /agents/dashboard-agent/:email` - WebSocket connection for real-time updates

### Dashboard RPC Methods (via WebSocket)
- `refresh()` - Refresh conversations list
- `getConversation(id)` - Get conversation details
- `deleteConversation(id)` - Delete a conversation
- `getSettings()` - Get user settings
- `updateSettings(settings)` - Update settings

## Configuration

### User Settings (via Dashboard)

- **Timezone**: Your local timezone (supports major US/EU/Asia timezones)
- **Working Hours**: Start and end time (24-hour format)
- **Buffer Time**: Minutes between meetings (0, 5, 10, 15, or 30 min)
- **Default Duration**: Default meeting length (15, 30, 45, or 60 min)
- **Meeting Title Prefix**: Optional prefix for calendar event titles (e.g., "[MeetMe]")
- **Include Weekends**: Toggle weekend availability on/off

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `BOT_EMAIL_PREFIX` | Email prefix | `meetme` |
| `DEFAULT_MEETING_DURATION_MINUTES` | Default meeting length | `30` |
| `WORKING_HOURS_START` | Working day start (24h) | `9` |
| `WORKING_HOURS_END` | Working day end (24h) | `17` |
| `TIMEZONE` | Default timezone | `Europe/Berlin` |

## Local Development

```bash
# Start development server
npm run dev

# In another terminal, start dashboard dev server (optional)
cd dashboard && npm run dev
```

Access at `http://localhost:8787`

## Security

- **HMAC-signed session tokens** - Sessions cannot be forged
- **Encrypted OAuth tokens** - Stored in KV with AES encryption
- **CORS restricted** - Only same-origin requests allowed
- **SameSite cookies** - Protection against CSRF
- **No email content stored** - Processed in-memory only

## Troubleshooting

### Email not received
- Verify Email Routing is enabled in Cloudflare Dashboard
- Check the email address is routed to the Worker
- View logs: `npx wrangler tail`

### OAuth errors
- Verify redirect URI matches exactly in Google Cloud Console
- Ensure JavaScript origin is added
- Check secrets are set: `npx wrangler secret list`

### Wrong timezone in emails
- Update timezone in Dashboard settings
- Default falls back to `TIMEZONE` env variable

## License

MIT

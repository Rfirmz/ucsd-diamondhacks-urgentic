# Urgentic — Full Build Prompt for Cursor

## Project Overview

Build **Urgentic**, a mobile-first web app for discreet safety communication. When a user feels unsafe or is in an awkward situation, they tap a button, and the app triggers an AI voice agent (via VAPI) to call their trusted contact, deliver an alert, capture the contact's response, and relay it back to the user.

## Tech Stack

- **Framework:** Next.js 14+ (App Router, TypeScript)
- **Styling:** Tailwind CSS + shadcn/ui
- **Database:** Supabase (PostgreSQL)
- **Voice Agent:** VAPI (outbound phone calls)
- **Deployment:** Vercel (later)

## Environment Variables

Create `.env.local` with:

```
VAPI_API_KEY=<vapi api key>
VAPI_PHONE_NUMBER_ID=<vapi phone number id>
VAPI_UNSAFE_ASSISTANT_ID=<assistant id for the "unsafe" agent>
VAPI_AWKWARD_ASSISTANT_ID=<assistant id for the "awkward situation" agent>
NEXT_PUBLIC_SUPABASE_URL=<supabase project url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<supabase anon key>
SUPABASE_SERVICE_ROLE_KEY=<supabase service role key>
APP_URL=http://localhost:3000
```

## Database Schema (Supabase)

Run this SQL in the Supabase SQL editor:

```sql
CREATE TABLE contacts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  contact_phone TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE alerts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL,        -- "unsafe" or "awkward"
  location TEXT,
  status TEXT DEFAULT 'pending',   -- pending | calling | responded | failed
  contact_response TEXT,
  contact_location TEXT,
  vapi_call_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on contacts" ON contacts FOR ALL USING (true);
CREATE POLICY "Allow all on alerts" ON alerts FOR ALL USING (true);
```

## App Structure

```
app/
├── layout.tsx                    # Root layout, mobile-first viewport
├── page.tsx                      # Home trigger screen
├── setup/
│   └── page.tsx                  # Contact setup screen
├── alert/
│   └── [id]/
│       └── page.tsx              # Alert status / response screen
├── api/
│   ├── contacts/
│   │   └── route.ts              # POST to create contact, GET to fetch contact
│   ├── alert/
│   │   ├── route.ts              # POST to create alert + trigger VAPI call
│   │   └── [id]/
│   │       └── route.ts          # GET alert status for polling
│   └── vapi-webhook/
│       └── route.ts              # POST webhook from VAPI tool calls
lib/
├── supabase.ts                   # Supabase client helpers (server + client)
```

## Screen Designs

### 1. Contact Setup Screen (`/setup`)
- Simple form with three fields: Your Name, Contact's Name, Contact's Phone Number
- Phone number input should accept standard US format
- Save button that stores to Supabase `contacts` table
- After saving, redirect to home screen
- Store the contact ID in localStorage so we know which contact to use
- Clean, minimal design. This is a one-time setup screen.

### 2. Home Trigger Screen (`/`)
- If no contact is set up (no contact ID in localStorage), redirect to `/setup`
- Show the app name "Urgentic" at the top
- Two large, tappable buttons stacked vertically, optimized for one-handed use:
  - **"I Feel Unsafe"** — red/urgent styling
  - **"Awkward Situation"** — amber/yellow styling
- When tapped:
  1. Get location from browser (`navigator.geolocation.getCurrentPosition`) with a fallback of "Location unavailable"
  2. POST to `/api/alert` with `{ contactId, alertType, location }`
  3. Navigate to `/alert/[id]` immediately
- Mobile-first design. The buttons should be large and easy to hit. Minimal UI — no distractions.
- Include a small settings/gear icon to go back to `/setup` to change contact info.

### 3. Alert Status Screen (`/alert/[id]`)
- Poll `GET /api/alert/[id]` every 3 seconds
- Show different states:
  - **"calling"**: Pulsing animation, "Calling [contact name]..." text
  - **"responded"**: Show the contact's response prominently, show next steps message, show contact's location if available
  - **"failed"**: Show error state with option to retry or call contact directly
- Next steps messages based on response:
  - "I'm coming now" → "[Contact name] is on their way. Stay where you are if it's safe."
  - "Meet at a public place" → "[Contact name] wants you to move to a nearby public place."
  - "Call security" → "[Contact name] is calling security. Stay in a visible area."
  - "Stay where you are" → "[Contact name] says stay put. Help is being arranged."
  - "Call them with an excuse" → "[Contact name] is going to call you with an excuse to leave."
  - "Text them a fake emergency" → "[Contact name] will text you a fake emergency. Check your phone."
  - "Come meet them" → "[Contact name] is coming to meet you."
  - "Stay put, I'll figure something out" → "[Contact name] is working on getting you out. Hang tight."
- Include a "Back to Home" button after response is received.

## API Routes

### POST `/api/contacts`
- Body: `{ userName, contactName, contactPhone }`
- Creates a row in the `contacts` table
- Returns the contact object with its ID

### GET `/api/contacts?id=<contactId>`
- Returns the contact by ID

### POST `/api/alert`
This is the most important route. It:
1. Receives `{ contactId, alertType, location }` from the frontend
2. Fetches the contact from Supabase
3. Creates an alert record with status "calling"
4. Sends a VAPI outbound call using the correct assistant:
   - If `alertType === "unsafe"` → use `VAPI_UNSAFE_ASSISTANT_ID`
   - If `alertType === "awkward"` → use `VAPI_AWKWARD_ASSISTANT_ID`
5. The VAPI call uses the SAVED assistant (by assistantId), with `assistantOverrides` to inject dynamic context:
   - Override the `firstMessage` to include the user's actual name and location
   - Override the `model.messages` system prompt to include the user's name, contact's name, and location
6. Pass `metadata: { alertId, contactId }` so the webhook can match the response
7. Updates the alert record with the VAPI call ID
8. Returns `{ alertId, callId, status: "calling" }`

Here is the VAPI API call structure:

```typescript
const vapiResponse = await fetch("https://api.vapi.ai/call/phone", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${process.env.VAPI_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    phoneNumberId: process.env.VAPI_PHONE_NUMBER_ID,
    customer: {
      number: contact.contact_phone,
    },
    assistantId: alertType === "unsafe"
      ? process.env.VAPI_UNSAFE_ASSISTANT_ID
      : process.env.VAPI_AWKWARD_ASSISTANT_ID,
    assistantOverrides: {
      firstMessage: alertType === "unsafe"
        ? `Hey, I'm calling from Urgentic with an urgent message for ${contact.contact_name}. ${contact.user_name} is feeling unsafe right now and needs your help. Their approximate location is ${location}. Here's what you can do — you can say I'm coming now, meet at a public place, call security, or stay where you are. What would you like to do?`
        : `Hey ${contact.contact_name}, I'm calling from Urgentic. Nothing dangerous, but ${contact.user_name} is in an uncomfortable situation and could use a hand getting out of it. Here's what you can do — you can say call them with an excuse, text them a fake emergency, come meet them, or stay put I'll figure something out. What works best for you?`,
      model: {
        messages: [
          {
            role: "system",
            content: alertType === "unsafe"
              ? `You are a voice agent for Urgentic, an emergency safety app. You're calling ${contact.contact_name} because ${contact.user_name} has triggered an urgent safety alert. This is serious. Keep your tone calm but urgent. Speak like a real person delivering important news, not like a robot reading a script. Use short, natural sentences. Here's what you need to do: Tell them ${contact.user_name} feels unsafe and needs help right now. Their location is ${location}. Give them four options: "I'm coming now," "Meet at a public place," "Call security," or "Stay where you are." Once they pick one, ask where they currently are so you can pass that info along. Confirm their choice and location back to them. Thank them and hang up. If they're confused, just calmly repeat the four options. If their answer is close to one of the options but not exact, go with the closest match and confirm it. If they ask questions about what happened, just say you don't have more details and ask them to pick an option. Don't explain how the app works. Don't make small talk. Keep the whole call under a minute.`
              : `You are a voice agent for Urgentic, a personal safety app. You're calling ${contact.contact_name} because their friend ${contact.user_name} has used Urgentic to signal that they are in an awkward or uncomfortable situation and want a way out. This is NOT a dangerous emergency. Keep your tone friendly, casual, and lighthearted, like a helpful friend relaying a message. Here's what you need to do: Let them know ${contact.user_name} could use some help getting out of an uncomfortable situation. Give them four options: "Call them with an excuse," "Text them a fake emergency," "Come meet them," or "Stay put, I'll figure something out." Once they pick one, ask where they currently are so you can pass that info along. Confirm their choice and location back to them. Thank them casually and end the call. If they're confused, briefly explain their friend used an app to let them know they'd like help leaving a situation, then repeat the options. If their answer is close to one of the options but not exact, go with the closest match and confirm it. Don't make it sound dramatic. Keep the call under 45 seconds.`,
          },
        ],
      },
      serverUrl: `${process.env.APP_URL}/api/vapi-webhook`,
      serverMessages: ["tool-calls"],
    },
    metadata: {
      alertId: alert.id,
      contactId: contact.id,
    },
  }),
});
```

### GET `/api/alert/[id]`
- Fetches the alert joined with the contact info
- Returns: `{ id, status, alertType, location, contactResponse, contactLocation, contactName, nextSteps, createdAt }`
- `nextSteps` is a human-friendly string based on the contact's response (see the mapping in the status screen section above)

### POST `/api/vapi-webhook`
- Receives VAPI tool-call webhooks
- The VAPI assistant has a tool called `send_response` configured in the VAPI dashboard
- When the agent calls this tool, VAPI POSTs here with the tool call data
- Extract `alertId` from `body.message.call.metadata`
- Extract the response and contact location from the tool call arguments
- Update the alert in Supabase: set `status = "responded"`, `contact_response`, `contact_location`, `updated_at`
- Return the tool result to VAPI:

```typescript
return NextResponse.json({
  results: [
    {
      toolCallId: toolCall.id,
      result: "Response recorded successfully.",
    },
  ],
});
```

**IMPORTANT:** The `send_response` tool is configured in the VAPI dashboard on each assistant, NOT in code. In the VAPI dashboard, add a tool to each assistant:
- Tool name: `send_response`
- Description: "Sends the trusted contact's chosen response and their current location back to Urgentic"
- Parameters:
  - `response` (string, required): The contact's chosen response option
  - `contact_location` (string, required): Where the contact currently is
- Server URL: This will be set via `assistantOverrides.serverUrl` in the API call, so leave it blank or set a placeholder in the dashboard

## Design Guidelines

- **Mobile-first**: Design for phones. Max-width container, large touch targets, readable fonts.
- **Color scheme**:
  - Unsafe button: Deep red background, white text
  - Awkward button: Amber/yellow background, dark text
  - Status screen: Dark background with calming blue accents
  - Overall: Dark theme to be discreet (won't light up a dark room)
- **Typography**: Clean sans-serif, large text for key info
- **The home screen should be extremely simple** — just the two buttons and the app name. Nothing else. Speed and discretion are the priority.
- **Animations**: Subtle pulse animation on the status screen while calling. Smooth transition when response arrives.

## Important Notes

- No authentication for MVP. Single-user app using localStorage to persist the contact ID.
- The VAPI assistants are already created and configured in the VAPI dashboard. We just reference them by ID.
- The `send_response` tool is configured in the VAPI dashboard on each assistant. The webhook URL is overridden per-call via `assistantOverrides.serverUrl`.
- For local development, the `APP_URL` needs to be a publicly accessible URL (use ngrok: `ngrok http 3000`).
- The app should work on mobile browsers. Test on Chrome mobile viewport.
- Keep the codebase simple — this is a hackathon MVP, not production code. Minimal abstraction, clear and readable.

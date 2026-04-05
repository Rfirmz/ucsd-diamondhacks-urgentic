# Urgentic

**Urgentic** is a mobile-first web app for discreet safety communication. If someone feels **unsafe** or is stuck in an **awkward** situation, they tap one action on their phone. The app then calls their **trusted contacts** with an AI voice agent ([Vapi](https://vapi.ai/)) that explains what’s going on, offers response options, and asks where the contact is. The person who sent the alert sees **live call status** for each contact, their **spoken choices**, and **location hints** when the call captures them.

When every call in a session has finished, Urgentic can show short **“what to do next”** guidance (OpenAI-backed with a simple fallback if no key is set). Optionally, with **Mapbox** configured, it suggests a **nearby public place** (libraries, stations, etc.), shows a **static map**, and links to **walking directions**—clearly framed as approximate, not a substitute for **911**.

Contacts live in **Supabase**; which contacts are enabled on a device is also remembered in **localStorage**. Reporter **GPS** is turned into a readable address when possible via **OpenStreetMap Nominatim**; without GPS, the flow still works with limited location context.

## Tech stack

**Next.js 14** (App Router), **React**, **TypeScript**, **Tailwind CSS**, **Supabase**, **Vapi** (voice pipeline; **ElevenLabs** is often used for TTS via the Vapi dashboard), optional **OpenAI** for session guidance, optional **Mapbox** for places and map images.

## Running locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

You’ll need a **Supabase** project and **Vapi** assistants/phone numbers wired to this app. Copy environment variables into **`.env.local`** (see your team’s secrets doc or deployment config)—including **`APP_URL`** reachable from the internet for Vapi webhooks (e.g. ngrok in development).

```bash
npm run build   # production build
npm run start   # run production server
npm run lint    # eslint
```

## License

Private / team project unless noted otherwise.

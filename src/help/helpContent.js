// src/help/helpContent.js

export const HELP_TOPICS = [
  {
    id: "getting-started",
    title: "Getting started",
    blurb: "The five minute version for normal people.",
    keywords: ["start", "begin", "overview", "org", "dashboard"],
    sections: [
      { h: "What Bondfire is", p: [
        "Bondfire is a private workspace for an org. You track people, needs, inventory, meetings, pledges, and optionally a public page.",
        "Only the Bondfire home page and an org’s public page are public. Everything else is behind login."
      ]},
      { h: "Your first loop", p: [
        "1. Create or join an org.",
        "2. Add a few people so you have a roster.",
        "3. Add needs and assign priority so the list is sortable.",
        "4. Add inventory items and set par levels so ‘low stock’ becomes meaningful.",
        "5. Schedule a meeting and RSVP so people actually show up."
      ]},
      { h: "What the dashboard is", p: [
        "The dashboard is a quick glance. It is not the only place you can manage things.",
        "Tap any top card to jump into that section."
      ]},
    ],
  },

  {
    id: "security",
    title: "Security and encryption",
    blurb: "The non terrifying explanation of keys, rotation, and why any of this exists.",
    keywords: ["zk", "zero knowledge", "encryption", "key", "rotate", "rewrap", "security"],
    sections: [
      { h: "Plain language version", p: [
        "Some fields can be encrypted in your browser before they are sent to the server.",
        "That means the server stores ciphertext blobs. Without the org key, it cannot read the content."
      ]},
      { h: "Device key vs org key", p: [
        "Device key: tied to this browser and helps store things safely locally.",
        "Org key: shared for the org and used to encrypt or decrypt content for that org."
      ]},
      { h: "Load org key on this device", p: [
        "If you join an org on a new browser or phone, you may need to load the org key to read encrypted content.",
        "If you cannot load it, you will still be able to use unencrypted features, but encrypted fields will look like '(encrypted)'."
      ]},
      { h: "Rotate org key", p: [
        "Rotation creates a new org key version. You do this if a key may be compromised or as a hygiene practice.",
        "After rotation, older encrypted content might need to be rewrapped."
      ]},
      { h: "Rewrap for all members", p: [
        "Rewrapping re encrypts existing encrypted content so it is readable under the newest org key version.",
        "If people are seeing '(encrypted)' where they used to see content, rewrap is a common fix."
      ]},
      { h: "Practical advice", p: [
        "Do not rotate keys every day. Rotate when you have a real reason.",
        "If you are onboarding non technical folks, keep encryption optional until the org is stable."
      ]},
    ],
  },

  {
    id: "chat",
    title: "Chat basics",
    blurb: "How chat works and what to do when it does not.",
    keywords: ["chat", "matrix", "message", "room", "invite"],
    sections: [
      { h: "What chat is for", p: [
        "Use chat for coordination and quick questions. Put decisions and tasks in meetings, needs, or inventory so they are trackable.",
      ]},
      { h: "Good habits", p: [
        "Pin key messages instead of repeating them.",
        "Write actions as needs or pledges so they do not disappear into scrollback."
      ]},
      { h: "Common issues", p: [
        "If chat looks out of sync, refresh once. If it still looks wrong, sign out and back in.",
        "If encryption is enabled for related content, make sure your org key is loaded so you can read protected fields."
      ]},
    ],
  },

  {
    id: "inventory",
    title: "Inventory and par levels",
    blurb: "How to make inventory actually useful instead of a sad list.",
    keywords: ["inventory", "par", "stock", "low", "unit"],
    sections: [
      { h: "What par means", p: [
        "Par is the target amount you want to keep on hand.",
        "When qty is below par, the app can highlight low items and sort by lowest stock first."
      ]},
      { h: "How to set it up", p: [
        "Start with the top 20 items you always need. Set units you will actually use.",
        "Add par levels later. Bad par is worse than no par, so keep it simple."
      ]},
      { h: "Interpreting the bars", p: [
        "Green: fine. Orange: getting low. Red: stop pretending and restock."
      ]},
    ],
  },

  {
    id: "needs",
    title: "Needs and priority",
    blurb: "A need is a task with consequences.",
    keywords: ["needs", "priority", "urgent", "status", "open"],
    sections: [
      { h: "Priority vs urgency", p: [
        "Urgency is the vibe. Priority is the number you sort by.",
        "Use urgency when it affects communication. Use priority when it affects what you do next."
      ]},
      { h: "Statuses", p: [
        "Keep needs open until they are done. Close them when complete so the dashboard stays honest."
      ]},
    ],
  },

  {
    id: "meetings",
    title: "Meetings and RSVPs",
    blurb: "Scheduling is logistics, not a personality test.",
    keywords: ["meetings", "rsvp", "calendar"],
    sections: [
      { h: "Why RSVP exists", p: [
        "It gives a fast headcount. It also makes people commit, even lightly.",
      ]},
      { h: "Best practice", p: [
        "Put agendas in the meeting description or notes so it is not trapped in chat."
      ]},
    ],
  },

  {
    id: "pledges",
    title: "Pledges",
    blurb: "Tracking offers so help does not evaporate.",
    keywords: ["pledge", "offer", "accepted"],
    sections: [
      { h: "What a pledge is", p: [
        "A pledge is someone offering time, goods, money, or services.",
        "Mark it accepted when it is confirmed so you can report what is actually happening."
      ]},
    ],
  },

  {
    id: "newsletter",
    title: "Newsletter and public pages",
    blurb: "Outbound comms without turning your org into a marketing department.",
    keywords: ["newsletter", "subscriber", "public", "export", "csv"],
    sections: [
      { h: "Subscribers", p: [
        "Subscribers are people who opted in for updates. They can be exported as CSV for use in other tools.",
        "If you see blank names or emails, make sure the subscriber record includes them and that the UI is updated."
      ]},
      { h: "Public page", p: [
        "Public pages are optional. Only publish what you actually want public.",
        "You can share needs or requests publicly without exposing internal notes."
      ]},
    ],
  },

  {
    id: "troubleshooting",
    title: "Troubleshooting",
    blurb: "When something breaks at 11pm. Relatable.",
    keywords: ["error", "broken", "cache", "service worker", "offline"],
    sections: [
      { h: "First steps", p: [
        "Refresh once.",
        "If it still looks wrong, try hard refresh and then sign out and back in."
      ]},
      { h: "Service worker weirdness", p: [
        "If you see different data between two URLs or a stubborn old UI, the service worker may be caching an old build.",
        "Unregister the service worker in DevTools Application tab, then reload."
      ]},
      { h: "Encrypted fields show '(encrypted)'", p: [
        "Load the org key on this device. If the org recently rotated keys, rewrap may be required."
      ]},
    ],
  },
];

export function guessTopicIdFromPath(pathname) {
  const p = String(pathname || "").toLowerCase();
  if (p.includes("/security")) return "security";
  if (p.includes("/chat")) return "chat";
  if (p.includes("/inventory")) return "inventory";
  if (p.includes("/needs")) return "needs";
  if (p.includes("/meetings")) return "meetings";
  if (p.includes("/settings")) return "newsletter";
  if (p.includes("/orgs") || p.includes("/org/")) return "getting-started";
  return "getting-started";
}

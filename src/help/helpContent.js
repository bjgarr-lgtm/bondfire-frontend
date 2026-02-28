// src/help/helpContent.js
// Single source of truth for in-app help content.
// IMPORTANT:
// - HelpPanel.jsx uses HELP_TOPICS (and expects blurb + sections)
// - HelpWidget.jsx uses guessTopicIdFromPath

export function guessTopicIdFromPath(pathname) {
  const p = String(pathname || "").toLowerCase();

  if (p.includes("security")) return "security";
  if (p.includes("zk")) return "security";
  if (p.includes("keys")) return "security";

  if (p.includes("chat")) return "chat";
  if (p.includes("matrix")) return "chat";

  if (p.includes("inventory")) return "inventory";
  if (p.includes("needs")) return "needs";
  if (p.includes("meetings")) return "meetings";

  if (p.includes("newsletter")) return "newsletter";
  if (p.includes("public")) return "newsletter";

  return "getting-started";
}

export const HELP_TOPICS = [
  {
    "id": "getting-started",
    "title": "Getting Started",
    "blurb": "How Bondfire is structured, what to do first, and how to make the dashboard yours.",
    "keywords": [
      "dashboard",
      "org",
      "cards",
      "drag",
      "reorder",
      "layout"
    ],
    "sections": [
      {
        "h": "How Bondfire is organized",
        "p": [
          "Bondfire is built around private org spaces. Once you join or create an org, everything meaningful happens inside that org.",
          "The dashboard is a snapshot of your org: members, inventory, open needs, meetings, pledges, and newsletter growth."
        ]
      },
      {
        "h": "What to do first",
        "p": [
          "If the app feels like a lot, start in this order: People (confirm who is in), Needs (post what you actually require), Meetings (schedule your next coordination moment).",
          "Inventory, pledges, and the public page make more sense once those three are real."
        ]
      },
      {
        "h": "Customize your dashboard",
        "p": [
          "You can drag and drop the top metric cards (People, Inventory, Needs, etc.) to reorder them.",
          "Your layout is saved per organization."
        ]
      }
    ]
  },
  {
    "id": "security",
    "title": "Security & Encryption",
    "blurb": "Plain language explanations of org keys, what encryption protects, and what you are responsible for.",
    "keywords": [
      "encryption",
      "zk",
      "keys",
      "org key",
      "rotate",
      "rewrap",
      "backup"
    ],
    "sections": [
      {
        "h": "What the org key is",
        "p": [
          "An org key is a shared secret used to decrypt sensitive fields in your org. Encrypted fields are stored on the server as unreadable ciphertext.",
          "Decryption happens in your browser only when you have the org key available on that device."
        ]
      },
      {
        "h": "What this protects you from",
        "p": [
          "If the server, database, or logs are exposed, encrypted fields remain unreadable without the org key.",
          "This is designed to reduce harm from platform compromise, accidental admin access, and data leaks."
        ]
      },
      {
        "h": "What this does not protect you from",
        "p": [
          "If someone has access to your unlocked device and browser session, they can read what you can read.",
          "If you share the org key widely, you have effectively lowered your own security."
        ]
      },
      {
        "h": "Backups and recovery",
        "p": [
          "If the org key is lost and nobody has a backup, encrypted data cannot be recovered. There is no admin override. That is the point.",
          "Store a backup offline: password manager, encrypted note, or printed and locked away."
        ]
      },
      {
        "h": "Rotating the org key",
        "p": [
          "Rotating creates a new org key and re-wraps encrypted data so members can read it with the new key.",
          "Rotate when membership changes, when you suspect the key was shared too widely, or after a security incident."
        ]
      }
    ]
  },
  {
    "id": "chat",
    "title": "Chat (Matrix / Element)",
    "blurb": "Bondfire chat uses Matrix. This guide covers creating an Element account, joining rooms, and verification basics.",
    "keywords": [
      "matrix",
      "element",
      "room",
      "invite",
      "verification",
      "encryption"
    ],
    "sections": [
      {
        "h": "What this is",
        "p": [
          "Bondfire chat is powered by Matrix (the open protocol used by Element). Bondfire is not storing your messages or running a proprietary chat stack.",
          "You use a Matrix client (usually Element) and join your org's Matrix room."
        ]
      },
      {
        "h": "Create a Matrix account (Element)",
        "p": [
          "Open app.element.io (web) or install Element on mobile and create an account.",
          "You will get an address like @name:matrix.org. Some homeservers require email verification."
        ]
      },
      {
        "h": "Join your org room",
        "p": [
          "Your org chat is a normal Matrix room. You may join via an invite link, accept an invite from a member, or search by room name or alias in Element.",
          "If you are prompted for a room key or cannot see history, the room may be end-to-end encrypted and your session may need verification."
        ]
      },
      {
        "h": "Verification and encryption (practical version)",
        "p": [
          "If the room is encrypted, verify your Element session so new devices cannot silently impersonate you.",
          "Element will guide you through verifying using a security phrase or emoji comparison between devices. Do that once, then you are usually set."
        ]
      }
    ]
  },
  {
    "id": "inventory",
    "title": "Managing Inventory",
    "blurb": "Track what you have, set par levels for critical items, and let the dashboard warn you early.",
    "keywords": [
      "inventory",
      "par",
      "stock",
      "units",
      "low"
    ],
    "sections": [
      {
        "h": "Par levels",
        "p": [
          "Par is the minimum amount you want to keep on hand. It is not a maximum.",
          "If par is set, the dashboard can flag items when stock drops below that threshold."
        ]
      },
      {
        "h": "Good habits",
        "p": [
          "Use clear item names (Canned beans, not Beans).",
          "Be consistent with units when possible.",
          "Set par only for items you truly want monitored."
        ]
      }
    ]
  },
  {
    "id": "needs",
    "title": "Posting & Managing Needs",
    "blurb": "Make needs actionable, prioritize clearly, and keep the list honest.",
    "keywords": [
      "needs",
      "priority",
      "urgent",
      "status",
      "open",
      "closed"
    ],
    "sections": [
      {
        "h": "Write needs so someone can act",
        "p": [
          "Include what is needed, where it should go, and any timing constraints.",
          "If follow-up is required, include a contact method or where to respond (meeting, chat room, etc.)."
        ]
      },
      {
        "h": "Priority",
        "p": [
          "Higher priority rises to the top. Use it to reflect urgency, not moral importance.",
          "Close needs when fulfilled. Leaving old needs open makes the dashboard useless."
        ]
      }
    ]
  },
  {
    "id": "meetings",
    "title": "Meetings",
    "blurb": "Schedule coordination, keep agendas minimal, and use RSVP for planning attendance.",
    "keywords": [
      "meetings",
      "rsvp",
      "agenda",
      "location"
    ],
    "sections": [
      {
        "h": "What to include",
        "p": [
          "Date and time, plus location (address, link, or call in chat).",
          "Add notes or a short agenda if it helps."
        ]
      },
      {
        "h": "RSVP",
        "p": [
          "RSVP means you are planning to attend. It helps organizers estimate attendance.",
          "It is not a contract. People are allowed to be human."
        ]
      }
    ]
  },
  {
    "id": "newsletter",
    "title": "Newsletter & Public Page",
    "blurb": "Manage subscribers, export CSV for your email tool, and publish only what you mean to publish.",
    "keywords": [
      "newsletter",
      "subscribers",
      "export",
      "csv",
      "public page"
    ],
    "sections": [
      {
        "h": "Newsletter subscribers",
        "p": [
          "Bondfire tracks subscribers tied to your org. You can view recent signups and export subscribers as CSV for your email tool.",
          "The dashboard trend shows subscription movement over the last 14 days."
        ]
      },
      {
        "h": "Public page safety check",
        "p": [
          "Before you publish, confirm you are not exposing personal info or internal-only details.",
          "Public pages are for the internet, not just your members."
        ]
      }
    ]
  }
];

// Backwards-compatible alias if anything imports helpTopics.
export const helpTopics = HELP_TOPICS;

// src/help/helpContent.js
// Single source of truth for in-app help content.
// IMPORTANT:
// - HelpPanel.jsx uses HELP_TOPICS (and expects blurb + sections)
// - HelpWidget.jsx uses guessTopicIdFromPath

export function guessTopicIdFromPath(pathname) {
  const p = String(pathname || "").toLowerCase();

  if (p.includes("security") || p.includes("zk") || p.includes("keys") || p.includes("settings")) return "security";
  if (p.includes("chat") || p.includes("matrix")) return "chat";
  if (p.includes("inventory")) return "inventory";
  if (p.includes("needs")) return "needs";
  if (p.includes("meetings")) return "meetings";
  if (p.includes("newsletter") || p.includes("public")) return "newsletter";
  if (p.includes("orgs") || p.includes("demo")) return "demo-mode";
  if (p.includes("drive")) return "drive";
  if (p.includes("overview") || p.includes("people") || p.includes("signin") || p.includes("sign-in")) return "getting-started";

  return "getting-started";
}

export const HELP_TOPICS = [
  {
    "id": "demo-mode",
    "title": "Demo Mode",
    "blurb": "Explore Bondfire without an account, reset the sandbox, and use the guided tour.",
    "keywords": ["demo", "tour", "sandbox", "reset", "guide"],
    "sections": [
      {
        "h": "What demo mode is",
        "p": [
          "Demo mode opens a seeded mutual aid workspace without making you create an account.",
          "Changes are saved only in this browser, so you can click around and test real flows without touching production data."
        ]
      },
      {
        "h": "How to learn fast",
        "p": [
          "Start on the dashboard, then open Needs, Meetings, Inventory, and Settings.",
          "Use the Demo banner to reset the sandbox or restart the guided tour at any time."
        ]
      }
    ]
  },
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
    "id": "drive",
    "title": "Drive",
    "blurb": "Bondfire Drive is the org workspace for notes, folders, files, sheets, forms, templates, and encrypted documents. Use it like a working operations room, not a dumping ground.",
    "keywords": [
      "drive",
      "notes",
      "templates",
      "markdown",
      "files",
      "folders",
      "frontmatter",
      "backlinks",
      "sheet",
      "spreadsheet",
      "form",
      "mobile",
      "encryption",
      "public share"
    ],
    "sections": [
      {
        "h": "What Drive is for",
        "p": [
          "Drive is where an org keeps its working knowledge. That includes operational notes, intake forms, uploaded documents, spreadsheets, meeting prep, inventory references, and reusable templates. If it helps the org remember, coordinate, or respond, it belongs here.",
          "Treat Drive like a live workspace. Folders give structure, templates reduce repeated setup, sheets handle grid based tracking, and forms let you gather information without making everyone improvise from scratch."
        ]
      },
      {
        "h": "How the layout works",
        "p": [
          "The explorer lives on the left, the current document lives on the right, and the help button stays available from anywhere. On desktop you can keep the explorer open and resize panels. On mobile, the explorer is meant to open as a separate layer so the document area keeps enough room to actually work.",
          "The reading area changes based on file type. Notes open in markdown editing and preview modes. Sheets open as grid documents. Forms open as builders with a live response view. Standard uploaded files preview when the format is supported and fall back to open in browser when it is not."
        ]
      },
      {
        "h": "Notes, markdown, and properties",
        "p": [
          "Rich notes are still the backbone of Drive. Use them for meeting notes, logistics, running plans, narratives, links, and anything that benefits from flexible writing. The toolbar helps with headings, lists, quotes, code, links, and wiki links without forcing you to hand type every markdown token.",
          "Frontmatter properties let you attach structured metadata to a note. That is useful for status, owner, tags, dates, or any field you may want to sort or inspect later. Backlinks connect notes that reference each other, which makes Drive feel like a real knowledge web instead of a dead folder tree."
        ]
      },
      {
        "h": "Templates without nonsense",
        "p": [
          "Templates are for repeatable work. Use them for meeting agendas, intake flows, supply run checklists, incident records, or recurring updates. A good template removes friction without locking people into robotic writing.",
          "You can use a template to create a brand new note or insert it into the note you already have open. Supported date and title tokens are there so you can stamp time based content without rebuilding the same shell every time."
        ]
      },
      {
        "h": "Sheets",
        "p": [
          "Sheets are for real grid work: rosters, stock counts, schedules, distribution tracking, cost math, and anything where rows and columns matter more than prose. Click a cell and type directly. Use the formula bar when you want to edit or insert formulas. Use the Functions menu when you want a quick starting point instead of remembering every function name by heart like a tiny accountant wizard.",
          "Column widths and row heights can be adjusted for the selected column or row. Auto fit is there when content starts spilling. Add rows, add columns, and add additional sheets when one tab is not enough. Keep separate tabs for different slices of the same operation instead of shoving everything into one cursed mega sheet."
        ]
      },
      {
        "h": "Forms and responses",
        "p": [
          "Forms are for collecting information in a consistent shape. Use them for volunteer signups, supply offers, event RSVP, requests, followup checklists, or simple public polls. Each field type changes how the person answering experiences the form, so pick the simplest field that gets you the data you actually need.",
          "Responses are stored with the form so the org can review what came in without hunting through chat or email. Public sharing is meant for people who are not in the org or even in Bondfire at all. If public sharing is enabled, send the generated link to responders and treat the form as a focused intake door instead of a general discussion thread."
        ]
      },
      {
        "h": "Files and previews",
        "p": [
          "Drive is not limited to notes. You can upload images, PDFs, audio, video, and other files. If a file type can be previewed sensibly in app, Bondfire shows it there. If not, use open in browser or download. That is not a failure. It is the app declining to fake support it does not actually have.",
          "When naming files, be clear and boring in the useful way. A filename like spring-food-run-2026-03-24.pdf is infinitely more helpful than final_final_real_one.pdf, which is how humans announce they have given up."
        ]
      },
      {
        "h": "Mobile use",
        "p": [
          "On mobile, the priority is to keep one task readable at a time. Open the explorer when you need to switch documents, then close it and work. The document itself should get the screen, not the chrome around it. Expect the grid and long documents to scroll horizontally when they need to. That is normal for small screens.",
          "For better mobile results, keep titles concise, avoid giant frontmatter blocks, and break oversized notes into smaller documents when they are really separate pieces of work. A phone can handle real work, but it should not be forced to display your entire organizational subconscious in one panel."
        ]
      },
      {
        "h": "Encryption and what the server still knows",
        "p": [
          "Authenticated Drive content is designed to follow the same zero knowledge direction as the rest of Bondfire. Folder names, note content, document content, and sensitive metadata are meant to be encrypted client side before storage. Decryption happens in the browser with the org key, not on the server.",
          "That does not mean literally nothing is visible. The system may still know that a record exists, when it changed, its rough size, and how records relate to each other. That is metadata leakage, not content leakage. The server should not be able to read the note body, file content, or actual document meaning without the org key."
        ]
      },
      {
        "h": "Good habits that keep Drive usable",
        "p": [
          "Name things clearly. Delete junk drafts. Use templates for repeated workflows. Split giant documents when they become several documents pretending to be one. Put forms where people will actually use them. Keep the explorer organized enough that a new member can guess where something lives without receiving a lecture.",
          "Drive gets powerful fast, which means it can also become a mess fast. Structure is not bureaucracy here. It is mercy for whoever has to find the right thing during an actual need."
        ]
      },
      {
        "h": "When something feels wrong",
        "p": [
          "If a document loads but acts strangely, check whether it is opening in the right mode and whether the format is one Drive can edit in app. If a preview looks wrong, try open in browser to determine whether the issue is the file itself or the in app renderer.",
          "If encrypted data suddenly looks unreadable on a device that used to work, that usually points to a missing org key, device key mismatch, or a session problem rather than the file spontaneously becoming evil. Check security and key status before you assume the document is gone."
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

// src/help/helpContent.js
// Single source of truth for in-app help content.
// IMPORTANT: HelpPanel.jsx imports HELP_TOPICS
// HelpWidget.jsx imports guessTopicIdFromPath

export function guessTopicIdFromPath(pathname) {
  const p = String(pathname || "").toLowerCase();

  // Settings / security areas
  if (p.includes("security")) return "security";
  if (p.includes("zk")) return "security";
  if (p.includes("keys")) return "security";

  // Chat areas
  if (p.includes("chat")) return "chat";
  if (p.includes("matrix")) return "chat";

  // Inventory / needs / meetings
  if (p.includes("inventory")) return "inventory";
  if (p.includes("needs")) return "needs";
  if (p.includes("meetings")) return "meetings";

  // Newsletter / public pages
  if (p.includes("newsletter")) return "newsletter";
  if (p.includes("public")) return "newsletter";

  // Default
  return "getting-started";
}

export const HELP_TOPICS = [
  {
    id: "getting-started",
    title: "Getting Started",
    content: `
Bondfire is organized around private org spaces. Once you join or create an org, everything meaningful happens inside that space.

Dashboard Overview:
Your dashboard shows a live snapshot of your org: members, inventory levels, open needs, meetings, pledges, and newsletter growth.

You can drag and drop the top metric cards (People, Inventory, Needs, etc.) to reorder them however you like. The layout is saved per organization.

If something feels overwhelming, start with:
1. People: confirm members are added correctly.
2. Needs: post what your org actually requires.
3. Meetings: schedule your next coordination moment.

The rest builds naturally from there.
`
  },

  {
    id: "security",
    title: "Security & Encryption",
    content: `
Bondfire supports encrypted organization data. This is for information you do not want exposed if someone gains access to the server or database.

What is an Org Key?
An org key is a shared secret used to decrypt sensitive fields inside your org. If a field is encrypted, members need the org key in their browser to read it.

What this means in practice:
• Encrypted fields are stored as unreadable blobs on the server.
• Decryption happens in the browser for members who have the org key.
• If you do not have the org key, encrypted content will look blank or “(encrypted)”.

Key backup and recovery:
If you lose the org key and it is not backed up anywhere, encrypted data cannot be recovered. There is no admin override. That is the point.

Rotating the Org Key:
Rotating creates a new org key and re-wraps existing encrypted data so it can be read with the new key.
Do this when:
• A member leaves and should no longer have access.
• You suspect the key was shared too widely.
• You want a clean reset after a security incident.

Best practices:
• Only share org keys with trusted members.
• Rotate keys when membership changes.
• Store a backup offline (password manager, encrypted note, printed and locked away).
• Treat the org key like you would treat the password to your organization’s vault.

This is “strong safety” design: it protects you from platforms, leaks, and server compromise, but it requires you to manage the key responsibly.
`
  },

  {
    id: "chat",
    title: "Chat (Matrix / Element)",
    content: `
Bondfire chat is powered by Matrix, the open protocol used by Element. Bondfire is not inventing a proprietary chat system. It is connecting you to Matrix.

What you need:
A Matrix account. Most people use Element as the client.

Create your Matrix account (Element):
1. Go to https://app.element.io or install Element on mobile.
2. Create an account. You will get an address like @yourname:matrix.org.
3. Verify your email if your homeserver requires it.

Connect chat to Bondfire:
Your org chat is a normal Matrix room. Depending on how your org set it up, you may:
• Join via an invite link.
• Accept an invite from another member.
• Search for the room in Element (room name or alias).

About verification and encryption:
Matrix can use end-to-end encryption. If encryption is enabled for the room, you should verify your Element session to prevent account takeover confusion.
Element will guide you through verifying using:
• a security phrase, or
• matching emoji between devices.

What Bondfire stores:
Bondfire does not store your chat messages. Messages live on the Matrix network and are handled by your Matrix client (Element).

If you are new to Matrix:
Think “decentralized Slack”, but with stronger privacy options and multiple independent servers instead of one company controlling everything.
`
  },

  {
    id: "inventory",
    title: "Managing Inventory",
    content: `
Inventory tracks what your org has available, in real quantities.

Par levels:
Par is the minimum amount you want to keep on hand. It is not a maximum.
If you set par for an item, the dashboard can flag it when stock drops below that threshold.

How to use inventory well:
• Use clear item names (“Canned beans”, not “Beans”).
• Use consistent units when possible.
• Set par only for things you truly want monitored.

The dashboard highlights categories and items below par so you can spot problems before you are out of supplies.
`
  },

  {
    id: "needs",
    title: "Posting & Managing Needs",
    content: `
Needs are the work your org is trying to get done, and the resources you are requesting.

Write needs so someone can act on them:
• what is needed
• where it should go
• by when (if relevant)
• who to contact (if relevant)

Priority:
Higher priority needs rise to the top. Use priority to reflect urgency, not importance in a moral sense.

Close needs when fulfilled:
Keeping old needs open makes the dashboard useless. Treat “open needs” as real operational truth.
`
  },

  {
    id: "meetings",
    title: "Meetings",
    content: `
Meetings are for coordination. Chat is for discussion.

Create meetings with:
• date and time
• location (address, link, or “call in chat”)
• notes or agenda if you have one

RSVP:
RSVP means “I am planning to attend.” It helps organizers estimate attendance. It is not a legal contract. No one is summoning the RSVP police.
`
  },

  {
    id: "newsletter",
    title: "Newsletter & Public Page",
    content: `
Newsletter:
Bondfire tracks subscribers tied to your org. You can view the latest signups and export subscribers as CSV for your email tool.

Dashboard trend:
The dashboard sparkline shows subscription trend over the last 14 days, plus an overall percent change.

Public page:
Each org can publish selected information publicly. Before you publish:
• double-check you are not exposing personal info
• confirm needs and contact details are what you want visible
• remember public pages are for the internet, not just your members
`
  }
];

// Backwards-compatible alias if anything imports helpTopics.
export const helpTopics = HELP_TOPICS;

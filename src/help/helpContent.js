export const helpTopics = [
  {
    id: "getting-started",
    title: "Getting Started",
    content: `
Bondfire is organized around private org spaces. Once you join or create an org, everything meaningful happens inside that space.

Dashboard Overview:
Your dashboard shows a live snapshot of your org: members, inventory levels, open needs, meetings, pledges, and newsletter growth.

You can drag and drop the top metric cards (People, Inventory, Needs, etc.) to reorder them however you like. The layout is saved per organization.

If something feels overwhelming, start with:
1. People – confirm members are added correctly.
2. Needs – post what your org actually requires.
3. Meetings – schedule your next coordination moment.

The rest builds naturally from there.
`
  },

  {
    id: "security",
    title: "Security & Encryption",
    content: `
Bondfire supports encrypted organization data. That means certain information can only be read by members who have the org key.

What is an Org Key?
An org key is a shared secret used to decrypt sensitive data like private notes, pledges, or inventory descriptions.

Important:
• The server does not store readable versions of encrypted data.
• If you lose your org key and it is not backed up, encrypted data cannot be recovered.

Rotating an Org Key:
When you rotate the key, encrypted data is re-wrapped with a new key. Do this if:
• A member leaves and should no longer access encrypted content.
• You suspect key compromise.

Best Practices:
• Only share org keys with trusted members.
• Rotate keys when membership changes.
• Store backup keys securely offline.

Encryption is optional for some content but recommended for sensitive operational data.
`
  },

  {
    id: "chat",
    title: "Chat (Matrix / Element)",
    content: `
Bondfire chat is powered by Matrix, the same open protocol used by Element.

You will need a Matrix account to participate.

How to Get Started:
1. Create an account at https://app.element.io or install the Element app.
2. Choose a username (e.g., @yourname:matrix.org).
3. Verify your email and complete device verification in Element.

Connecting to Bondfire:
Your org’s chat room is a standard Matrix room. You can:
• Join via invite link.
• Search for the room name.
• Accept an invitation from another member.

Device Verification:
Matrix supports end-to-end encryption. You should verify your session in Element to prevent impersonation.
This usually involves confirming a security phrase or emoji sequence between devices.

What Bondfire Does:
Bondfire does not store chat messages. Messages live on the Matrix network and are encrypted by Matrix itself.

If you are unfamiliar with Matrix, think of it as a decentralized Slack with stronger privacy guarantees.
`
  },

  {
    id: "inventory",
    title: "Managing Inventory",
    content: `
Inventory tracks what your org physically has available.

You can:
• Add items
• Set par levels (minimum desired quantity)
• Monitor items below par

The dashboard highlights categories that are running low and items that fall below target levels.

On mobile, inventory displays as stacked item cards for readability.

Use par levels realistically. They are not maximums — they are minimum operating levels.
`
  },

  {
    id: "needs",
    title: "Posting & Managing Needs",
    content: `
Needs represent real requests from your organization.

Each need includes:
• Title
• Priority
• Status
• Optional description

Higher priority items surface more prominently.

Mark needs as resolved when fulfilled to maintain an accurate operational view.

Use clear language. Needs should be actionable, not abstract.
`
  },

  {
    id: "meetings",
    title: "Meetings & RSVPs",
    content: `
Meetings coordinate your org.

Create a meeting with:
• Date & time
• Location (physical or virtual)
• Optional notes

Members can RSVP so organizers know expected attendance.

Use meetings for coordination, not discussion threads — that belongs in chat.
`
  },

  {
    id: "newsletter",
    title: "Newsletter & Public Page",
    content: `
The newsletter tool tracks subscribers tied to your org.

Dashboard View:
You will see subscriber totals and 14-day growth percentage.

Exporting:
You can export subscribers as CSV for external email tools.

Public Page:
Each org can publish selected information publicly. Review carefully before making sensitive information public.
`
  }
];
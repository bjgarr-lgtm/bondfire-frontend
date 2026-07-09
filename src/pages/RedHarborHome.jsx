import React from "react"
import { Link } from "react-router-dom"
import "../styles/redharbor-public-pass1.css"

const ORG_ID = "red-harbor"
const ORG_SLUG = "red-harbor"
const BRANCH_EMAIL = "redharboriww@gmail.com"
const BRANCH_EMAIL_LABEL = BRANCH_EMAIL

const ARCHIVE_SLIDES = [
  {
    src: "/home-archive/iww-1.jpg",
    title: "Finn Hall",
    caption: "'Red' Finn Hall in Aberdeen, the main meeting place for lumber strikers during the first 4 decades of the 20th century. Courtesy Aaron Goings collection.",
  },
  {
    src: "/home-archive/iww-2.jpg",
    title: "1912 Grays Harbor Lumber Strike",
    caption: "Men, women, and children during a strike parade on April 7, 1912. The massive 1912 Grays Harbor Lumber Strike drew a great deal of support from the local community. Photo courtesy of Polson Museum, Hoquiam, Washington",
  },
  {
    src: "/home-archive/iww-3.jpg",
    title: "Everett Massacre Memorial",
    caption: "IWW supporters honor Everett Massacre victims, Mount Pleasant Cemetery, Seattle, May 1, 1917.",
  },
  {
    src: "/home-archive/iww-4.jpg",
    title: "Headquarters",
    caption: "IWW headquarters probably in Seattle (Courtesy UW Libraries Special Collections).",
  },
  {
    src: "/home-archive/iww-5.jpg",
    title: "IWW Gathering",
    caption: "Members of the Aberdeen IWW gather.",
  },
  {
    src: "/home-archive/iww-6.jpg",
    title: "Hoquiam Strike March",
    caption: "Strikers march through Hoquiam during the 1912 Grays Harbor Lumber Strike. Led by the IWW, the strike spread from Grays Harbor to mills and logging camps in Pacific County and the Puget Sound. Photo courtesy of Polson Museum, Hoquiam, Washington.",
  },
]

const defaultHome = {
  branch_label: "Red Harbor Branch",
  hero_headline: "Building worker power on the harbor and beyond.",
  hero_text:
    "Red Harbor is a branch of the Industrial Workers of the World. We organize across workplaces, support workers in struggle, publish branch updates, and build solidarity rooted in direct action and rank and file power.",
  about_intro:
    "Red Harbor is the local IWW branch building organization, education, and solidarity among workers in Aberdeen, Hoquiam, and the surrounding region.",
  purpose_title: "What this site is for",
  about_title: "About Red Harbor",
  join_title: "Organize with us",
  bulletin_title: "Publications and updates",
  events_title: "Meetings and public activity",
  contact_title: "Get in touch",
  about_card_title: "Branch overview",
  about_card_body:
    "We are a branch of the Industrial Workers of the World, a union for all workers. We organize across workplaces, support workers in struggle, publish branch updates, and build solidarity rooted in direct action and rank and file power. We are building the branch in Aberdeen, Hoquiam, and the surrounding region. We are workers supporting workers, and we are stronger together. Join us.",
  location_card_title: "Location",
  location_card_body: "Red Harbor Branch",
  join_intro:
    "Organize with the branch, connect with others, and build power through workplace struggle, direct action, and collective effort.",
  contact_intro:
    "Reach out for branch contact, organizing support, membership questions, or public inquiries.",
  events_intro:
    "Meetings, branch activity, and public events will appear here as the public side develops.",
  hero_image_url: "",
  font_family: "system",
  accent_color: "#a11f1f",
  show_action_strip: true,
  show_what_we_do: true,
  show_get_involved: true,
  show_meetings: true,
  show_newsletter_card: true,
  show_website_button: false,
  website_link: null,
  what_we_do: [
    "Workplace organizing support",
    "Branch meetings and political education",
    "Public bulletins and branch updates",
    "Solidarity rooted in direct action",
    "Building worker power across industries",
    'Organizing with the IWW network locally and globally',
  ],
  site_purpose_items: [
    "Learn what the branch is and what it does",
    "Find organizing and membership information",
    "Read public updates and branch publications",
    "Access the private branch board through sign in",
    "Contact the branch for support, questions, or to get involved",
  ],
  join_cards: [
    {
      title: "Join the branch",
      body: "Become part of the Red Harbor branch and plug into meetings, campaigns, education, and organizing support.",
    },
    {
      title: "Organize your workplace",
      body: "If you want help organizing on the job, reach out. We can help you start carefully, map relationships, and build toward collective action.",
    },
    {
      title: "Support broader struggle",
      body: "Workers, tenants, precarious workers, and unemployed workers all deserve organization, dignity, and solidarity. There is room to build.",
    },
  ],
  events_items: [
    "Branch meetings and public events will be posted here.",
    "Workplace organizing support and one to one follow up available.",
    "Bulletin updates and announcements published on a regular basis.",
  ],
  contact_card_title: "Branch contact",
  contact_card_body:
    "For branch contact, organizing support, membership questions, or public inquiries, email the branch directly.",
  member_access_title: "Member access",
  member_access_body:
    "Existing members can use the private branch board for internal updates, documents, meetings, and announcements.",
  membership_title: "Join the IWW through Red Harbor",
  membership_intro:
    "Join the One Big Union, connect with a local branch, and plug into workplace organizing, political education, and worker solidarity on the harbor and beyond.",
  membership_details_title: "Who can join",
  membership_details_body:
    "The IWW is for workers, not employers. That includes workers with jobs, unemployed workers, students, retirees, self employed workers, informal workers, and workers who cannot currently work. People with real hiring and firing power over other workers are treated as employers and are not eligible.",
  membership_includes_title: "Who this includes",
  membership_includes_items: [
    "Workers currently on the job",
    "Unemployed and underemployed workers",
    "Students and retirees",
    "Self employed and informal workers",
    "Workers already in another union, except officers",
  ],
  membership_dues_title: "Dues",
  membership_dues_items: [
    "$11/mo · Less than $2,000 per month",
    "$22/mo · $2,000 to $3,500 per month",
    "$33/mo · More than $3,500 per month",
    "The first month also includes an initiation fee equal to one month of dues.",
  ],
  membership_cta_title: "Ready to get your red card?",
  membership_cta_body:
    "Redcard handles the membership sign up. Once you are in, Red Harbor can be part of where that membership actually lives.",
  membership_poster_url: "/red-harbor-hero.jpg",
  section_order: ["hero","join","membership","bulletin","events","contact"],
  section_visibility: {
    hero: true,
    join: true,
    membership: true,
    bulletin: true,
    events: true,
    contact: true
  },
  primary_actions: [
    { label: "Join Us", url: "#join" },
    { label: "Read the Bulletin", url: "#bulletin" },
    { label: "Member Area", url: "/signin" },
  ],
  get_involved_links: [
    { label: "Contact the branch", url: "#contact" },
    { label: "Get organizing support", url: "#contact" },
    { label: "Member Sign In", url: "/signin" },
  ],
}

function scrollToSection(id) {
  const el = document.getElementById(id)
  if (!el) return
  el.scrollIntoView({ behavior: "smooth", block: "start" })
}

function SectionLink({ id, children, className = "" }) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => scrollToSection(id)}
    >
      {children}
    </button>
  )
}

function normalizeUrl(raw) {
  const s = String(raw || "").trim()
  if (!s) return ""
  if (
    s.startsWith("#") ||
    s.startsWith("/") ||
    /^(https?:\/\/|mailto:|tel:|sms:|signal:)/i.test(s)
  ) {
    return s
  }
  return `https://${s}`
}

function cleanLinkObject(item) {
  if (!item || typeof item !== "object") return null
  const label = String(item.label || item.text || "").trim()
  const url = normalizeUrl(item.url || "")
  if (!label || !url) return null
  return { label, url }
}

function cleanLinkArray(arr, limit = 8) {
  return (Array.isArray(arr) ? arr : [])
    .map(cleanLinkObject)
    .filter(Boolean)
    .slice(0, limit)
}

function cleanStringArray(arr, limit = 12) {
  return (Array.isArray(arr) ? arr : [])
    .map((item) => String(item ?? ""))
    .filter((item) => item.trim())
    .slice(0, limit)
}

function cleanStringArrayForSave(arr, limit = 12) {
  return (Array.isArray(arr) ? arr : [])
    .map((item) => String(item ?? "").trim())
    .filter(Boolean)
    .slice(0, limit)
}

function cleanJoinCards(arr) {
  const items = Array.isArray(arr) ? arr : []
  const cleaned = items
    .map((item) => ({
      title: String(item?.title || "").trim(),
      body: String(item?.body || "").trim(),
    }))
    .filter((item) => item.title || item.body)
    .slice(0, 6)

  return cleaned.length ? cleaned : defaultHome.join_cards
}

function moveArrayItem(arr, fromIndex, toIndex) {
  const list = Array.isArray(arr) ? arr.slice() : []
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= list.length ||
    toIndex >= list.length ||
    fromIndex === toIndex
  ) {
    return list
  }
  const [moved] = list.splice(fromIndex, 1)
  list.splice(toIndex, 0, moved)
  return list
}

function hexToRgb(hex) {
  const clean = String(hex || "").trim().replace("#", "")
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return null
  const n = parseInt(clean, 16)
  return {
    r: (n >> 16) & 255,
    g: (n >> 8) & 255,
    b: n & 255,
  }
}

function rgbToHex(r, g, b) {
  return "#" + [r, g, b].map((v) => {
    const n = Math.max(0, Math.min(255, Math.round(v)))
    return n.toString(16).padStart(2, "0")
  }).join("")
}

function darkenHex(hex, amount = 0.2) {
  const rgb = hexToRgb(hex)
  if (!rgb) return "#7b3029"
  return rgbToHex(
    rgb.r * (1 - amount),
    rgb.g * (1 - amount),
    rgb.b * (1 - amount),
  )
}

function normalizeHome(raw) {
  const base = raw && typeof raw === "object" ? raw : {}
  return {
    ...defaultHome,
    ...base,
    branch_label: String(base.branch_label || base.location || defaultHome.branch_label).trim(),
    hero_headline: String(base.hero_headline || base.title || defaultHome.hero_headline).trim(),
    hero_text: String(base.hero_text || base.about || defaultHome.hero_text).trim(),
    about_intro: String(base.about_intro || defaultHome.about_intro).trim(),
    purpose_title: String(base.purpose_title || defaultHome.purpose_title).trim(),
    about_title: String(base.about_title || defaultHome.about_title).trim(),
    join_title: String(base.join_title || defaultHome.join_title).trim(),
    bulletin_title: String(base.bulletin_title || defaultHome.bulletin_title).trim(),
    events_title: String(base.events_title || defaultHome.events_title).trim(),
    contact_title: String(base.contact_title || defaultHome.contact_title).trim(),
    about_card_title: String(base.about_card_title || defaultHome.about_card_title).trim(),
    about_card_body: String(base.about_card_body || base.about_intro || defaultHome.about_card_body).trim(),
    location_card_title: String(base.location_card_title || defaultHome.location_card_title).trim(),
    location_card_body: String(base.location_card_body || base.branch_label || defaultHome.location_card_body).trim(),
    join_intro: String(base.join_intro || defaultHome.join_intro).trim(),
    contact_intro: String(base.contact_intro || defaultHome.contact_intro).trim(),
    events_intro: String(base.events_intro || defaultHome.events_intro).trim(),
    hero_image_url: String(base.hero_image_url || "").trim(),
    accent_color: String(base.accent_color || defaultHome.accent_color).trim(),
    what_we_do: cleanStringArray(base.what_we_do, 12).length
      ? cleanStringArray(base.what_we_do, 12)
      : defaultHome.what_we_do,
    site_purpose_items: cleanStringArray(base.site_purpose_items, 8).length
      ? cleanStringArray(base.site_purpose_items, 8)
      : defaultHome.site_purpose_items,
    join_cards: cleanJoinCards(base.join_cards),
    events_items: cleanStringArray(base.events_items, 8).length
      ? cleanStringArray(base.events_items, 8)
      : defaultHome.events_items,
    contact_card_title: String(base.contact_card_title || defaultHome.contact_card_title).trim(),
    contact_card_body: String(base.contact_card_body || defaultHome.contact_card_body).trim(),
    member_access_title: String(base.member_access_title || defaultHome.member_access_title).trim(),
    member_access_body: String(base.member_access_body || defaultHome.member_access_body).trim(),
    membership_title: String(base.membership_title || defaultHome.membership_title).trim(),
    membership_intro: String(base.membership_intro || defaultHome.membership_intro).trim(),
    membership_details_title: String(base.membership_details_title || defaultHome.membership_details_title).trim(),
    membership_details_body: String(base.membership_details_body || defaultHome.membership_details_body).trim(),
    membership_includes_title: String(base.membership_includes_title || defaultHome.membership_includes_title).trim(),
    membership_includes_items: cleanStringArray(base.membership_includes_items, 12).length
      ? cleanStringArray(base.membership_includes_items, 12)
      : defaultHome.membership_includes_items,
    membership_dues_title: String(base.membership_dues_title || defaultHome.membership_dues_title).trim(),
    membership_dues_items: cleanStringArray(base.membership_dues_items, 12).length
      ? cleanStringArray(base.membership_dues_items, 12)
      : defaultHome.membership_dues_items,
    membership_cta_title: String(base.membership_cta_title || defaultHome.membership_cta_title).trim(),
    membership_cta_body: String(base.membership_cta_body || defaultHome.membership_cta_body).trim(),
    membership_poster_url: String(base.membership_poster_url || defaultHome.membership_poster_url).trim(),
    section_order: Array.isArray(base.section_order)
      ? base.section_order
      : defaultHome.section_order,
    section_visibility: typeof base.section_visibility === "object"
      ? base.section_visibility
      : defaultHome.section_visibility,
    primary_actions: cleanLinkArray(base.primary_actions, 3).length
      ? cleanLinkArray(base.primary_actions, 3)
      : defaultHome.primary_actions,
    get_involved_links: cleanLinkArray(base.get_involved_links, 6).length
      ? cleanLinkArray(base.get_involved_links, 6)
      : defaultHome.get_involved_links,
    website_link: cleanLinkObject(base.website_link),
    show_action_strip: base.show_action_strip !== false,
    show_what_we_do: base.show_what_we_do !== false,
    show_get_involved: !!(base.show_get_involved ?? defaultHome.show_get_involved),
    show_meetings: base.show_meetings !== false,
    show_newsletter_card: !!base.show_newsletter_card,
    show_website_button: !!base.show_website_button,
  }
}

function runAction(url) {
  const target = String(url || "").trim()
  if (!target) return

  const lowered = target.toLowerCase()

  if (lowered === "newsletter" || lowered === "#newsletter") {
    scrollToSection("contact")
    return
  }

  if (lowered.startsWith("modal:")) {
    scrollToSection("contact")
    return
  }

  if (target.startsWith("#")) {
    scrollToSection(target.slice(1))
    return
  }

  if (target.startsWith("/")) {
    window.location.assign(target)
    return
  }

  window.open(normalizeUrl(target), "_blank", "noopener,noreferrer")
}

function readCurrentOrgId() {
  try {
    const raw = localStorage.getItem("bf_org")
    if (!raw) return ""
    const parsed = JSON.parse(raw)
    return String(parsed?.id || "").trim()
  } catch {
    return ""
  }
}


async function fileToOptimizedDataUrl(file) {
  if (!file) return ""
  if (!file.type || !file.type.startsWith("image/")) {
    throw new Error("Please choose an image file.")
  }

  const objectUrl = URL.createObjectURL(file)
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error("Could not read image."))
      el.src = objectUrl
    })

    const maxWidth = 1800
    const scale = Math.min(1, maxWidth / img.width)
    const width = Math.max(1, Math.round(img.width * scale))
    const height = Math.max(1, Math.round(img.height * scale))

    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("Could not process image.")

    ctx.drawImage(img, 0, 0, width, height)

    let dataUrl = canvas.toDataURL("image/jpeg", 0.82)
    if (dataUrl.length > 900000) {
      dataUrl = canvas.toDataURL("image/jpeg", 0.68)
    }
    if (dataUrl.length > 1400000) {
      throw new Error("Image is still too large after compression. Try a smaller image.")
    }
    return dataUrl
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

function InlineTextEdit({
  tag = "div",
  value,
  onChange,
  editorMode,
  className = "",
  multiline = false,
  placeholder = "",
  rows = 4,
}) {
  if (!editorMode) {
    const Tag = tag
    return <Tag className={className}>{value}</Tag>
  }

  if (multiline) {
    return (
      <textarea
        className={`rh-inline-editor rh-inline-editor-textarea ${className}`.trim()}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
      />
    )
  }

  if (tag === "h1") {
    return (
      <input
        className={`rh-inline-editor rh-inline-editor-h1 ${className}`.trim()}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    )
  }

  if (tag === "h2") {
    return (
      <input
        className={`rh-inline-editor rh-inline-editor-h2 ${className}`.trim()}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    )
  }

  return (
    <input
      className={`rh-inline-editor ${className}`.trim()}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  )
}

function InlineStringListEditor({
  title,
  items,
  onChange,
  editorMode,
  className = "",
  itemPlaceholder = "List item",
  rows = 4,
}) {
  if (!editorMode) {
    return (
      <ul className={className}>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    )
  }

  return (
    <div className={`rh-inline-group ${className}`.trim()}>
      {title ? <div className="rh-inline-group-label">{title}</div> : null}
      <textarea
        className="rh-inline-editor rh-inline-editor-textarea"
        value={items.join("\n")}
        onChange={(e) =>
          onChange(
            String(e.target.value || "")
              .split("\n")
              .map((s) => s)
              .filter((s) => s.trim())
          )
        }
        placeholder={`${itemPlaceholder}\n${itemPlaceholder}\n${itemPlaceholder}`}
        rows={rows}
      />
    </div>
  )
}

function InlineReorderableStringListEditor({
  title,
  items,
  onChange,
  editorMode,
  className = "",
  itemPlaceholder = "List item",
  maxItems = 12,
}) {
  if (!editorMode) {
    return (
      <ul className={className}>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    )
  }

  const safe = Array.isArray(items) ? items.slice(0, maxItems) : []

  return (
    <div className={`rh-inline-group ${className}`.trim()}>
      {title ? <div className="rh-inline-group-label">{title}</div> : null}

      <div className="rh-inline-reorder-list">
        {safe.map((item, index) => (
          <div key={`${title || "item"}-${index}`} className="rh-inline-reorder-row">
            <input
              className="rh-inline-editor"
              value={item || ""}
              onChange={(e) => {
                const next = safe.slice()
                next[index] = e.target.value
                onChange(next)
              }}
              placeholder={itemPlaceholder}
            />
            <div className="rh-inline-reorder-actions">
              <button
                type="button"
                className="rh-inline-move-btn"
                onClick={() => onChange(moveArrayItem(safe, index, index - 1))}
                disabled={index === 0}
                aria-label={`Move ${title || "item"} ${index + 1} up`}
              >
                ↑
              </button>
              <button
                type="button"
                className="rh-inline-move-btn"
                onClick={() => onChange(moveArrayItem(safe, index, index + 1))}
                disabled={index === safe.length - 1}
                aria-label={`Move ${title || "item"} ${index + 1} down`}
              >
                ↓
              </button>
              <button
                type="button"
                className="rh-inline-remove-btn"
                onClick={() => onChange(safe.filter((_, i) => i !== index))}
                aria-label={`Remove ${title || "item"} ${index + 1}`}
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>

      {safe.length < maxItems ? (
        <button
          type="button"
          className="rh-inline-add-btn"
          onClick={() => onChange([...safe, itemPlaceholder || "New item"])}
        >
          Add item
        </button>
      ) : null}
    </div>
  )
}

function InlineCardBlockEditor({
  title,
  cardTitle,
  cardBody,
  onTitleChange,
  onBodyChange,
  editorMode,
}) {
  if (!editorMode) {
    return (
      <>
        <h3>{cardTitle}</h3>
        <p>{cardBody}</p>
      </>
    )
  }

  return (
    <div className="rh-inline-group">
      {title ? <div className="rh-inline-group-label">{title}</div> : null}
      <input
        className="rh-inline-editor"
        value={cardTitle}
        onChange={(e) => onTitleChange(e.target.value)}
        placeholder="Card title"
      />
      <textarea
        className="rh-inline-editor rh-inline-editor-textarea"
        value={cardBody}
        onChange={(e) => onBodyChange(e.target.value)}
        placeholder="Card body"
        rows={4}
      />
    </div>
  )
}

function InlineActionListEditor({
  title,
  items,
  onChange,
  editorMode,
  limit = 3,
}) {
  if (!editorMode) return null

  const safe = Array.isArray(items) ? items.slice(0, limit) : []

  return (
    <div className="rh-inline-group">
      {title ? <div className="rh-inline-group-label">{title}</div> : null}
      <div className="rh-inline-actions-grid">
        {safe.map((item, index) => (
          <div key={`${title || "action"}-${index}`} className="rh-inline-action-card">
            <div className="rh-inline-action-head">
              <div className="rh-inline-group-label">Button {index + 1}</div>
              <div className="rh-inline-reorder-actions">
                <button
                  type="button"
                  className="rh-inline-move-btn"
                  onClick={() => onChange(moveArrayItem(safe, index, index - 1))}
                  disabled={index === 0}
                  aria-label={`Move button ${index + 1} up`}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="rh-inline-move-btn"
                  onClick={() => onChange(moveArrayItem(safe, index, index + 1))}
                  disabled={index === safe.length - 1}
                  aria-label={`Move button ${index + 1} down`}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="rh-inline-remove-btn"
                  onClick={() => onChange(safe.filter((_, i) => i !== index))}
                  aria-label={`Remove button ${index + 1}`}
                >
                  Remove
                </button>
              </div>
            </div>
            <input
              className="rh-inline-editor"
              value={item.label || ""}
              onChange={(e) => {
                const next = safe.map((x, i) => i === index ? { ...x, label: e.target.value } : x)
                onChange(next)
              }}
              placeholder="Button label"
            />
            <input
              className="rh-inline-editor"
              value={item.url || ""}
              onChange={(e) => {
                const next = safe.map((x, i) => i === index ? { ...x, url: e.target.value } : x)
                onChange(next)
              }}
              placeholder="#join or /signin or https://..."
            />
          </div>
        ))}
      </div>

      {safe.length < limit ? (
        <button
          type="button"
          className="rh-inline-add-btn"
          onClick={() => onChange([...safe, { label: "", url: "" }])}
        >
          Add button
        </button>
      ) : null}
    </div>
  )
}


function ArchiveCarousel({
  slides,
  title = "From The Archive",
  intro = "Historical images from the longer struggle. Click through to see more.",
}) {
  const safeSlides = Array.isArray(slides) ? slides.filter(Boolean) : []
  const [index, setIndex] = React.useState(0)
  const [broken, setBroken] = React.useState({})

  React.useEffect(() => {
    if (!safeSlides.length) return
    if (index > safeSlides.length - 1) setIndex(0)
  }, [index, safeSlides.length])

  if (!safeSlides.length) return null

  const current = safeSlides[index] || safeSlides[0]
  const currentBroken = !!broken[current.src]

  function prev() {
    setIndex((i) => (i - 1 + safeSlides.length) % safeSlides.length)
  }

  function next() {
    setIndex((i) => (i + 1) % safeSlides.length)
  }

  return (
    <section className="rh-section rh-archive-band" aria-label="Historical archive carousel">
      <div className="rh-archive-head">
        <p className="rh-section-kicker">Archive</p>
        <h2>{title}</h2>
        <p className="rh-section-copy">{intro}</p>
        <div className="rh-bulletin-home-actions" style={{ marginTop: 12 }}>
          <Link to="/labor-history" className="rh-btn rh-btn-secondary">Open full labor archive</Link>
        </div>
      </div>

      <div className="rh-archive-shell">
        <button type="button" className="rh-archive-nav" onClick={prev} aria-label="Previous archive image">
          ←
        </button>

        <article className="rh-archive-stage">
          {!currentBroken ? (
            <img
              src={current.src}
              alt={current.title || "Historical archive image"}
              className="rh-archive-image"
              onError={() => setBroken((prevMap) => ({ ...prevMap, [current.src]: true }))}
            />
          ) : (
            <div className="rh-archive-image rh-archive-placeholder">
              <strong>{current.title || "missing archive image"}</strong>
              <p>{current.src}</p>
            </div>
          )}

          <div className="rh-archive-caption">
            <h3>{current.title}</h3>
            {current.caption ? <p>{current.caption}</p> : null}
          </div>
        </article>

        <button type="button" className="rh-archive-nav" onClick={next} aria-label="Next archive image">
          →
        </button>
      </div>

      <div className="rh-archive-dots" aria-hidden="true">
        {safeSlides.map((slide, i) => (
          <button
            key={`${slide.src}-${i}`}
            type="button"
            className={`rh-archive-dot ${i === index ? "is-active" : ""}`}
            onClick={() => setIndex(i)}
          />
        ))}
      </div>
    </section>
  )
}


function EditableSection({ id, title, children, editorMode, index, total, moveSection, toggleSection, visible }) {
  if (!visible) {
    return editorMode ? (
      <div style={{ opacity: 0.4, marginBottom: 12 }}>
        <strong>{title} (hidden)</strong>
        <button onClick={() => toggleSection(id)}>Show</button>
      </div>
    ) : null
  }

  return (
    <div style={{ marginBottom: 24 }}>
      {editorMode && (
        <div className="rh-inline-action-head" style={{ marginBottom: 8 }}>
          <div className="rh-inline-group-label">{title}</div>
          <div className="rh-inline-reorder-actions">
            <button disabled={index===0} onClick={() => moveSection(index,index-1)}>↑</button>
            <button disabled={index===total-1} onClick={() => moveSection(index,index+1)}>↓</button>
            <button onClick={() => toggleSection(id)}>Hide</button>
          </div>
        </div>
      )}
      {children}
    </div>
  )
}


export default function RedHarborHome() {
  const [home, setHome] = React.useState(defaultHome)
  const [draft, setDraft] = React.useState(null)
  const [posts, setPosts] = React.useState([])
  const [bulletinError, setBulletinError] = React.useState("")
  const [siteError, setSiteError] = React.useState("")
  const [editorAvailable, setEditorAvailable] = React.useState(false)
  const [editorMode, setEditorMode] = React.useState(false)
  const [saveBusy, setSaveBusy] = React.useState(false)
  const [saveMsg, setSaveMsg] = React.useState("")
  const [isDirty, setIsDirty] = React.useState(false)
  const [currentOrgId, setCurrentOrgId] = React.useState("")
  const [isSignedIn, setIsSignedIn] = React.useState(false)
  const [newsletterName, setNewsletterName] = React.useState("")
  const [newsletterEmail, setNewsletterEmail] = React.useState("")
  const [newsletterBusy, setNewsletterBusy] = React.useState(false)
  const [newsletterMsg, setNewsletterMsg] = React.useState("")




  React.useEffect(() => {
    let ignore = false

    async function loadHome() {
      try {
        const res = await fetch(`/api/public-home/${ORG_ID}`)
        const data = await res.json().catch(() => ({}))
        if (!res.ok || data?.ok === false) {
          throw new Error(data?.message || data?.error || "Failed to load site settings")
        }
        if (!ignore) {
          setHome(normalizeHome(data.public || {}))
        }
      } catch (err) {
        if (!ignore) {
          setSiteError(String(err?.message || err || "Failed to load site settings"))
        }
      }
    }

    async function loadBulletin() {
      try {
        const res = await fetch(`/api/public/bulletin?org=${ORG_SLUG}&limit=3`)
        const data = await res.json().catch(() => ({}))
        if (!res.ok || !data?.ok) {
          throw new Error(data?.message || "Failed to load bulletin")
        }
        if (!ignore) {
          setPosts(Array.isArray(data.posts) ? data.posts : [])
        }
      } catch (err) {
        if (!ignore) {
          setBulletinError(String(err?.message || err || "Failed to load bulletin"))
        }
      }
    }

    async function checkEditor() {
      const orgId = readCurrentOrgId()
      if (!ignore) setCurrentOrgId(orgId || "")
      try {
        const res = await fetch("/api/auth/me", {
          method: "GET",
          credentials: "include",
          headers: { Accept: "application/json" },
        })
        const data = await res.json().catch(() => ({}))
        if (!ignore) {
          const authed = !!(res.ok && data?.ok)
          setEditorAvailable(authed)
          setIsSignedIn(authed)
        }
      } catch {
        if (!ignore) {
          setEditorAvailable(false)
          setIsSignedIn(false)
        }
      }
    }

    loadHome()
    loadBulletin()
    checkEditor()

    return () => {
      ignore = true
    }
  }, [])

  let liveHome
  try {
    liveHome = draft ? normalizeHome(draft) : home
  } catch (e) {
    console.error("normalizeHome crash:", e)
    liveHome = home || {}
  }

  const whatWeDoItems = React.useMemo(() => cleanStringArray(liveHome.what_we_do, 8), [liveHome.what_we_do])
  const purposeItems = React.useMemo(() => cleanStringArray(liveHome.site_purpose_items, 8), [liveHome.site_purpose_items])
  const eventItems = React.useMemo(() => cleanStringArray(liveHome.events_items, 8), [liveHome.events_items])
  const liveJoinCards = React.useMemo(() => cleanJoinCards(liveHome.join_cards), [liveHome.join_cards])
  const membershipIncludesItems = React.useMemo(() => cleanStringArray(liveHome.membership_includes_items, 12), [liveHome.membership_includes_items])
  const membershipDuesItems = React.useMemo(() => cleanStringArray(liveHome.membership_dues_items, 12), [liveHome.membership_dues_items])
  const primaryActions = React.useMemo(() => cleanLinkArray(liveHome.primary_actions, 3), [liveHome.primary_actions])
  const involvedActions = React.useMemo(() => cleanLinkArray(liveHome.get_involved_links, 6), [liveHome.get_involved_links])

  const accent = liveHome.accent_color || defaultHome.accent_color
  const accentDark = darkenHex(accent, 0.22)

  const memberAreaHref = currentOrgId ? `/org/${encodeURIComponent(currentOrgId)}` : "/orgs"

  const heroStyle = React.useMemo(() => {
    const url = String(liveHome.hero_image_url || "").trim()
    if (!url) return undefined
    return {
      backgroundImage: `linear-gradient(rgba(13, 20, 23, 0.68), rgba(13, 20, 23, 0.82)), url("${url}")`,
      backgroundSize: "cover",
      backgroundPosition: "center center",
      backgroundRepeat: "no-repeat",
      borderRadius: "28px",
      paddingTop: "56px",
      paddingBottom: "40px",
      paddingLeft: "28px",
      paddingRight: "28px",
      marginTop: "18px",
    }
  }, [liveHome.hero_image_url])

  const startEditing = React.useCallback(() => {
    setDraft(normalizeHome({ ...home }))
    setEditorMode(true)
    setSaveMsg("")
  }, [home])

  const cancelEditing = React.useCallback(() => {
    setDraft(null)
    setEditorMode(false)
    setSaveBusy(false)
    setIsDirty(false)
    setSaveMsg("")
  }, [])

  const doneEditing = React.useCallback(() => {
    setDraft(null)
    setEditorMode(false)
    setSaveBusy(false)
    setIsDirty(false)
    setSaveMsg("")
  }, [])

  const updateDraft = React.useCallback((key, value) => {
    setIsDirty(true)
    setDraft((prev) => normalizeHome({ ...(prev || home), [key]: value }))
  }, [home])

  const updateJoinCard = React.useCallback((index, patch) => {
    setDraft((prev) => {
      const src = normalizeHome(prev || home)
      setIsDirty(true)
      const base = cleanJoinCards(src.join_cards)
      const next = base.map((card, i) => (i === index ? { ...card, ...patch } : card))
      return normalizeHome({ ...src, join_cards: next })
    })
  }, [home])

  const addJoinCard = React.useCallback(() => {
    setDraft((prev) => {
      const src = normalizeHome(prev || home)
      setIsDirty(true)
      const base = cleanJoinCards(src.join_cards)
      if (base.length >= 6) return src
      return normalizeHome({
        ...src,
        join_cards: [...base, { title: "New join card", body: "Add copy here." }],
      })
    })
  }, [home])

  const removeJoinCard = React.useCallback((index) => {
    setDraft((prev) => {
      const src = normalizeHome(prev || home)
      setIsDirty(true)
      const base = cleanJoinCards(src.join_cards)
      const next = base.filter((_, i) => i !== index)
      return normalizeHome({ ...src, join_cards: next.length ? next : defaultHome.join_cards })
    })
  }, [home])


  const moveSection = React.useCallback((from, to) => {
    setDraft(prev => {
      const src = normalizeHome(prev || home)
      const order = [...src.section_order]
      const item = order.splice(from, 1)[0]
      order.splice(to, 0, item)
      return normalizeHome({ ...src, section_order: order })
    })
  }, [home])

  const toggleSection = React.useCallback((id) => {
    setDraft(prev => {
      const src = normalizeHome(prev || home)
      return normalizeHome({
        ...src,
        section_visibility: {
          ...src.section_visibility,
          [id]: !src.section_visibility[id]
        }
      })
    })
  }, [home])
  const moveJoinCard = React.useCallback((fromIndex, toIndex) => {
    setDraft((prev) => {
      const src = normalizeHome(prev || home)
      setIsDirty(true)
      const base = cleanJoinCards(src.join_cards)
      return normalizeHome({ ...src, join_cards: moveArrayItem(base, fromIndex, toIndex) })
    })
  }, [home])


  const updateActionList = React.useCallback((key, items, limit = 3) => {
    setDraft((prev) => {
      const src = normalizeHome(prev || home)
      setIsDirty(true)
      const cleaned = (Array.isArray(items) ? items : [])
        .slice(0, limit)
        .map((item) => ({
          label: String(item?.label || "").trim(),
          url: String(item?.url || "").trim(),
        }))
        .filter((item) => item.label && item.url)
      return normalizeHome({ ...src, [key]: cleaned })
    })
  }, [home])

  const handleHeroImageUpload = React.useCallback(async (file) => {
    try {
      setSaveMsg("")
      const dataUrl = await fileToOptimizedDataUrl(file)
      updateDraft("hero_image_url", dataUrl)
    } catch (err) {
      setSaveMsg(String(err?.message || err || "Failed to load image"))
    }
  }, [updateDraft])

  const handleMembershipPosterUpload = React.useCallback(async (file) => {
    try {
      setSaveMsg("")
      const dataUrl = await fileToOptimizedDataUrl(file)
      updateDraft("membership_poster_url", dataUrl)
    } catch (err) {
      setSaveMsg(String(err?.message || err || "Failed to load image"))
    }
  }, [updateDraft])



  React.useEffect(() => {
    if (!editorMode) return

    const handler = (e) => {
      if (!isDirty) return
      e.preventDefault()
      e.returnValue = ""
    }

    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [editorMode, isDirty])

  const submitNewsletter = React.useCallback(async (e) => {
    e?.preventDefault?.()
    const email = String(newsletterEmail || "").trim()
    const name = String(newsletterName || "").trim()

    if (!email) {
      setNewsletterMsg("Please enter your email.")
      return
    }

    setNewsletterBusy(true)
    setNewsletterMsg("")
    try {
      const res = await fetch(`/api/p/${ORG_SLUG}/newsletter/subscribe`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ email, name }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data?.ok === false) {
        throw new Error(data?.error || data?.message || "Could not sign up for newsletter")
      }
      setNewsletterName("")
      setNewsletterEmail("")
      setNewsletterMsg("You’re on the list.")
    } catch (err) {
      setNewsletterMsg(String(err?.message || err || "Could not sign up for newsletter"))
    } finally {
      setNewsletterBusy(false)
    }
  }, [newsletterEmail, newsletterName])

  const saveDraft = React.useCallback(async () => {
    console.log("RH SAVE CLICK", {
      orgId: ORG_ID,
      currentOrgId,
      draftFont: draft?.font_family,
      homeFont: home?.font_family,
    })

    try {
      const orgId = ORG_ID
      console.log("RH SAVE STEP 1 orgId", orgId)

      if (!orgId) {
        setSaveMsg("No org context found for saving.")
        console.error("RH SAVE STOP no orgId")
        return
      }

      console.log("RH SAVE STEP 2 before normalizeHome")
      const src = normalizeHome(draft || home)
      console.log("RH SAVE STEP 3 after normalizeHome", {
        font_family: src?.font_family,
        accent_color: src?.accent_color,
      })

      const payload = {
        newsletter_enabled: !!src.newsletter_enabled,
        show_action_strip: !!src.show_action_strip,
        show_needs: !!src.show_needs,
        show_meetings: !!src.show_meetings,
        show_what_we_do: !!src.show_what_we_do,
        show_get_involved: !!src.show_get_involved,
        show_newsletter_card: !!src.show_newsletter_card,
        show_website_button: !!src.show_website_button,
        title: src.hero_headline,
        location: src.branch_label,
        about: src.hero_text,
        branch_label: src.branch_label,
        hero_headline: src.hero_headline,
        hero_text: src.hero_text,
        about_intro: src.about_intro,
        purpose_title: src.purpose_title,
        about_title: src.about_title,
        join_title: src.join_title,
        bulletin_title: src.bulletin_title,
        events_title: src.events_title,
        contact_title: src.contact_title,
        about_card_title: src.about_card_title,
        about_card_body: src.about_card_body,
        location_card_title: src.location_card_title,
        location_card_body: src.location_card_body,
        join_intro: src.join_intro,
        contact_intro: src.contact_intro,
        events_intro: src.events_intro,
        hero_image_url: src.hero_image_url,
        font_family: src.font_family,
        accent_color: src.accent_color,
        what_we_do: cleanStringArrayForSave(src.what_we_do, 12),
        site_purpose_items: cleanStringArrayForSave(src.site_purpose_items, 8),
        join_cards: src.join_cards,
        events_items: cleanStringArrayForSave(src.events_items, 8),
        contact_card_title: src.contact_card_title,
        contact_card_body: src.contact_card_body,
        member_access_title: src.member_access_title,
        member_access_body: src.member_access_body,
        membership_title: src.membership_title,
        membership_intro: src.membership_intro,
        membership_details_title: src.membership_details_title,
        membership_details_body: src.membership_details_body,
        membership_includes_title: src.membership_includes_title,
        membership_includes_items: cleanStringArrayForSave(src.membership_includes_items, 12),
        membership_dues_title: src.membership_dues_title,
        membership_dues_items: cleanStringArrayForSave(src.membership_dues_items, 12),
        membership_cta_title: src.membership_cta_title,
        membership_cta_body: src.membership_cta_body,
        membership_poster_url: src.membership_poster_url,
        primary_actions: src.primary_actions,
        get_involved_links: src.get_involved_links,
      }

      console.log("RH SAVE STEP 4 payload ready", payload)
      setSaveBusy(true)
      setSaveMsg("")

      console.log("RH SAVE STEP 5 before fetch")
      const res = await fetch(`/api/orgs/${encodeURIComponent(orgId)}/public/save`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      })
      console.log("RH SAVE STEP 6 fetch returned", res.status)

      const data = await res.json().catch(() => ({}))
      console.log("RH SAVE STEP 7 response json", data)

      if (!res.ok || data?.ok === false) {
        throw new Error(data?.detail || data?.error || data?.message || "Failed to save page")
      }

      const savedHome = normalizeHome(data.public || payload)
      console.log("RH SAVE STEP 8 savedHome", savedHome)

      setHome(savedHome)
      try {
        if (savedHome?.font_family) {
          localStorage.setItem('rh_font_family', savedHome.font_family)
        }
      } catch (e) {
        console.warn("font localStorage failed", e)
      }
      setDraft(null)
      setIsDirty(false)
      setSaveMsg("Saved")
      setEditorMode(false)

      try {
        console.log("RH SAVE STEP 9 verify fetch start")
        const verifyRes = await fetch(`/api/public-home/${ORG_ID}?t=${Date.now()}`, {
          method: "GET",
          cache: "no-store",
          headers: {
            Accept: "application/json",
            "Cache-Control": "no-cache, no-store, must-revalidate",
            Pragma: "no-cache",
          },
        })
        console.log("RH SAVE STEP 10 verify fetch returned", verifyRes.status)
        const verifyData = await verifyRes.json().catch(() => ({}))
        console.log("RH SAVE STEP 11 verify json", verifyData)
        if (verifyRes.ok && verifyData?.ok !== false && verifyData?.public) {
          const verifiedHome = normalizeHome(verifyData.public)
          console.log("RH SAVE STEP 12 apply verified home", verifiedHome)
          setHome(verifiedHome)
        }
      } catch (verifyErr) {
        console.warn("public-home verification skipped", verifyErr)
      }

      setTimeout(() => setSaveMsg(""), 1800)
    } catch (err) {
      console.error("RH SAVE FAILED", err)
      setSaveMsg(String(err?.message || err || "Failed to save page"))
    } finally {
      setSaveBusy(false)
    }
  }, [currentOrgId, draft, home])

  return (
    <div
      className={`rh-public rh-font-${liveHome.font_family || "system"} ${editorMode ? "rh-editor-mode" : ""}`}
      style={{
        "--rh-accent": accent,
        "--rh-red": accent,
        "--rh-red-2": accentDark,
      }}
    >
      <header className="rh-public-header">
        <div className="rh-public-brand">
          <img
            src="/red-harbor-logo.png"
            alt="Red Harbor logo"
            className="rh-public-logo"
            onError={(e) => {
              e.currentTarget.style.display = "none"
            }}
          />
          <div className="rh-public-brandtext">
            <div className="rh-public-kicker">Industrial Workers of the World</div>
            <div className="rh-public-title">Red Harbor</div>
          </div>
        </div>

        <nav className="rh-public-nav" aria-label="Primary">
          <SectionLink id="about" className="rh-nav-link">About</SectionLink>
          <SectionLink id="join" className="rh-nav-link">Join</SectionLink>
          <SectionLink id="membership" className="rh-nav-link">Membership</SectionLink>
          <SectionLink id="bulletin" className="rh-nav-link">Bulletin</SectionLink>
          <Link to="/labor-history" className="rh-nav-link">Labor History</Link>
          {liveHome.show_meetings ? <SectionLink id="events" className="rh-nav-link">Events</SectionLink> : null}
          <SectionLink id="contact" className="rh-nav-link">Contact</SectionLink>
          {editorAvailable && !editorMode ? (
            <button type="button" className="rh-signin-link rh-editor-toggle" onClick={startEditing}>
              Edit page
            </button>
          ) : null}
          <Link to={isSignedIn ? memberAreaHref : "/signin"} className="rh-signin-link">
            {isSignedIn ? "Member Area" : "Member Sign In"}
          </Link>
        </nav>
      </header>

      {editorMode ? (
        <>
          <div className="rh-editor-toolbar">
            <div className="rh-editor-toolbar-left">
              <strong>Editor mode</strong>
              <span className="rh-editor-toolbar-note">Inline editing for public page copy, fonts, color, and buttons.</span>
            </div>
            <div className="rh-editor-toolbar-actions">
              <label className="rh-editor-font">
                <span>Font</span>
                <select
                value={liveHome.font_family || "system"}
                onChange={(e) => updateDraft("font_family", e.target.value)}
              >
                <option value="system">System</option>
                <option value="inter">Inter</option>
                <option value="plex">IBM Plex Sans</option>
                <option value="manrope">Manrope</option>
                <option value="archivo">Archivo</option>
                <option value="space">Space Grotesk</option>
                <option value="oswald">Oswald</option>
                <option value="bebas">Bebas Neue</option>
                <option value="serif">Source Serif 4</option>
                <option value="playfair">Playfair Display</option>
                <option value="fraunces">Fraunces</option>
                <option value="cormorant">Cormorant Garamond</option>
                <option value="altehaas">Alte Haas Grotesk</option>
              </select>
              </label>

              <label className="rh-editor-color">
                <span>Accent</span>
                <input
                  type="color"
                  value={liveHome.accent_color || defaultHome.accent_color}
                  onChange={(e) => updateDraft("accent_color", e.target.value)}
                />
              </label>

              <label className="rh-editor-image">
                <span>Hero image</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files && e.target.files[0]
                    if (file) await handleHeroImageUpload(file)
                    e.target.value = ""
                  }}
                />
              </label>

              <label className="rh-editor-image">
                <span>Membership poster</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files && e.target.files[0]
                    if (file) await handleMembershipPosterUpload(file)
                    e.target.value = ""
                  }}
                />
              </label>

              {liveHome.hero_image_url ? (
                <button
                  type="button"
                  className="rh-btn rh-btn-ghost"
                  onClick={() => updateDraft("hero_image_url", "")}
                  disabled={saveBusy}
                >
                  Remove image
                </button>
              ) : null}
              {saveMsg ? <span className={saveMsg.includes("Saved") ? "rh-editor-success" : "rh-editor-error"}>{saveMsg}</span> : null}
              <button
                type="button"
                className="rh-btn rh-btn-ghost"
                onClick={doneEditing}
                disabled={saveBusy || isDirty}
              >
                Done
              </button>
              <button
                type="button"
                className="rh-btn rh-btn-ghost"
                onClick={cancelEditing}
                disabled={saveBusy}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rh-btn rh-btn-primary"
                onClick={() => {
                  console.log("RH SAVE BUTTON PRESSED")
                  saveDraft()
                }}
                disabled={saveBusy}
              >
                {saveBusy ? "Saving…" : "Save and exit"}
              </button>
            </div>
          </div>

          <div className="rh-editor-panels">
            <div className="rh-editor-panel">
              <InlineActionListEditor
                title="Hero buttons"
                items={liveHome.primary_actions}
                onChange={(items) => updateActionList("primary_actions", items, 3)}
                editorMode={editorMode}
                limit={3}
              />
            </div>

            <div className="rh-editor-panel">
              <InlineActionListEditor
                title="Join action links"
                items={liveHome.get_involved_links}
                onChange={(items) => updateActionList("get_involved_links", items, 3)}
                editorMode={editorMode}
                limit={3}
              />
            </div>
          </div>
        </>
      ) : null}

      <main>
        <section className={`rh-hero rh-hero-wide ${liveHome.hero_image_url ? "rh-hero-has-image" : ""}`} style={heroStyle}>
          <div className="rh-hero-copy">
            <InlineTextEdit
              tag="p"
              className="rh-eyebrow"
              editorMode={editorMode}
              value={liveHome.branch_label || defaultHome.branch_label}
              onChange={(value) => updateDraft("branch_label", value)}
              placeholder="Red Harbor Branch"
            />
            <InlineTextEdit
              tag="h1"
              className=""
              editorMode={editorMode}
              value={liveHome.hero_headline || defaultHome.hero_headline}
              onChange={(value) => updateDraft("hero_headline", value)}
              placeholder="Building worker power on the harbor and beyond."
            />
            <InlineTextEdit
              tag="p"
              className="rh-lead"
              multiline
              editorMode={editorMode}
              value={liveHome.hero_text || defaultHome.hero_text}
              onChange={(value) => updateDraft("hero_text", value)}
              placeholder="Hero supporting text"
            />

            {liveHome.show_action_strip && primaryActions.length > 0 ? (
              <div className="rh-hero-actions">
                {primaryActions.map((action, index) => {
                  const cls =
                    index === 0
                      ? "rh-btn rh-btn-primary"
                      : index === 1
                        ? "rh-btn rh-btn-secondary"
                        : "rh-btn rh-btn-ghost"

                  if (String(action.url || "").startsWith("/")) {
                    const isMemberLink = String(action.url || "") === "/signin"
                    const to = isMemberLink && isSignedIn ? memberAreaHref : action.url
                    const label = isMemberLink && isSignedIn ? "Member Area" : action.label
                    return (
                      <Link key={`${label}-${index}`} to={to} className={cls}>
                        {label}
                      </Link>
                    )
                  }

                  return (
                    <button
                      key={`${action.label}-${index}`}
                      type="button"
                      className={cls}
                      onClick={() => runAction(action.url)}
                    >
                      {action.label}
                    </button>
                  )
                })}
              </div>
            ) : null}
          </div>

        </section>

        <ArchiveCarousel slides={ARCHIVE_SLIDES} />

        <section id="about" className="rh-section">
          <div className="rh-section-head">
            <p className="rh-section-kicker">About</p>
            <InlineTextEdit
              tag="h2"
              className=""
              editorMode={editorMode}
              value={liveHome.about_title || defaultHome.about_title}
              onChange={(value) => updateDraft("about_title", value)}
              placeholder="About Red Harbor"
            />
            <InlineTextEdit
              tag="p"
              className="rh-section-copy"
              multiline
              editorMode={editorMode}
              value={liveHome.about_intro || defaultHome.about_intro}
              onChange={(value) => updateDraft("about_intro", value)}
              placeholder="About section intro"
            />
          </div>

          <div className="rh-grid-two">
            <div className={`rh-card ${editorMode ? "rh-resizable" : ""}`}>
              <InlineCardBlockEditor
                title={editorMode ? "About card" : ""}
                cardTitle={liveHome.about_card_title || defaultHome.about_card_title}
                cardBody={liveHome.about_card_body || defaultHome.about_card_body}
                onTitleChange={(value) => updateDraft("about_card_title", value)}
                onBodyChange={(value) => updateDraft("about_card_body", value)}
                editorMode={editorMode}
              />
            </div>

            <div className={`rh-card ${editorMode ? "rh-resizable" : ""}`}>
              <InlineCardBlockEditor
                title={editorMode ? "Location card" : ""}
                cardTitle={liveHome.location_card_title || defaultHome.location_card_title}
                cardBody={liveHome.location_card_body || defaultHome.location_card_body}
                onTitleChange={(value) => updateDraft("location_card_title", value)}
                onBodyChange={(value) => updateDraft("location_card_body", value)}
                editorMode={editorMode}
              />
            </div>

            {liveHome.show_what_we_do && whatWeDoItems.length > 0 ? (
              <div className={`rh-card ${editorMode ? "rh-resizable" : ""}`} style={{ gridColumn: "1 / -1" }}>
                <h3>What we do</h3>
                {editorMode ? (
                  <InlineReorderableStringListEditor
                    title="What we do items"
                    items={whatWeDoItems}
                    onChange={(items) => updateDraft("what_we_do", items)}
                    editorMode={editorMode}
                    itemPlaceholder="What we do item"
                    maxItems={12}
                  />
                ) : (
                  <div className="rh-grid-two">
                    {whatWeDoItems.map((item) => (
                      <div key={item} className={`rh-card ${editorMode ? "rh-resizable" : ""}`}>
                        <p style={{ margin: 0 }}>{item}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </section>
    <section id="join" className="rh-section rh-section-band">
      
          <div className="rh-section-head">
            <p className="rh-section-kicker">Join</p>
            <InlineTextEdit
              tag="h2"
              className=""
              editorMode={editorMode}
              value={liveHome.join_title || defaultHome.join_title}
              onChange={(value) => updateDraft("join_title", value)}
              placeholder="Organize with us"
            />
            <InlineTextEdit
              tag="p"
              className="rh-section-copy"
              multiline
              editorMode={editorMode}
              value={liveHome.join_intro || defaultHome.join_intro}
              onChange={(value) => updateDraft("join_intro", value)}
              placeholder="Join section intro"
            />
          </div>

          <div className={`rh-card ${editorMode ? "rh-resizable" : ""} rh-home-membership-card`}>
            <div className="rh-home-membership-copy">
              <h3>IWW membership</h3>
              <p>
                Learn how membership works, what dues look like, and join through the official Redcard sign up.
              </p>
            </div>

            <div className="rh-home-membership-actions">
              <button type="button" className="rh-btn rh-btn-secondary" onClick={() => scrollToSection("membership")}>
                Learn about membership
              </button>
              <a
                href="https://redcard.iww.org/"
                className="rh-btn rh-btn-primary"
                target="_blank"
                rel="noopener noreferrer"
              >
                Join via Redcard
              </a>
            </div>
          </div>

          {editorMode ? (
            <div className="rh-inline-action-head" style={{ marginBottom: 14 }}>
              <div className="rh-inline-group-label">Join cards</div>
              <div className="rh-inline-reorder-actions">
                {liveJoinCards.length < 6 ? (
                  <button type="button" className="rh-inline-add-btn" onClick={addJoinCard}>
                    Add join card
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className={`rh-grid-three ${liveJoinCards.length >= 4 ? "rh-join-grid-four" : ""}`}>
            {liveJoinCards.map((card, index) => {
              const action = (liveHome.show_get_involved && involvedActions.length > 0 ? involvedActions : defaultHome.get_involved_links)[index]
              return (
                <article className={`rh-card ${editorMode ? "rh-resizable" : ""}`} key={`${card.title || "join-card"}-${index}`}>
                  {editorMode ? (
                    <div className="rh-inline-action-head" style={{ marginBottom: 10 }}>
                      <div className="rh-inline-group-label">Join card {index + 1}</div>
                      <div className="rh-inline-reorder-actions">
                        <button
                          type="button"
                          className="rh-inline-move-btn"
                          onClick={() => moveJoinCard(index, index - 1)}
                          disabled={index === 0}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className="rh-inline-move-btn"
                          onClick={() => moveJoinCard(index, index + 1)}
                          disabled={index === liveJoinCards.length - 1}
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          className="rh-inline-remove-btn"
                          onClick={() => removeJoinCard(index)}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ) : null}

                  <InlineCardBlockEditor
                    title=""
                    cardTitle={card.title}
                    cardBody={card.body}
                    onTitleChange={(value) => updateJoinCard(index, { title: value })}
                    onBodyChange={(value) => updateJoinCard(index, { body: value })}
                    editorMode={editorMode}
                  />
                  {action ? (
                    String(action.url || "").startsWith("/") ? (
                      <Link
                        to={String(action.url || "") === "/signin" && isSignedIn ? memberAreaHref : action.url}
                        className="rh-inline-link"
                      >
                        {String(action.url || "") === "/signin" && isSignedIn ? "Member Area" : action.label}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        className="rh-inline-link"
                        style={{ background: "none", border: 0, padding: 0, cursor: "pointer", textAlign: "left" }}
                        onClick={() => runAction(action.url)}
                      >
                        {action.label}
                      </button>
                    )
                  ) : null}
                </article>
              )
            })}
          </div>

        </section>

        <section id="membership" className="rh-section rh-membership-shell">
          <div className="rh-membership-left">
            <div className="rh-section-head">
              <p className="rh-section-kicker">Membership</p>
              <InlineTextEdit
                tag="h2"
                className=""
                editorMode={editorMode}
                value={liveHome.membership_title || defaultHome.membership_title}
                onChange={(value) => updateDraft("membership_title", value)}
                placeholder="Join the IWW through Red Harbor"
              />
              <InlineTextEdit
                tag="p"
                className="rh-section-copy"
                multiline
                editorMode={editorMode}
                value={liveHome.membership_intro || defaultHome.membership_intro}
                onChange={(value) => updateDraft("membership_intro", value)}
                placeholder="Membership intro"
              />
            </div>

            <div className="rh-membership-poster-wrap">
              <div className={`rh-card ${editorMode ? "rh-resizable" : ""}`}>
                {liveHome.membership_poster_url ? (
                  <img
                    src={liveHome.membership_poster_url}
                    alt="Membership poster"
                    style={{
                      width: "100%",
                      maxHeight: 320,
                      objectFit: "contain",
                      borderRadius: 16,
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid var(--rh-line)",
                    }}
                  />
                ) : (
                  <div className="rh-note">Upload a membership poster from editor mode.</div>
                )}
              </div>
            </div>
          </div>

          <div className="rh-membership-right">
            <div className="rh-membership-stack">
              <div className={`rh-card ${editorMode ? "rh-resizable" : ""}`}>
                <InlineTextEdit
                  tag="h3"
                  className=""
                  editorMode={editorMode}
                  value={liveHome.membership_details_title || defaultHome.membership_details_title}
                  onChange={(value) => updateDraft("membership_details_title", value)}
                  placeholder="Who can join"
                />
                <InlineTextEdit
                  tag="p"
                  className=""
                  multiline
                  editorMode={editorMode}
                  value={liveHome.membership_details_body || defaultHome.membership_details_body}
                  onChange={(value) => updateDraft("membership_details_body", value)}
                  placeholder="Membership details"
                />

                <div style={{ marginTop: 18 }}>
                  <InlineTextEdit
                    tag="h3"
                    className=""
                    editorMode={editorMode}
                    value={liveHome.membership_includes_title || defaultHome.membership_includes_title}
                    onChange={(value) => updateDraft("membership_includes_title", value)}
                    placeholder="Who this includes"
                  />
                  {editorMode ? (
                    <InlineReorderableStringListEditor
                      title="Membership includes"
                      items={membershipIncludesItems}
                      onChange={(items) => updateDraft("membership_includes_items", items)}
                      editorMode={editorMode}
                      itemPlaceholder="Membership includes item"
                      maxItems={12}
                    />
                  ) : (
                    <ul className="rh-event-list">
                      {membershipIncludesItems.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <div className={`rh-card ${editorMode ? "rh-resizable" : ""}`} style={{ padding: 16 }}>
                <InlineTextEdit
                  tag="h3"
                  className=""
                  editorMode={editorMode}
                  value={liveHome.membership_dues_title || defaultHome.membership_dues_title}
                  onChange={(value) => updateDraft("membership_dues_title", value)}
                  placeholder="Dues"
                />
                {editorMode ? (
                  <InlineReorderableStringListEditor
                    title="Membership dues"
                    items={membershipDuesItems}
                    onChange={(items) => updateDraft("membership_dues_items", items)}
                    editorMode={editorMode}
                    itemPlaceholder="Dues item"
                    maxItems={12}
                  />
                ) : (
                  <ul className="rh-event-list">
                    {membershipDuesItems.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                )}
              </div>

              <div className={`rh-card ${editorMode ? "rh-resizable" : ""}`}>
                <InlineTextEdit
                  tag="h2"
                  className=""
                  editorMode={editorMode}
                  value={liveHome.membership_cta_title || defaultHome.membership_cta_title}
                  onChange={(value) => updateDraft("membership_cta_title", value)}
                  placeholder="Ready to get your red card?"
                />
                <InlineTextEdit
                  tag="p"
                  className="rh-section-copy"
                  multiline
                  editorMode={editorMode}
                  value={liveHome.membership_cta_body || defaultHome.membership_cta_body}
                  onChange={(value) => updateDraft("membership_cta_body", value)}
                  placeholder="Membership CTA body"
                />
                <div className="rh-hero-actions">
                  <a
                    href="https://redcard.iww.org/"
                    className="rh-btn rh-btn-primary"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Join via Redcard
                  </a>
                  <button type="button" className="rh-btn rh-btn-secondary" onClick={() => scrollToSection("contact")}>
                    Talk to the branch first
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
        <section id="bulletin" className="rh-section">
          <div className="rh-bulletin-home">
            <div className="rh-bulletin-home-intro">
              <div className="rh-section-head">
                <p className="rh-section-kicker">Bulletin</p>
                <InlineTextEdit
                  tag="h2"
                  className=""
                  editorMode={editorMode}
                  value={liveHome.bulletin_title || defaultHome.bulletin_title}
                  onChange={(value) => updateDraft("bulletin_title", value)}
                  placeholder="Publications and updates"
                />
              </div>

              <div className="rh-bulletin-home-actions">
                <Link to="/bulletin" className="rh-btn rh-btn-secondary">Browse all bulletin posts</Link>
              </div>

              {bulletinError ? (
                <div className="rh-note-wrap">
                  <p className="rh-note">{bulletinError}</p>
                </div>
              ) : null}
            </div>

            <div className="rh-bulletin-home-list">
              {posts.map((post) => (
                <article className={`rh-card ${editorMode ? "rh-resizable" : ""} rh-bulletin-home-card`} key={post.id}>
                  <div className="rh-bulletin-home-date">
                    {post.publishedAt || post.updatedAt || ""}
                  </div>
                  <h3 className="rh-bulletin-home-card-title">{post.title}</h3>
                  {post.excerpt ? <p>{post.excerpt}</p> : null}
                  <Link to={`/bulletin/${post.slug}`} className="rh-inline-link">Read post</Link>
                </article>
              ))}
            </div>
          </div>
        </section>

        {liveHome.show_meetings ? (
          <section id="events" className="rh-section rh-section-band">
            <div className="rh-section-head">
              <p className="rh-section-kicker">Events</p>
              <InlineTextEdit
                tag="h2"
                className=""
                editorMode={editorMode}
                value={liveHome.events_title || defaultHome.events_title}
                onChange={(value) => updateDraft("events_title", value)}
                placeholder="Meetings and public activity"
              />
              <InlineTextEdit
                tag="p"
                className="rh-section-copy"
                multiline
                editorMode={editorMode}
                value={liveHome.events_intro || defaultHome.events_intro}
                onChange={(value) => updateDraft("events_intro", value)}
                placeholder="Events section intro"
              />
            </div>
            <div className={`rh-card ${editorMode ? "rh-resizable" : ""}`}>
              <InlineStringListEditor
                items={eventItems}
                onChange={(items) => updateDraft("events_items", items)}
                editorMode={editorMode}
                className="rh-event-list"
                itemPlaceholder="Event list item"
                rows={6}
              />
            </div>
          </section>
        ) : null}

        <section id="contact" className="rh-section">
          <div className="rh-section-head">
            <p className="rh-section-kicker">Contact</p>
            <InlineTextEdit
              tag="h2"
              className=""
              editorMode={editorMode}
              value={liveHome.contact_title || defaultHome.contact_title}
              onChange={(value) => updateDraft("contact_title", value)}
              placeholder="Get in touch"
            />
            <InlineTextEdit
              tag="p"
              className="rh-section-copy"
              multiline
              editorMode={editorMode}
              value={liveHome.contact_intro || defaultHome.contact_intro}
              onChange={(value) => updateDraft("contact_intro", value)}
              placeholder="Contact section intro"
            />
          </div>

          <div className="rh-grid-two">
            <div className={`rh-card ${editorMode ? "rh-resizable" : ""}`}>
              <InlineCardBlockEditor
                title={editorMode ? "Contact card" : ""}
                cardTitle={liveHome.contact_card_title || defaultHome.contact_card_title}
                cardBody={liveHome.contact_card_body || defaultHome.contact_card_body}
                onTitleChange={(value) => updateDraft("contact_card_title", value)}
                onBodyChange={(value) => updateDraft("contact_card_body", value)}
                editorMode={editorMode}
              />

              {!editorMode ? (
                <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
                  <a
                    href={`mailto:${BRANCH_EMAIL}`}
                    className="rh-inline-link"
                    style={{ wordBreak: "break-word" }}
                  >
                    {BRANCH_EMAIL_LABEL}
                  </a>
                </div>
              ) : null}
            </div>

            <div className={`rh-card ${editorMode ? "rh-resizable" : ""}`}>
              <div className="rh-newsletter-head">
                <h3>Newsletter</h3>
                <p>
                  Get branch updates, public announcements, bulletin releases, and upcoming event notices by email.
                </p>
              </div>

              <form className="rh-newsletter-form" onSubmit={submitNewsletter}>
                <label className="rh-newsletter-field">
                  <span>Name</span>
                  <input
                    className="rh-inline-editor"
                    value={newsletterName}
                    onChange={(e) => setNewsletterName(e.target.value)}
                    placeholder="Your name"
                  />
                </label>

                <label className="rh-newsletter-field">
                  <span>Email</span>
                  <input
                    className="rh-inline-editor"
                    type="email"
                    value={newsletterEmail}
                    onChange={(e) => setNewsletterEmail(e.target.value)}
                    placeholder="you@example.org"
                    required
                  />
                </label>

                <button type="submit" className="rh-btn rh-btn-primary" disabled={newsletterBusy}>
                  {newsletterBusy ? "Joining..." : "Join newsletter"}
                </button>
              </form>

              {newsletterMsg ? (
                <p className="rh-note" style={{ marginTop: 12 }}>{newsletterMsg}</p>
              ) : null}
            </div>
          </div>


        </section>
      </main>

      <footer className="rh-public-footer">
        <div>
          <strong>Red Harbor</strong>
          <p>Industrial Workers of the World</p>
        </div>
        <div className="rh-footer-links">
          <SectionLink id="about" className="rh-footer-link-button">About</SectionLink>
          <SectionLink id="join" className="rh-footer-link-button">Join</SectionLink>
          <SectionLink id="membership" className="rh-footer-link-button">Membership</SectionLink>
          <SectionLink id="bulletin" className="rh-footer-link-button">Bulletin</SectionLink>
          <Link to="/labor-history">Labor History</Link>
          {liveHome.show_meetings ? <SectionLink id="events" className="rh-footer-link-button">Events</SectionLink> : null}
          <SectionLink id="contact" className="rh-footer-link-button">Contact</SectionLink>
          <Link to={isSignedIn ? memberAreaHref : "/signin"}>
            {isSignedIn ? "Member Area" : "Member Sign In"}
          </Link>
        </div>
      </footer>
    </div>
  )
}

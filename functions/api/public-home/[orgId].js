import { getPublicCfg, resolveSlug } from "../_lib/publicPageStore.js"

export async function onRequestGet({ env, params }) {
  const rawOrgId = String(params.orgId || "").trim()

  if (!rawOrgId) {
    return Response.json({ ok: false, error: "MISSING_ORG_ID" }, { status: 400 })
  }

  let resolvedOrgId = rawOrgId
  let cfg = await getPublicCfg(env, resolvedOrgId)

  if (!cfg || !Object.keys(cfg).length) {
    const slugOrgId = await resolveSlug(env, rawOrgId)
    if (slugOrgId) {
      resolvedOrgId = String(slugOrgId).trim()
      cfg = await getPublicCfg(env, resolvedOrgId)
    }
  }

  const cleaned = {
    enabled: !!cfg?.enabled,
    newsletter_enabled: !!cfg?.newsletter_enabled,
    pledges_enabled: cfg?.pledges_enabled !== false,
    show_action_strip: cfg?.show_action_strip !== false,
    show_needs: cfg?.show_needs !== false,
    show_meetings: cfg?.show_meetings !== false,
    show_what_we_do: cfg?.show_what_we_do !== false,
    show_get_involved: !!cfg?.show_get_involved,
    show_newsletter_card: !!cfg?.show_newsletter_card,
    show_website_button: !!cfg?.show_website_button,
    slug: String(cfg?.slug || ""),
    title: String(cfg?.title || ""),
    location: String(cfg?.location || ""),
    about: String(cfg?.about || ""),
    branch_label: String(cfg?.branch_label || ""),
    hero_headline: String(cfg?.hero_headline || ""),
    hero_text: String(cfg?.hero_text || ""),
    about_intro: String(cfg?.about_intro || ""),
    purpose_title: String(cfg?.purpose_title || ""),
    about_title: String(cfg?.about_title || ""),
    join_title: String(cfg?.join_title || ""),
    bulletin_title: String(cfg?.bulletin_title || ""),
    events_title: String(cfg?.events_title || ""),
    contact_title: String(cfg?.contact_title || ""),
    join_intro: String(cfg?.join_intro || ""),
    contact_intro: String(cfg?.contact_intro || ""),
    events_intro: String(cfg?.events_intro || ""),
    font_family: String(cfg?.font_family || cfg?.fontFamily || "system"),
    accent_color: String(cfg?.accent_color || "#6d5efc"),
    theme_mode: String(cfg?.theme_mode || "light"),
    website_link: cfg?.website_link || null,
    meeting_rsvp_url: String(cfg?.meeting_rsvp_url || ""),
    what_we_do: Array.isArray(cfg?.what_we_do) ? cfg.what_we_do : [],
    site_purpose_items: Array.isArray(cfg?.site_purpose_items) ? cfg.site_purpose_items : [],
    join_cards: Array.isArray(cfg?.join_cards) ? cfg.join_cards : [],
    events_items: Array.isArray(cfg?.events_items) ? cfg.events_items : [],
    contact_card_title: String(cfg?.contact_card_title || ""),
    contact_card_body: String(cfg?.contact_card_body || ""),
    member_access_title: String(cfg?.member_access_title || ""),
    member_access_body: String(cfg?.member_access_body || ""),
    membership_title: String(cfg?.membership_title || ""),
    membership_intro: String(cfg?.membership_intro || ""),
    membership_details_title: String(cfg?.membership_details_title || ""),
    membership_details_body: String(cfg?.membership_details_body || ""),
    membership_includes_title: String(cfg?.membership_includes_title || ""),
    membership_includes_items: Array.isArray(cfg?.membership_includes_items) ? cfg.membership_includes_items : [],
    membership_dues_title: String(cfg?.membership_dues_title || ""),
    membership_dues_items: Array.isArray(cfg?.membership_dues_items) ? cfg.membership_dues_items : [],
    membership_cta_title: String(cfg?.membership_cta_title || ""),
    membership_cta_body: String(cfg?.membership_cta_body || ""),
    membership_poster_url: String(cfg?.membership_poster_url || ""),
    primary_actions: Array.isArray(cfg?.primary_actions) ? cfg.primary_actions : [],
    get_involved_links: Array.isArray(cfg?.get_involved_links) ? cfg.get_involved_links : [],
  }

  return Response.json({ ok: true, orgId: resolvedOrgId, public: cleaned })
}

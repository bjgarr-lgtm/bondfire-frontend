import {
  slugify,
  uniqueSlug,
  getPublicCfg,
  setPublicCfg,
  setSlugMapping,
  removeSlugMapping,
} from "../../../_lib/publicPageStore.js";

function authOk(env, request) {
  if (env.BF_WRITE_LOCKED === "true") {
    const auth = request.headers.get("authorization") || "";
    return auth.startsWith("Bearer ");
  }
  return true;
}

function cleanLink(value) {
  if (!value || typeof value !== "object") return null;
  const label = String(value.label || value.text || "").trim();
  const url = String(value.url || "").trim();
  if (!label || !url) return null;
  return { label, url };
}

function cleanLinks(arr, limit) {
  return Array.isArray(arr)
    ? arr.map(cleanLink).filter(Boolean).slice(0, limit)
    : [];
}

function cleanStrings(arr, limit) {
  return Array.isArray(arr)
    ? arr.map((s) => String(s || "").trim()).filter(Boolean).slice(0, limit)
    : [];
}

function cleanJoinCards(arr) {
  return Array.isArray(arr)
    ? arr.slice(0, 6).map((item) => ({
        title: String(item?.title || "").trim(),
        body: String(item?.body || "").trim(),
      }))
    : [];
}

function normalizeSavedCfg(prev, body, slug) {
  return {
    enabled: true,
    newsletter_enabled: !!body.newsletter_enabled,
    pledges_enabled: prev?.pledges_enabled !== false,
    show_action_strip: body.show_action_strip !== false,
    show_needs: body.show_needs !== false,
    show_meetings: body.show_meetings !== false,
    show_what_we_do: body.show_what_we_do !== false,
    show_get_involved: !!body.show_get_involved,
    show_newsletter_card: !!body.show_newsletter_card,
    show_website_button: !!body.show_website_button,
    slug: String(slug || prev?.slug || ""),
    title: String(body.title || body.hero_headline || "").trim(),
    location: String(body.location || body.branch_label || "").trim(),
    about: String(body.about || body.hero_text || "").trim(),
    branch_label: String(body.branch_label || body.location || "").trim(),
    hero_headline: String(body.hero_headline || body.title || "").trim(),
    hero_text: String(body.hero_text || body.about || "").trim(),
    about_intro: String(body.about_intro || "").trim(),
    purpose_title: String(body.purpose_title || prev?.purpose_title || "").trim(),
    about_title: String(body.about_title || prev?.about_title || "").trim(),
    join_title: String(body.join_title || prev?.join_title || "").trim(),
    bulletin_title: String(body.bulletin_title || prev?.bulletin_title || "").trim(),
    events_title: String(body.events_title || prev?.events_title || "").trim(),
    contact_title: String(body.contact_title || prev?.contact_title || "").trim(),
    about_card_title: String(body.about_card_title || prev?.about_card_title || "").trim(),
    about_card_body: String(body.about_card_body || prev?.about_card_body || "").trim(),
    location_card_title: String(body.location_card_title || prev?.location_card_title || "").trim(),
    location_card_body: String(body.location_card_body || prev?.location_card_body || "").trim(),
    join_intro: String(body.join_intro || "").trim(),
    contact_intro: String(body.contact_intro || "").trim(),
    events_intro: String(body.events_intro || "").trim(),
    hero_image_url: String(body.hero_image_url || prev?.hero_image_url || "").trim(),
    font_family: String(body.font_family || body.fontFamily || prev?.font_family || prev?.fontFamily || "system").trim(),
    accent_color: String(body.accent_color || "#6d5efc").trim(),
    theme_mode: "light",
    website_link: cleanLink(body.website_link),
    meeting_rsvp_url: String(body.meeting_rsvp_url || "").trim(),
    what_we_do: cleanStrings(body.what_we_do, 12),
    site_purpose_items: cleanStrings(body.site_purpose_items, 8),
    join_cards: cleanJoinCards(body.join_cards),
    events_items: cleanStrings(body.events_items, 8),
    contact_card_title: String(body.contact_card_title || "").trim(),
    contact_card_body: String(body.contact_card_body || "").trim(),
    member_access_title: String(body.member_access_title || "").trim(),
    member_access_body: String(body.member_access_body || "").trim(),
    membership_title: String(body.membership_title || prev?.membership_title || "").trim(),
    membership_intro: String(body.membership_intro || prev?.membership_intro || "").trim(),
    membership_details_title: String(body.membership_details_title || prev?.membership_details_title || "").trim(),
    membership_details_body: String(body.membership_details_body || prev?.membership_details_body || "").trim(),
    membership_includes_title: String(body.membership_includes_title || prev?.membership_includes_title || "").trim(),
    membership_includes_items: cleanStrings(body.membership_includes_items, 12),
    membership_dues_title: String(body.membership_dues_title || prev?.membership_dues_title || "").trim(),
    membership_dues_items: cleanStrings(body.membership_dues_items, 12),
    membership_cta_title: String(body.membership_cta_title || prev?.membership_cta_title || "").trim(),
    membership_cta_body: String(body.membership_cta_body || prev?.membership_cta_body || "").trim(),
    membership_poster_url: String(body.membership_poster_url || prev?.membership_poster_url || "").trim(),
    primary_actions: cleanLinks(body.primary_actions, 3),
    get_involved_links: cleanLinks(body.get_involved_links, 4),
  };
}

export async function onRequestPost({ env, request, params }) {
  if (!authOk(env, request)) {
    return Response.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    const orgId = String(params.orgId || "").trim();
    const body = await request.json().catch(() => ({}));
    const prev = await getPublicCfg(env, orgId);

    let newSlug = String(prev?.slug || "").trim();

    if (typeof body.slug === "string" && body.slug.trim()) {
      const base = slugify(body.slug);
      if (base) {
        if (prev?.slug) {
          const mappedSlug = String(prev.slug || "").trim();
          if (mappedSlug) await removeSlugMapping(env, mappedSlug);
        }
        newSlug = await uniqueSlug(env, base, orgId);
        await setSlugMapping(env, newSlug, orgId);
      }
    } else if (!newSlug) {
      const base = slugify(body.hero_headline || body.title || orgId || "org") || "org";
      newSlug = await uniqueSlug(env, base, orgId);
      await setSlugMapping(env, newSlug, orgId);
    }

    const cleaned = normalizeSavedCfg(prev, body, newSlug);
    await setPublicCfg(env, orgId, cleaned);

    const persisted = await getPublicCfg(env, orgId);
    const publicCfg = {
      ...cleaned,
      ...(persisted && typeof persisted === "object" ? persisted : {}),
      font_family: String(
        persisted?.font_family ||
        persisted?.fontFamily ||
        cleaned?.font_family ||
        "system"
      ).trim(),
    };

    return Response.json({ ok: true, public: publicCfg });
  } catch (err) {
    console.error("public/save failed", err);
    return Response.json({ ok: false, error: "INTERNAL", detail: String(err?.message || err || "") }, { status: 500 });
  }
}

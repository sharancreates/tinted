"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Page } from "@/components/ui/Page";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { Orb } from "@/components/ui/Orb";
import { FIELD, FIELD_LABEL, TEXTAREA, CHECKBOX } from "@/components/ui/field";
import { SignInGate } from "@/components/vanity/SignInGate";
import { useAuth } from "@/hooks/useAuth";
import { createClient } from "@/lib/supabase";
import { ToneRibbon, MONK_TONES } from "@/components/ui/ToneRibbon";
import { getMyPublicProfile, listInventory, savePublicProfile, type InventoryItem, type PublicProfile } from "@/lib/vanity";
import { loadToneProfile, TONE_EVENT } from "@/lib/toneProfile";

export default function ProfilePage() {
  const { user, loading } = useAuth();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [shelfItems, setShelfItems] = useState<InventoryItem[]>([]);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [tone, setTone] = useState<number | null>(null);
  const [undertone, setUndertone] = useState("");
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const [saved, items] = await Promise.all([getMyPublicProfile(), listInventory()]);
      setProfile(saved);
      setShelfItems(items);
      setUsername(saved?.username ?? "");
      setDisplayName(saved?.display_name ?? user.user_metadata?.name ?? "");
      setBio(saved?.bio ?? "");
      setIsPublic(saved?.is_public ?? false);
      setTone(saved?.monk_tone ?? null);
      setUndertone(saved?.undertone ?? "");
    } catch { setError("Couldn't load public profile settings. Apply the Supabase migrations and try again."); }
    finally { setLoadingProfile(false); }
  }, [user]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const updateTone = () => {
      const saved = loadToneProfile();
      if (saved) { setTone(saved.mstLevel); setUndertone(saved.undertone); }
    };
    updateTone();
    window.addEventListener(TONE_EVENT, updateTone);
    return () => window.removeEventListener(TONE_EVENT, updateTone);
  }, []);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    setError("");
    try {
      const saved = await savePublicProfile({
        user_id: user.id,
        username: username.trim().toLowerCase(),
        display_name: displayName.trim(),
        bio: bio.trim() || null,
        monk_tone: tone,
        undertone: undertone.trim() || null,
        is_public: isPublic,
      });
      setProfile(saved);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "";
      setError(/duplicate|unique/i.test(message) ? "That username is already in use." : "Couldn't save these settings. Check the username and try again.");
    } finally { setSaving(false); }
  };

  const shareUrl = profile?.is_public && typeof window !== "undefined" ? `${window.location.origin}/u/${profile.username}` : "";
  const shelfSummary = [...shelfItems.reduce((counts, item) => counts.set(item.category || "other", (counts.get(item.category || "other") ?? 0) + 1), new Map<string, number>()).entries()];

  if (loading || (user && loadingProfile)) {
    return (
      <Page width="list">
        <div className="h-10 w-72 animate-pulse rounded-pill bg-raised" aria-busy="true" />
        <div className="mt-8 h-96 animate-pulse rounded-card bg-raised" />
      </Page>
    );
  }

  if (!user) {
    return (
      <Page width="grid">
        <PageHeader
          label="Profile"
          title="A shelf worth sharing."
          description="Choose what appears on your public page. Everything stays private until you say otherwise."
        />
        <SignInGate
          title="Sign in to set up your profile"
          reason="Your profile shows the products and routines you choose, with your tone reading if you want it there."
          cta="Sign in to set up a profile"
          aura="match"
          perks={[
            ["Your own link", "tinted2.vercel.app/u/your-name"],
            ["You pick what shows", "Only products and routines you mark public."],
            ["Friends can save picks", "Anything on your page can go on their wishlist."],
          ]}
        >
          {null}
        </SignInGate>
      </Page>
    );
  }

  return (
    <Page width="list">
      <PageHeader
        label="Profile settings"
        title="A shelf worth sharing."
        description="Your profile is private until you make it public. Only products and routines you mark public will appear."
      />

      <section className="glass rounded-card p-5 md:p-8">
        <div className="flex flex-wrap items-center gap-4 border-b border-line-strong pb-6">
          <Orb tone={tone ? MONK_TONES[tone - 1] : undefined} size="md" />
          <div className="min-w-0 flex-1">
            <p className="text-label uppercase text-text-muted">Your shelf</p>
            <p className="text-title font-semibold text-text">{shelfItems.length} {shelfItems.length === 1 ? "product" : "products"}</p>
          </div>
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            {shelfSummary.length
              ? shelfSummary.map(([category, count]) => (
                  <span key={category} className="rounded-pill border border-white bg-white/70 px-3 py-1 text-small capitalize text-text-soft">
                    {category} · {count}
                  </span>
                ))
              : <span className="text-small text-text-muted">Your shelf is empty.</span>}
          </div>
        </div>

        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <label className="block">
            <span className={FIELD_LABEL}>Username</span>
            <span className="relative mt-2 block">
              <span aria-hidden="true" className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-small text-text-muted">@</span>
              <input
                className={`${FIELD} pl-9`}
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                minLength={3}
                maxLength={30}
                placeholder="your-name"
              />
            </span>
          </label>
          <label className="block">
            <span className={FIELD_LABEL}>Display name</span>
            <input className={`mt-2 ${FIELD}`} value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={80} />
          </label>
        </div>

        <label className="mt-5 block">
          <span className={FIELD_LABEL}>Bio</span>
          <textarea className={`mt-2 ${TEXTAREA}`} value={bio} onChange={(e) => setBio(e.target.value)} maxLength={160} placeholder="A little about your beauty routine" />
          <span className="mt-1 block text-right text-small tabular-nums text-text-muted">{bio.length}/160</span>
        </label>

        <div className="mt-5 border-t border-line-strong pt-6">
          <p className={FIELD_LABEL}>Monk Skin Tone</p>
          {tone ? (
            <>
              <div className="mt-3"><ToneRibbon active={tone} size="sm" label={`Monk Skin Tone level ${tone}`} /></div>
              <p className="mt-2 text-small text-text-soft">Level {tone}{undertone ? ` · ${undertone} undertone` : ""}</p>
            </>
          ) : (
            <p className="mt-2 text-small text-text-muted">
              No tone reading saved on this device.{" "}
              <Link href="/match" className="font-medium text-accent underline-offset-4 hover:underline">Find your shade</Link>
            </p>
          )}
          <p className="mt-1 text-small text-text-muted">Copied from your latest analysis when you save.</p>
        </div>

        <label className="mt-6 flex min-h-11 cursor-pointer items-center gap-3 rounded-pill border border-white bg-white/60 px-5 text-small font-medium text-text">
          <input type="checkbox" className={CHECKBOX} checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
          Make my profile public
        </label>

        {error && <p className="mt-3 text-small text-danger" role="alert">{error}</p>}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button onClick={() => void save()} disabled={saving || !username.trim() || !displayName.trim()}>
            {saving ? "Saving…" : "Save profile"}
          </Button>
          {shareUrl && (
            <>
              <Button variant="secondary" onClick={async () => { await navigator.clipboard.writeText(shareUrl); setCopied(true); }}>
                {copied ? "Copied" : "Copy link"}
              </Button>
              <Link href={`/u/${profile?.username}`} className="inline-flex min-h-11 items-center px-2 text-small font-medium text-accent underline-offset-4 hover:underline">
                Preview profile
              </Link>
            </>
          )}
        </div>
      </section>
      <p className="mt-5 text-small text-text-muted">Your inventory notes, purchase dates, prices and unlisted products stay private.</p>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-line-strong pt-6">
        <p className="min-w-0 truncate text-small text-text-muted">Signed in as {user.email}</p>
        <Button variant="secondary" size="sm" onClick={() => void createClient().auth.signOut()}>Sign out</Button>
      </div>
    </Page>
  );
}

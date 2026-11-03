"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Page } from "@/components/ui/Page";
import { Button } from "@/components/ui/Button";
import { AuthModal } from "@/components/auth/AuthModal";
import { useAuth } from "@/hooks/useAuth";
import { ToneRibbon } from "@/components/ui/ToneRibbon";
import { getMyPublicProfile, listInventory, savePublicProfile, type InventoryItem, type PublicProfile } from "@/lib/vanity";
import { loadToneProfile, TONE_EVENT } from "@/lib/toneProfile";

const FIELD = "min-h-11 w-full rounded-card border border-line bg-surface px-3 text-small text-text focus:border-accent focus:outline-none";

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
  const [authOpen, setAuthOpen] = useState(false);
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

  if (loading || (user && loadingProfile)) return <Page width="prose"><p className="text-text-muted">Loading profile settings…</p></Page>;
  if (!user) return <Page width="prose"><h1 className="font-display text-display text-text">Your public profile</h1><p className="mt-3 text-text-soft">Sign in to choose what appears on your profile.</p><Button className="mt-5" onClick={() => setAuthOpen(true)}>Sign in</Button><AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} /></Page>;

  return <Page width="prose">
    <header className="mb-8"><p className="text-label uppercase text-accent">Profile settings</p><h1 className="mt-2 font-display text-display text-text">A shelf worth sharing.</h1><p className="mt-3 text-text-soft">Your profile is private until you make it public. Only products and routines you mark public will appear.</p></header>
    <section className="rounded-card border border-line bg-surface p-5 sm:p-7">
      <div className="mb-5 border-b border-line pb-5"><p className="text-label uppercase text-text-muted">Your shelf</p><p className="mt-1 font-display text-title text-text">{shelfItems.length} products</p><div className="mt-2 flex flex-wrap gap-2">{shelfSummary.length ? shelfSummary.map(([category, count]) => <span key={category} className="rounded-pill border border-line px-3 py-1 text-label uppercase text-text-soft">{category} · {count}</span>) : <span className="text-small text-text-muted">Your shelf is empty.</span>}</div></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-label uppercase text-text-muted">Username
          <div className="mt-1 flex items-center gap-2"><span className="text-small text-text-muted">@</span><input className={FIELD} value={username} onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} minLength={3} maxLength={30} placeholder="your-name" /></div>
        </label>
        <label className="text-label uppercase text-text-muted">Display name
          <input className={`mt-1 ${FIELD}`} value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={80} />
        </label>
      </div>
      <label className="mt-4 block text-label uppercase text-text-muted">Bio
        <textarea className={`mt-1 min-h-24 ${FIELD} py-2`} value={bio} onChange={(e) => setBio(e.target.value)} maxLength={160} placeholder="A little about your beauty routine" />
        <span className="mt-1 block text-right text-label text-text-muted">{bio.length}/160</span>
      </label>
      <div className="mt-5 border-t border-line pt-5">
        <p className="text-label uppercase text-text-muted">Monk Skin Tone</p>
        {tone ? <><div className="mt-3"><ToneRibbon active={tone} size="sm" label={`Monk Skin Tone level ${tone}`} /></div><p className="mt-2 text-small text-text-soft">Level {tone}{undertone ? ` · ${undertone} undertone` : ""}</p></> : <p className="mt-2 text-small text-text-muted">No tone reading saved on this device.</p>}
        <p className="mt-1 text-label text-text-muted">This reading is copied from your latest analysis when you save this profile.</p>
      </div>
      <label className="mt-5 flex min-h-11 items-center gap-2 text-small text-text-soft"><input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />Make my profile public</label>
      {error && <p className="mt-3 text-small text-danger" role="alert">{error}</p>}
      <div className="mt-5 flex flex-wrap gap-3"><Button onClick={() => void save()} disabled={saving || !username.trim() || !displayName.trim()}>{saving ? "Saving…" : "Save profile"}</Button>
        {shareUrl && <><Button variant="secondary" onClick={async () => { await navigator.clipboard.writeText(shareUrl); setCopied(true); }}> {copied ? "Copied" : "Copy link"}</Button><Link href={`/u/${profile?.username}`} className="self-center text-small text-accent underline">Preview profile</Link></>}
      </div>
    </section>
    <p className="mt-5 text-small text-text-muted">Your inventory notes, purchase dates, prices, and unlisted products stay private.</p>
  </Page>;
}

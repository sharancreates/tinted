"use client";

import { useState } from "react";
import { AuthModal } from "@/components/auth/AuthModal";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/Button";
import { addInventoryItem } from "@/lib/vanity";
import { fetchProductImages, imageKey } from "@/lib/api";

export function AddRecommendationToShelf({
  brand,
  product,
  shade,
  category,
  imageUrl,
}: {
  brand: string;
  product: string;
  shade?: string | null;
  category: string;
  imageUrl?: string | null;
}) {
  const { user, loading } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState(false);

  const add = async () => {
    if (!user) {
      setAuthOpen(true);
      return;
    }
    setSaving(true);
    setError(false);
    try {
      let resolvedImage = imageUrl ?? null;
      if (!resolvedImage) {
        try {
          const response = await fetchProductImages([{ brand, product }]);
          resolvedImage = response.images[imageKey(brand, product)] ?? null;
        } catch {
          // A missing product photo does not block saving the recommendation.
        }
      }
      await addInventoryItem({
        brand,
        product,
        shade: shade || null,
        category: category.toLowerCase().replaceAll(" ", "_"),
        hex: null,
        url: null,
        price_cents: null,
        notes: null,
        image_url: resolvedImage,
        status: "using",
      }, user.id);
      setAdded(true);
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  };

  return <>
    <Button type="button" size="sm" variant={added ? "secondary" : "ghost"} disabled={loading || saving || added} onClick={() => void add()} className="w-full">
      {added ? "Added to Shelf" : saving ? "Adding…" : "Add to Shelf"}
    </Button>
    {error && <p className="mt-1 text-label text-danger" role="alert">Couldn&apos;t add. Try again.</p>}
    <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} />
  </>;
}

import { createClient } from "@/lib/supabase";
import { deltaEHex, describeDeltaE } from "@/lib/color";

/** A row of public.product_shades. */
export type ProductShade = {
  id: string;
  brand: string;
  product_name: string;
  shade_name: string;
  shade_hex: string;
  undertone: string | null;
};

export type Product = { brand: string; product_name: string; shades: number };

export type ShadeMatch = ProductShade & { deltaE: number; description: string };

/**
 * Every input method (typed search, a product photo, a barcode) ends here:
 * free text in, catalogue products out. Each word must appear in the brand
 * or the product name, so "fenty soft matte" and "pro filtr" both land.
 */
export async function findProducts(query: string): Promise<Product[]> {
  const words = toWords(query);
  if (words.length === 0) return [];
  const found = await queryProducts(words);
  // Names read from a photo or a barcode database carry extra words ("New
  // York", the shade). If the full name finds nothing, try its first two.
  if (found.length === 0 && words.length > 2) return queryProducts(words.slice(0, 2));
  return found;
}

function toWords(query: string): string[] {
  return query
    .toLowerCase()
    .replace(/['’]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 1)
    .slice(0, 6);
}

async function queryProducts(words: string[]): Promise<Product[]> {
  let q = createClient().from("product_shades").select("brand, product_name");
  for (const w of words) {
    // A word matches brand or product. Apostrophes are stripped from the
    // query, so match the stored names loosely as well ("filtr" ~ "filt'r").
    const loose = w.split("").join("%");
    q = q.or(`brand.ilike.%${w}%,product_name.ilike.%${loose}%`);
  }
  const { data, error } = await q.limit(500);
  if (error) throw error;

  const counts = new Map<string, Product>();
  for (const row of data ?? []) {
    const key = `${row.brand}\u0000${row.product_name}`;
    const hit = counts.get(key) ?? { brand: row.brand, product_name: row.product_name, shades: 0 };
    hit.shades += 1;
    counts.set(key, hit);
  }
  return [...counts.values()].sort((a, b) => a.brand.localeCompare(b.brand) || a.product_name.localeCompare(b.product_name));
}

export async function shadesFor(product: Pick<Product, "brand" | "product_name">): Promise<ProductShade[]> {
  const { data, error } = await createClient()
    .from("product_shades")
    .select("id, brand, product_name, shade_name, shade_hex, undertone")
    .eq("brand", product.brand)
    .eq("product_name", product.product_name);
  if (error) throw error;
  return data ?? [];
}

/**
 * Closest shades to a skin colour by CIEDE2000, best first. When the user's
 * undertone is known, a shade of a different undertone pays a small penalty
 * in the ranking only; the ΔE shown is always the plain colour distance.
 */
export function rankShades(shades: ProductShade[], skinHex: string, undertone?: string | null): ShadeMatch[] {
  const want = undertone?.toLowerCase();
  return shades
    .map((s) => {
      const deltaE = deltaEHex(skinHex, s.shade_hex);
      const mismatch = want && s.undertone && s.undertone !== want && s.undertone !== "neutral" && want !== "neutral";
      return { ...s, deltaE, description: describeDeltaE(deltaE), rank: deltaE + (mismatch ? 1.5 : 0) };
    })
    .sort((a, b) => a.rank - b.rank)
    .map(({ rank: _rank, ...match }) => match);
}

/** "Brand Product", without doubling a brand the product name already starts with. */
export function productQuery(brand: string, productName: string): string {
  const b = brand.trim();
  const p = productName.trim();
  return b && !p.toLowerCase().startsWith(b.toLowerCase()) ? `${b} ${p}`.trim() : p || b;
}

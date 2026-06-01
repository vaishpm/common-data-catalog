import publicCatalog from "@/data/public-catalog.json";
import { catalogAssets, type CatalogAsset } from "@/lib/catalog";

type PublicCatalogSnapshot = {
  generatedAt?: string;
  source?: {
    workgroupName?: string;
    database?: string;
    schemas?: string[];
  };
  assets?: CatalogAsset[];
};

const snapshot = publicCatalog as PublicCatalogSnapshot;

export function loadPublicCatalog() {
  const assets = snapshot.assets && snapshot.assets.length > 0 ? snapshot.assets : catalogAssets;
  const source = snapshot.source;

  return {
    assets,
    source: snapshot.assets && snapshot.assets.length > 0 ? "snapshot" : "seed",
    message:
      snapshot.assets && snapshot.assets.length > 0
        ? `Public snapshot generated ${formatGeneratedAt(snapshot.generatedAt)} from ${source?.database ?? "Redshift"} schemas ${(source?.schemas ?? []).join(", ")}.`
        : "Using seed catalog data because no public catalog snapshot was found.",
  };
}

function formatGeneratedAt(value?: string) {
  if (!value) return "at an unknown time";

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

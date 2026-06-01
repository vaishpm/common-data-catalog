"use client";

import { useMemo, useState } from "react";
import type { CatalogAsset } from "@/lib/catalog";

type CatalogBrowserProps = {
  assets: CatalogAsset[];
  domains: string[];
};

const statusStyles: Record<CatalogAsset["certification"], string> = {
  Certified: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  Candidate: "bg-blue-50 text-blue-700 ring-blue-200",
  "Needs review": "bg-amber-50 text-amber-700 ring-amber-200",
  Deprecated: "bg-rose-50 text-rose-700 ring-rose-200",
};

export function CatalogBrowser({ assets, domains }: CatalogBrowserProps) {
  const [query, setQuery] = useState("");
  const [domain, setDomain] = useState("All");
  const [selectedAssetId, setSelectedAssetId] = useState(assets[0]?.id ?? "");

  const filteredAssets = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return assets.filter((asset) => {
      const matchesDomain = domain === "All" || asset.domain === domain;
      const searchableText = [
        asset.name,
        asset.schema,
        asset.database,
        asset.description,
        asset.tags.join(" "),
        asset.columns.map((column) => `${column.name} ${column.description}`).join(" "),
      ]
        .join(" ")
        .toLowerCase();

      return matchesDomain && (!normalizedQuery || searchableText.includes(normalizedQuery));
    });
  }, [assets, domain, query]);

  const selectedAsset =
    filteredAssets.find((asset) => asset.id === selectedAssetId) ?? filteredAssets[0] ?? assets[0];

  const assetsBySchema = useMemo(() => {
    return filteredAssets.reduce<Record<string, CatalogAsset[]>>((groups, asset) => {
      const key = `${asset.database}.${asset.schema}`;
      groups[key] = [...(groups[key] ?? []), asset];
      return groups;
    }, {});
  }, [filteredAssets]);

  return (
    <section className="grid gap-6 lg:grid-cols-[minmax(280px,0.75fr)_minmax(0,1.25fr)]">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="sr-only" htmlFor="catalog-search">
            Search datasets
          </label>
          <input
            id="catalog-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search tables, columns, tags..."
            className="min-h-11 flex-1 rounded-2xl border border-slate-200 px-4 text-sm outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
          />
          <label className="sr-only" htmlFor="domain-filter">
            Filter by domain
          </label>
          <select
            id="domain-filter"
            value={domain}
            onChange={(event) => setDomain(event.target.value)}
            className="min-h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
          >
            <option>All</option>
            {domains.map((domainName) => (
              <option key={domainName}>{domainName}</option>
            ))}
          </select>
        </div>

        <div className="mt-5">
          <div className="mb-3 flex items-center justify-between text-sm text-slate-500">
            <span className="font-medium text-slate-700">Table tree</span>
            <span>{filteredAssets.length} tables</span>
          </div>

          <div className="max-h-[760px] space-y-4 overflow-auto pr-1">
            {Object.entries(assetsBySchema).map(([schemaKey, schemaAssets]) => (
              <div key={schemaKey} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-900 text-xs font-semibold text-white">
                    {schemaAssets.length}
                  </span>
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Schema</p>
                    <h2 className="font-semibold text-slate-950">{schemaKey}</h2>
                  </div>
                </div>

                <div className="mt-2 space-y-1">
                  {schemaAssets.map((asset) => (
                    <button
                      key={asset.id}
                      type="button"
                      onClick={() => setSelectedAssetId(asset.id)}
                      className={`group flex w-full items-start gap-2 rounded-xl px-3 py-2 text-left text-sm transition ${
                        selectedAsset?.id === asset.id
                          ? "bg-slate-950 text-white shadow-sm"
                          : "text-slate-700 hover:bg-white hover:text-slate-950"
                      }`}
                    >
                      <span
                        className={`mt-1 h-2 w-2 rounded-full ${
                          selectedAsset?.id === asset.id ? "bg-cyan-300" : "bg-slate-300 group-hover:bg-slate-500"
                        }`}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{asset.name}</span>
                        <span
                          className={`mt-0.5 block text-xs ${
                            selectedAsset?.id === asset.id ? "text-slate-300" : "text-slate-500"
                          }`}
                        >
                          {asset.type} · {asset.columns.length} columns
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}

          {filteredAssets.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
              No datasets match that search.
            </div>
          ) : null}
          </div>
        </div>
      </div>

      {selectedAsset ? (
        <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-100 pb-6 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">
                {selectedAsset.database}.{selectedAsset.schema}
              </p>
              <h2 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
                {selectedAsset.name}
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                {selectedAsset.description}
              </p>
            </div>
            <span
              className={`w-fit rounded-full px-3 py-1.5 text-sm font-medium ring-1 ${
                statusStyles[selectedAsset.certification]
              }`}
            >
              {selectedAsset.certification}
            </span>
          </div>

          <dl className="mt-6 grid gap-4 sm:grid-cols-2">
            {[
              ["Refresh cadence", selectedAsset.refreshCadence],
              ["Freshness", selectedAsset.freshness],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl bg-slate-50 p-4">
                <dt className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</dt>
                <dd className="mt-2 font-medium text-slate-900">{value}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-8">
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
              Columns
            </h3>
            <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200">
              {selectedAsset.columns.map((column) => (
                <div
                  key={column.name}
                  className="grid gap-3 border-b border-slate-100 p-4 last:border-0 md:grid-cols-[0.8fr_0.6fr_1.4fr]"
                >
                  <div>
                    <p className="font-medium text-slate-950">{column.name}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {column.nullable ? "Nullable" : "Required"}
                    </p>
                  </div>
                  <code className="h-fit rounded-lg bg-slate-100 px-2 py-1 text-xs text-slate-700">
                    {column.type}
                  </code>
                  <div>
                    <p className="text-sm leading-6 text-slate-600">{column.description}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {column.tags.map((tag) => (
                        <span key={tag} className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8">
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
              Known consumers
            </h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {selectedAsset.consumers.map((consumer) => (
                <span key={consumer} className="rounded-full bg-slate-100 px-3 py-1.5 text-sm text-slate-700">
                  {consumer}
                </span>
              ))}
            </div>
          </div>
        </article>
      ) : null}
    </section>
  );
}

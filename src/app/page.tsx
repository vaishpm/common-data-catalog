import { CatalogBrowser } from "@/components/catalog-browser";
import { getCatalogSummary, getDomains } from "@/lib/catalog";
import { loadPublicCatalog } from "@/lib/public-catalog";

export default function Home() {
  const { assets, source, message } = loadPublicCatalog();
  const domains = getDomains(assets);
  const summaryStats = getCatalogSummary(assets);

  return (
    <main className="min-h-screen px-5 py-8 sm:px-8 lg:px-12">
      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        <header className="rounded-[2rem] bg-slate-950 px-6 py-8 text-white shadow-xl shadow-slate-200 sm:px-8 lg:px-10">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-sm font-medium uppercase tracking-[0.22em] text-cyan-200">
                Redshift Self-Service
              </p>
              <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
                Common Data Catalog
              </h1>
              <p className="mt-4 text-base leading-7 text-slate-300 sm:text-lg">
                Browse trusted datasets, understand column meaning, find owners, and
                see freshness before using a table in analysis or reporting.
              </p>
              <p className="mt-4 rounded-2xl bg-white/10 px-4 py-3 text-sm text-slate-200 ring-1 ring-white/10">
                Source: <span className="font-semibold">{source === "snapshot" ? "Public metadata snapshot" : "Seed catalog"}</span>.{" "}
                {message}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:min-w-[520px]">
              {[
                ["Assets", summaryStats.assets],
                ["Columns", summaryStats.columns],
                ["Certified", summaryStats.certified],
                ["Owners", summaryStats.owners],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl bg-white/10 p-4 ring-1 ring-white/10">
                  <p className="text-2xl font-semibold">{value}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-300">
                    {label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </header>

        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              title: "Business-first definitions",
              body: "Each asset starts with a plain-English description, domain, ownership, and consumer context.",
            },
            {
              title: "Trust signals",
              body: "Certification, freshness, tags, and refresh cadence help users choose the right source quickly.",
            },
            {
              title: "Column-level dictionary",
              body: "Field descriptions, types, nullability, and tags make the catalog useful beyond table names.",
            },
          ].map((card) => (
            <section key={card.title} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="font-semibold text-slate-950">{card.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{card.body}</p>
            </section>
          ))}
        </div>

        <CatalogBrowser assets={assets} domains={domains} />
      </div>
    </main>
  );
}

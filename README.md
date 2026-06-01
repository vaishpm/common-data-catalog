# Common Data Catalog

A self-service data catalog MVP for Redshift users. The app lets users browse datasets, search by table/column/owner/tag, inspect column definitions, and see trust signals such as certification and freshness.

## Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Current MVP

- Searchable catalog browser built with Next.js, TypeScript, and Tailwind CSS.
- Dataset detail panel with owners, refresh cadence, freshness, consumers, and column-level dictionary.
- Public catalog snapshot in `src/data/public-catalog.json` so the deployed app does not need AWS credentials.
- Snapshot export script for `prd.reporting`, `prd.companies`, `prd.supplier_offers`, `prd.ontology`, `prd.metrics_layer`, and `prd.references`.
- Redshift DDL in `redshift/catalog_schema.sql` for storing curated catalog metadata.
- Redshift metadata extraction SQL in `redshift/metadata_extract.sql` using `pg_catalog`.

## Public Deployment

The public app reads `src/data/public-catalog.json`. It does not connect to Redshift at runtime.

Refresh the public catalog snapshot locally:

```bash
npm run export:catalog
```

Build the public site:

```bash
npm run build
```

Deploy options:

- Vercel: push this repo to GitHub, import it in Vercel, and deploy.
- AWS Amplify: connect the repo and use `npm run build`.
- Private/internal hosting: run `npm run build && npm run start`.

Do not deploy `.env.local` or local AWS credentials. The generated JSON snapshot is the public artifact.

## Redshift Setup

Refresh AWS SSO before inspecting live Redshift metadata:

```bash
aws sso login
```

If you use a named profile:

```bash
AWS_PROFILE=<profile-name> aws sso login
```

The discovered Redshift Serverless workgroup is:

```text
production-workgroup
```

To export metadata, `.env.local` or the `export:catalog` script should use:

```bash
REDSHIFT_ENABLE_LIVE_CATALOG=true
REDSHIFT_WORKGROUP_NAME=production-workgroup
REDSHIFT_DATABASE_NAME=prd
REDSHIFT_SCHEMA_NAMES=reporting,companies,supplier_offers,ontology,metrics_layer,references
AWS_REGION=eu-central-1
```

The export reads production metadata from the `reporting`, `companies`, `supplier_offers`, `ontology`, `metrics_layer`, and `references` schemas using Redshift system catalog tables. In this environment, those schemas are visible through `pg_catalog` even though `svv_all_tables` and Data API `list-tables` return no rows.

## Recommended Next Steps

1. Replace the seed records in `src/lib/catalog.ts` with data loaded from `data_catalog.assets` and `data_catalog.columns`.
2. Add an admin/editing workflow for owners to maintain descriptions, tags, and certification status.
3. Add freshness and usage signals from load logs, `svv_table_info`, and query history.
4. Add auth if the catalog should be public only inside the company.

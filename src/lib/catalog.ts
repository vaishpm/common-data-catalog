export type CertificationStatus = "Certified" | "Candidate" | "Needs review" | "Deprecated";

export type CatalogColumn = {
  name: string;
  type: string;
  description: string;
  nullable: boolean;
  tags: string[];
};

export type CatalogAsset = {
  id: string;
  database: string;
  schema: string;
  name: string;
  type: "table" | "view" | "external table";
  domain: string;
  description: string;
  owner: string;
  technicalOwner: string;
  refreshCadence: string;
  freshness: string;
  certification: CertificationStatus;
  tags: string[];
  consumers: string[];
  columns: CatalogColumn[];
};

export const catalogAssets: CatalogAsset[] = [
  {
    id: "analytics.mart_customers",
    database: "analytics",
    schema: "mart",
    name: "customers",
    type: "table",
    domain: "Customer",
    description:
      "One row per active customer account with lifecycle, market, and account ownership attributes.",
    owner: "Customer Analytics",
    technicalOwner: "Data Platform",
    refreshCadence: "Daily at 06:00",
    freshness: "Fresh today",
    certification: "Certified",
    tags: ["gold", "recommended", "pii-reviewed"],
    consumers: ["Customer 360", "Revenue dashboard", "Account health scoring"],
    columns: [
      {
        name: "customer_id",
        type: "varchar",
        description: "Stable customer account identifier used across marts.",
        nullable: false,
        tags: ["primary-key"],
      },
      {
        name: "company_name",
        type: "varchar",
        description: "Current legal or billing company name.",
        nullable: true,
        tags: ["pii"],
      },
      {
        name: "lifecycle_stage",
        type: "varchar",
        description: "Current customer lifecycle stage used by sales and success teams.",
        nullable: false,
        tags: ["business-critical"],
      },
    ],
  },
  {
    id: "analytics.mart_revenue",
    database: "analytics",
    schema: "mart",
    name: "revenue",
    type: "table",
    domain: "Finance",
    description:
      "Recognized revenue facts by customer, product, invoice period, and accounting date.",
    owner: "Finance Analytics",
    technicalOwner: "Analytics Engineering",
    refreshCadence: "Daily at 07:00",
    freshness: "Fresh today",
    certification: "Certified",
    tags: ["gold", "finance-approved"],
    consumers: ["ARR reporting", "Monthly close", "Board metrics"],
    columns: [
      {
        name: "revenue_id",
        type: "varchar",
        description: "Unique revenue line identifier generated from source invoice facts.",
        nullable: false,
        tags: ["primary-key"],
      },
      {
        name: "recognized_amount_eur",
        type: "decimal(18,2)",
        description: "Revenue amount recognized in EUR for the accounting period.",
        nullable: false,
        tags: ["metric-input"],
      },
      {
        name: "accounting_month",
        type: "date",
        description: "Month used for finance close and period-over-period reporting.",
        nullable: false,
        tags: ["time"],
      },
    ],
  },
  {
    id: "raw.salesforce_opportunities",
    database: "analytics",
    schema: "raw",
    name: "salesforce_opportunities",
    type: "table",
    domain: "Sales",
    description:
      "Raw opportunity records synced from Salesforce. Use curated marts for most reporting.",
    owner: "Sales Operations",
    technicalOwner: "Data Ingestion",
    refreshCadence: "Hourly",
    freshness: "Updated 42 minutes ago",
    certification: "Candidate",
    tags: ["raw", "source-system"],
    consumers: ["Pipeline QA", "Sales ops investigations"],
    columns: [
      {
        name: "id",
        type: "varchar",
        description: "Salesforce opportunity identifier.",
        nullable: false,
        tags: ["source-key"],
      },
      {
        name: "amount",
        type: "decimal(18,2)",
        description: "Opportunity amount in source currency.",
        nullable: true,
        tags: ["source-field"],
      },
      {
        name: "stage_name",
        type: "varchar",
        description: "Current Salesforce opportunity stage.",
        nullable: true,
        tags: ["source-field"],
      },
    ],
  },
];

export const domains = Array.from(new Set(catalogAssets.map((asset) => asset.domain))).sort();

export const summaryStats = {
  assets: catalogAssets.length,
  columns: catalogAssets.reduce((total, asset) => total + asset.columns.length, 0),
  certified: catalogAssets.filter((asset) => asset.certification === "Certified").length,
  owners: new Set(catalogAssets.map((asset) => asset.owner)).size,
};

export function getCatalogSummary(assets: CatalogAsset[]) {
  return {
    assets: assets.length,
    columns: assets.reduce((total, asset) => total + asset.columns.length, 0),
    certified: assets.filter((asset) => asset.certification === "Certified").length,
    owners: new Set(assets.map((asset) => asset.owner)).size,
  };
}

export function getDomains(assets: CatalogAsset[]) {
  return Array.from(new Set(assets.map((asset) => asset.domain))).sort();
}

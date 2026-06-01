import {
  DescribeStatementCommand,
  ExecuteStatementCommand,
  GetStatementResultCommand,
  RedshiftDataClient,
  type Field,
} from "@aws-sdk/client-redshift-data";
import { catalogAssets, type CatalogAsset, type CatalogColumn } from "@/lib/catalog";

type CatalogLoadResult = {
  assets: CatalogAsset[];
  source: "seed" | "redshift";
  message: string;
};

type MetadataRow = {
  databaseName: string;
  schemaName: string;
  tableName: string;
  tableType: string;
  assetDescription: string;
  columnName: string;
  ordinalPosition: number;
  dataType: string;
  isNullable: boolean;
  columnDescription: string;
};

function buildMetadataSql(schemaNames: string[]) {
  const schemaFilter = schemaNames.map((schema) => `'${schema.replaceAll("'", "''")}'`).join(", ");

  return `
select
  current_database() as database_name,
  n.nspname as schema_name,
  c.relname as table_name,
  case c.relkind
    when 'r' then 'table'
    when 'v' then 'view'
    when 'm' then 'materialized view'
    else c.relkind::varchar
  end as table_type,
  coalesce(obj_description(c.oid), '') as asset_description,
  a.attname as column_name,
  a.attnum as ordinal_position,
  t.typname as data_type,
  not a.attnotnull as is_nullable,
  coalesce(col_description(c.oid, a.attnum), '') as column_description
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
join pg_attribute a on a.attrelid = c.oid
join pg_type t on t.oid = a.atttypid
where n.nspname in (${schemaFilter})
  and c.relkind in ('r', 'v', 'm')
  and a.attnum > 0
  and not a.attisdropped
order by
  n.nspname,
  c.relname,
  a.attnum
limit 5000
`;
}

export async function loadCatalogAssets(): Promise<CatalogLoadResult> {
  if (process.env.REDSHIFT_ENABLE_LIVE_CATALOG !== "true") {
    return {
      assets: catalogAssets,
      source: "seed",
      message: "Using seed catalog data. Set REDSHIFT_ENABLE_LIVE_CATALOG=true to query Redshift.",
    };
  }

  const workgroupName = process.env.REDSHIFT_WORKGROUP_NAME ?? "production-workgroup";
  const database = process.env.REDSHIFT_DATABASE_NAME;
  const schemaNames = (process.env.REDSHIFT_SCHEMA_NAMES ?? "reporting,companies")
    .split(",")
    .map((schema) => schema.trim())
    .filter(Boolean);

  if (!database) {
    return {
      assets: catalogAssets,
      source: "seed",
      message: "Missing REDSHIFT_DATABASE_NAME, so the app fell back to seed catalog data.",
    };
  }

  try {
    const client = new RedshiftDataClient({
      region: process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? "eu-central-1",
    });
    const rows = await queryRedshiftMetadata(client, workgroupName, database, schemaNames);
    const assets = mapMetadataRowsToAssets(rows);

    return {
      assets: assets.length > 0 ? assets : catalogAssets,
      source: assets.length > 0 ? "redshift" : "seed",
      message:
        assets.length > 0
          ? `Loaded ${assets.length} assets from Redshift workgroup ${workgroupName}, database ${database}, schemas ${schemaNames.join(", ")}.`
          : "Redshift returned no catalog rows, so the app fell back to seed catalog data.",
    };
  } catch (error) {
    return {
      assets: catalogAssets,
      source: "seed",
      message: `Redshift metadata load failed: ${error instanceof Error ? error.message : "unknown error"}`,
    };
  }
}

async function queryRedshiftMetadata(
  client: RedshiftDataClient,
  workgroupName: string,
  database: string,
  schemaNames: string[],
) {
  const executeResult = await client.send(
    new ExecuteStatementCommand({
      WorkgroupName: workgroupName,
      Database: database,
      Sql: buildMetadataSql(schemaNames),
    }),
  );

  if (!executeResult.Id) {
    throw new Error("Redshift did not return a statement id.");
  }

  await waitForStatement(client, executeResult.Id);

  const result = await client.send(new GetStatementResultCommand({ Id: executeResult.Id }));
  const columns = result.ColumnMetadata?.map((column) => column.name ?? "") ?? [];

  return (
    result.Records?.map((record) => {
      const values = Object.fromEntries(
        record.map((field, index) => [columns[index], parseFieldValue(field)]),
      );

      return {
        databaseName: String(values.database_name ?? ""),
        schemaName: String(values.schema_name ?? ""),
        tableName: String(values.table_name ?? ""),
        tableType: String(values.table_type ?? "table"),
        assetDescription: String(values.asset_description ?? ""),
        columnName: String(values.column_name ?? ""),
        ordinalPosition: Number(values.ordinal_position ?? 0),
        dataType: String(values.data_type ?? ""),
        isNullable: Boolean(values.is_nullable),
        columnDescription: String(values.column_description ?? ""),
      };
    }) ?? []
  );
}

async function waitForStatement(client: RedshiftDataClient, statementId: string) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const result = await client.send(new DescribeStatementCommand({ Id: statementId }));

    if (result.Status === "FINISHED") {
      return;
    }

    if (result.Status === "FAILED" || result.Status === "ABORTED") {
      throw new Error(result.Error ?? `Redshift statement ${result.Status.toLowerCase()}.`);
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error("Timed out waiting for Redshift metadata query.");
}

function parseFieldValue(field: Field) {
  if (field.isNull) return null;
  if (field.stringValue !== undefined) return field.stringValue;
  if (field.longValue !== undefined) return field.longValue;
  if (field.doubleValue !== undefined) return field.doubleValue;
  if (field.booleanValue !== undefined) return field.booleanValue;
  if (field.blobValue !== undefined) return field.blobValue.toString();
  return null;
}

function mapMetadataRowsToAssets(rows: MetadataRow[]): CatalogAsset[] {
  const assetsById = new Map<string, CatalogAsset>();

  for (const row of rows) {
    const assetId = `${row.databaseName}.${row.schemaName}.${row.tableName}`;
    const existingAsset = assetsById.get(assetId);
    const column: CatalogColumn = {
      name: row.columnName,
      type: row.dataType,
      description: row.columnDescription || "Documentation needed.",
      nullable: row.isNullable,
      tags: inferColumnTags(row.columnName),
    };

    if (existingAsset) {
      existingAsset.columns.push(column);
      continue;
    }

    assetsById.set(assetId, {
      id: assetId,
      database: row.databaseName,
      schema: row.schemaName,
      name: row.tableName,
      type: normalizeTableType(row.tableType),
      domain: inferDomain(row.schemaName),
      description: row.assetDescription || "Documentation needed.",
      owner: "Unassigned",
      technicalOwner: "Data Platform",
      refreshCadence: "Unknown",
      freshness: "Unknown",
      certification: "Needs review",
      tags: [row.schemaName, "redshift"],
      consumers: [],
      columns: [column],
    });
  }

  return Array.from(assetsById.values());
}

function normalizeTableType(tableType: string): CatalogAsset["type"] {
  const normalized = tableType.toLowerCase();

  if (normalized.includes("view")) return "view";
  if (normalized.includes("external")) return "external table";
  return "table";
}

function inferDomain(schemaName: string) {
  const normalized = schemaName.toLowerCase();

  if (normalized === "companies") return "Supplier Facts";
  if (normalized === "reporting") return "Reporting";
  if (normalized.includes("finance") || normalized.includes("revenue")) return "Finance";
  if (normalized.includes("sales") || normalized.includes("crm")) return "Sales";
  if (normalized.includes("customer") || normalized.includes("user")) return "Customer";
  if (normalized.includes("marketing")) return "Marketing";
  if (normalized.includes("product")) return "Product";
  return "Unassigned";
}

function inferColumnTags(columnName: string) {
  const normalized = columnName.toLowerCase();
  const tags: string[] = [];

  if (normalized === "id" || normalized.endsWith("_id")) tags.push("key");
  if (normalized.includes("email") || normalized.includes("name") || normalized.includes("phone")) {
    tags.push("pii-review");
  }
  if (normalized.includes("date") || normalized.includes("time") || normalized.includes("_at")) {
    tags.push("time");
  }

  return tags;
}

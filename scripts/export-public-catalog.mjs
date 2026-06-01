import {
  DescribeStatementCommand,
  ExecuteStatementCommand,
  GetStatementResultCommand,
  RedshiftDataClient,
} from "@aws-sdk/client-redshift-data";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const workgroupName = process.env.REDSHIFT_WORKGROUP_NAME ?? "production-workgroup";
const database = process.env.REDSHIFT_DATABASE_NAME ?? "prd";
const schemaNames = (process.env.REDSHIFT_SCHEMA_NAMES ?? "reporting,companies")
  .split(",")
  .map((schema) => schema.trim())
  .filter(Boolean);
const outputPath = resolve(process.cwd(), "src/data/public-catalog.json");

const client = new RedshiftDataClient({
  region: process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? "eu-central-1",
});

const statementId = await executeMetadataQuery();
await waitForStatement(statementId);
const rows = await getRows(statementId);
const assets = mapRowsToAssets(rows);
const payload = {
  generatedAt: new Date().toISOString(),
  source: {
    workgroupName,
    database,
    schemas: schemaNames,
  },
  assets,
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`);

console.log(`Exported ${assets.length} assets to ${outputPath}`);

async function executeMetadataQuery() {
  const result = await client.send(
    new ExecuteStatementCommand({
      WorkgroupName: workgroupName,
      Database: database,
      Sql: buildMetadataSql(schemaNames),
    }),
  );

  if (!result.Id) {
    throw new Error("Redshift did not return a statement id.");
  }

  return result.Id;
}

async function waitForStatement(statementId) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const result = await client.send(new DescribeStatementCommand({ Id: statementId }));

    if (result.Status === "FINISHED") return;
    if (result.Status === "FAILED" || result.Status === "ABORTED") {
      throw new Error(result.Error ?? `Redshift statement ${result.Status.toLowerCase()}.`);
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error("Timed out waiting for Redshift metadata query.");
}

async function getRows(statementId) {
  const result = await client.send(new GetStatementResultCommand({ Id: statementId }));
  const columns = result.ColumnMetadata?.map((column) => column.name ?? "") ?? [];

  return (
    result.Records?.map((record) =>
      Object.fromEntries(record.map((field, index) => [columns[index], parseFieldValue(field)])),
    ) ?? []
  );
}

function buildMetadataSql(schemas) {
  const schemaFilter = schemas.map((schema) => `'${schema.replaceAll("'", "''")}'`).join(", ");

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

function parseFieldValue(field) {
  if (field.isNull) return null;
  if (field.stringValue !== undefined) return field.stringValue;
  if (field.longValue !== undefined) return field.longValue;
  if (field.doubleValue !== undefined) return field.doubleValue;
  if (field.booleanValue !== undefined) return field.booleanValue;
  if (field.blobValue !== undefined) return field.blobValue.toString();
  return null;
}

function mapRowsToAssets(rows) {
  const assetsById = new Map();

  for (const row of rows) {
    const databaseName = String(row.database_name ?? "");
    const schemaName = String(row.schema_name ?? "");
    const tableName = String(row.table_name ?? "");
    const assetId = `${databaseName}.${schemaName}.${tableName}`;
    const column = {
      name: String(row.column_name ?? ""),
      type: String(row.data_type ?? ""),
      description: String(row.column_description ?? "") || "Documentation needed.",
      nullable: Boolean(row.is_nullable),
      tags: inferColumnTags(String(row.column_name ?? "")),
    };

    if (assetsById.has(assetId)) {
      assetsById.get(assetId).columns.push(column);
      continue;
    }

    assetsById.set(assetId, {
      id: assetId,
      database: databaseName,
      schema: schemaName,
      name: tableName,
      type: normalizeTableType(String(row.table_type ?? "table")),
      domain: inferDomain(schemaName),
      description: String(row.asset_description ?? "") || "Documentation needed.",
      owner: "Unassigned",
      technicalOwner: "Data Platform",
      refreshCadence: "Unknown",
      freshness: "Snapshot metadata",
      certification: "Needs review",
      tags: [schemaName, "redshift", "production"],
      consumers: [],
      columns: [column],
    });
  }

  return Array.from(assetsById.values());
}

function normalizeTableType(tableType) {
  const normalized = tableType.toLowerCase();

  if (normalized.includes("view")) return "view";
  if (normalized.includes("external")) return "external table";
  return "table";
}

function inferDomain(schemaName) {
  const normalized = schemaName.toLowerCase();

  if (normalized === "companies") return "Supplier Facts";
  if (normalized === "reporting") return "Reporting";
  return "Unassigned";
}

function inferColumnTags(columnName) {
  const normalized = columnName.toLowerCase();
  const tags = [];

  if (normalized === "id" || normalized.endsWith("_id") || normalized.endsWith("_uuid")) {
    tags.push("key");
  }
  if (normalized.includes("email") || normalized.includes("name") || normalized.includes("phone")) {
    tags.push("pii-review");
  }
  if (normalized.includes("date") || normalized.includes("time") || normalized.includes("_at")) {
    tags.push("time");
  }

  return tags;
}

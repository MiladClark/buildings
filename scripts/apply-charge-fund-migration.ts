import { loadEnvConfig } from "@next/env";
import { createClient } from "@libsql/client";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
loadEnvConfig(process.cwd());
async function main() {
 const url=process.argv[2]??process.env.DATABASE_URL??"file:./data/buildings.db";
 const client=createClient({url});
 try {
  const changes=[['billing_period','charge_model'],['expense_line','billing_treatment'],['period_charge_plan','cleaning_visit_rial'],['period_charge_plan','cleaning_every_days']];
  const missing=[];
  for(const [table,column]of changes){const info=await client.execute(`PRAGMA table_info(${table})`); if(!info.rows.some(r=>r.name===column))missing.push(column);}
  if(!missing.length){console.log('Charge fund schema already ready.');return;}
  if(url.startsWith('file:')){await mkdir('data/backups',{recursive:true});const file=path.resolve(`data/backups/before-charge-fund-${Date.now()}.db`);await client.execute(`VACUUM INTO '${file.replaceAll("'","''")}'`);}
  const queries=[];
  for(const table of ['billing_period','expense_line','period_charge_plan','unit_invoice','invoice_line_item','payment','payment_application']){const info=await client.execute(`PRAGMA table_info(${table})`);queries.push(`SELECT ${info.rows.map(r=>`"${r.name}"`).join(',')} FROM ${table} ORDER BY 1`);}
  const tx=await client.transaction('write');
  try{const before=[];for(const query of queries)before.push(JSON.stringify((await tx.execute(query)).rows));const sql=await readFile('drizzle/0010_woozy_guardian.sql','utf8');for(const statement of sql.split('--> statement-breakpoint'))if(missing.some(column=>statement.includes('`'+column+'`')))await tx.execute(statement);for(const [index,query]of queries.entries())if(before[index]!==JSON.stringify((await tx.execute(query)).rows))throw new Error('Financial records changed; migration rolled back.');await tx.commit();console.log('Charge fund schema ready; original financial records preserved exactly.');}catch(error){await tx.rollback();throw error;}finally{tx.close();}
 }finally{client.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});

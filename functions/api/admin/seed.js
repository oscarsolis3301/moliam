import { jsonResp, corsResponse } from "../../lib/auth.js";

/** @type {Parameters<typeof onRequestPost>[0]} context - Cloudflare Pages context */
export async function onRequestPost(context) {
  const { request, env } = context;
  const db = env.MOLIAM_DB;

  if (request.method === "OPTIONS") return corsResponse(204);

  try {
    const seedKey = request.headers.get("x-seed-key");
    if (seedKey !== "moliam2026") {
      return jsonResp(403, { error: "Invalid seed key" });
       }

         // === PHASE 1: Just test and scan users table schema ===
     let actualColumns = [];
       try {
         const pragmaResults = await db.prepare("PRAGMA table_info(users)").all();

       if (pragmaResults && pragmaResults.results) {
             actualColumns = pragmaResults.results.map(c => ({ name: c.name, type: c.type, pk: c.pk }));
              console.log(`Users table has ${actualColumns.length} columns:`, JSON.stringify(actualColumns));

           for (const col of actualColumns) {
            console.log(`Column: ${col.name}, Type: ${col.type}`);
                 }
         } else {
             return jsonResp(200, { message: "Empty schema", columns: [] });

         }

        } catch (schemaError) {

      console.error("Schema query error:", schemaError.message);

       return jsonResp(500, { error: "Failed to inspect users table", details: schemaError.message });
     }

        // Return actual column names from pragma info for next iteration
    const columnNames = actualColumns.map(c => c.name);
      const isIdIncluded = columnNames.includes("id");
       const dataColumnCount = actualColumns.length - (isIdIncluded ? 1 : 0);

         return jsonResp(200, { 
           success: true,
         columns: actualColumns.map(c => c.name),
        dataColumnCount,
         columnNames,
           isStagingMode: true,
           message: "Schema inspection complete. Now insert with matching column count." 

              });

       } catch (outerError) {

       return jsonResp(500, { error: outerError.message });
               } 
             }

/** @type {Parameters<typeof onRequestOptions>[0]} context - Cloudflare Pages context */
export async function onRequestOptions() {
  return corsResponse(204);
}

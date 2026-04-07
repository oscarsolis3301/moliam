// Test what CREATE TABLE string produces
const sql = "CREATE TABLE sessions (user_id INTEGER, token TEXT, created_at TEXT)";
console.log("SQL string:");
console.log(sql);
console.log("\nCharacter codes:");
for (let i = 0; i < sql.length; i++) {
    if (sql.charCodeAt(i) > 127 || (sql.charCodeAt(i) < 32 && sql.charCodeAt(i) !== 10 && sql.charCodeAt(i) !== 9)) {
        console.log(`Char ${i}: ${sql.charCodeAt(i)} = '${sql[i]}'`);
    }
}
console.log("\nLength:", sql.length);

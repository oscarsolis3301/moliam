export async function onRequest() {
  return new Response("Moliam API - /api/admin/", { headers: { "Content-Type": "text/plain" } });
}

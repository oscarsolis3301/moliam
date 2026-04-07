import { onRequestPost as seedPost } from './seed.js';

export async function onRequestPost(context) {
  const url = context.request.url;
  if (url.includes('/api/admin/seed')) {
    return await seedPost(context);
  }
  return new Response(JSON.stringify({ error: "Not found" }), { 
    status: 404, 
    headers: { 'Content-Type': 'application/json' } 
  });
}

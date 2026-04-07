export async function onRequestGet(context) { 
      return new Response(JSON.stringify({ url: "https://calendly.com/visualark/demo", embed: true }), { 
          headers: { 
            "Content-Type": "application/json", 
           "Access-Control-Allow-Origin": "https://moliam.pages.dev",
             "Cache-Control": "no-cache" 
         } 
       }); 
      }

export async function onRequestOptions() { 
  return new Response(null, { 
             status: 204, 
             headers: { 
                   "Access-Control-Allow-Origin": "https://moliam.pages.dev",
                   "Access-Control-Allow-Methods": "GET, OPTIONS",
                   "Access-Control-Allow-Headers": "Content-Type" 
               } 
            });
      }

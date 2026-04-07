export async function onRequestGet(context) { 
  try {
    return new Response(JSON.stringify({ url: "https://calendly.com/visualark/demo", embed: true }), { 
      headers: { 
        "Content-Type": "application/json", 
        "Access-Control-Allow-Origin": "https://moliam.pages.dev",
        "Cache-Control": "no-cache" 
      } 
    });
  } catch (error) {
    console.error("ERROR [calendly.js GET]:", error.message);
    return new Response(JSON.stringify({ error: "Internal server error", status: 500 }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "https://moliam.pages.dev"
      }
    });
  }
}

export async function onRequestOptions() { 
  try {
    return new Response(null, { 
      status: 204, 
      headers: { 
        "Access-Control-Allow-Origin": "https://moliam.pages.dev",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type" 
      } 
    });
  } catch (error) {
    console.error("ERROR [calendly.js OPTIONS]:", error.message);
    return new Response(JSON.stringify({ error: "Internal server error", status: 500 }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "https://moliam.pages.dev"
      }
    });
  }
}

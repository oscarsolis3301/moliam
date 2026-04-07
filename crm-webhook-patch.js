   try {
    const data = await request.json();

      // --- Validate webhook payload structure ---
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return jsonResp(400, { 
         error: true, 
          message: "Invalid webhook payload. Expected JSON object.",
           receivedType: Array.isArray(data) ? "array" : typeof data 
              });
             }

        // Log payload to D1 for debugging (helper function called below)
    logPayloadToD1(db, data);


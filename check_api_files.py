import subprocess

files = [
        ("bookings.js", "functions/api/bookings.js"),
         ("calendly-webhook.js", "functions/api/calendly-webhook.js"),
            ("client-message.js", "functions/api/client-message.js"),
           ("contacts.js", "functions/api/contacts.js"),
          ("crm-webhook.js", "functions/api/crm-webhook.js"),
         ("dashboard.js", "functions/api/dashboard.js"),
        ("email-automation.js", "functions/api/email-automation.js"),
         ("followup.js", "functions/api/followup.js"),
           ("prequalify.js", "functions/api/prequalify.js"),
            ("qr.js", "functions/api/qr.js") ]

for fname, fullpath in files:
    try:
        result = subprocess.run(
             ["cat", fullpath], capture_output=True, text=True)
         content = result.stdout
        
         lines_all = content.split('\n')
        
            # Look for the main handler function
         has_try_catch_main = False
        
         for i, line in enumerate(lines_all):
            if 'export async function' in line and ('OnRequest' in line or 'onRequest' in line):
                search_area_start = i
        
              # Check next 150 lines after function declaration for try/catch block
        if 'search_area_start' in dir():
            func_block = '\n'.join(lines_all[search_area_start : min(search_area_start+150, len(lines_all))])
            has_try_catch_main = "try {" in func_block and "catch" in func_block
        
           # Count total try blocks in the entire file
        all_try_blocks = content.count("try {")
        line_count = len(content.split('\n'))
        
         status_label = "ALREADY HARDENED" if has_try_catch_main else "*** NEEDS TASK 1 ***"
       
        print("%s (%d try blocks, %d lines): %s" % (fname, all_try_blocks, line_count, status_label))
    
    except Exception as e:
        print(fname + ": ERROR - " + str(e))

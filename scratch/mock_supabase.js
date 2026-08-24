const http = require('http');

const PORT = 54321;
const conversations = new Map();
const messages = [];

const server = http.createServer((req, res) => {
  console.log(`[MOCK SUPABASE] ${req.method} ${req.url}`);
  
  // Set headers
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Methods', '*');

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end();
    return;
  }

  let body = '';
  req.on('data', chunk => {
    body += chunk;
  });

  req.on('end', () => {
    try {
      const url = new URL(req.url, `http://${req.headers.host}`);
      
      // Conversations insert (POST /rest/v1/conversations)
      if (req.method === 'POST' && url.pathname === '/rest/v1/conversations') {
        const payload = JSON.parse(body);
        const id = '11111111-1111-1111-1111-111111111111';
        conversations.set(id, { id, title: payload.title, updated_at: new Date().toISOString() });
        res.statusCode = 201;
        // Check if the client requested a single object or list
        const accept = req.headers['accept'] || '';
        if (accept.includes('vnd.pgrst.object')) {
          res.end(JSON.stringify({ id, title: payload.title }));
        } else {
          res.end(JSON.stringify([{ id, title: payload.title }]));
        }
        return;
      }


      // Conversations select (GET /rest/v1/conversations)
      if (req.method === 'GET' && url.pathname === '/rest/v1/conversations') {
        const id = url.searchParams.get('id');
        // Extract ID from query if it's like eq.UUID
        const match = id ? id.split('.')[1] : null;
        if (match && conversations.has(match)) {
          res.statusCode = 200;
          res.end(JSON.stringify([conversations.get(match)]));
        } else {
          res.statusCode = 200;
          res.end(JSON.stringify([]));
        }
        return;
      }

      // Conversations update (PATCH /rest/v1/conversations)
      if (req.method === 'PATCH' && url.pathname === '/rest/v1/conversations') {
        res.statusCode = 200;
        res.end(JSON.stringify([]));
        return;
      }

      // Messages insert (POST /rest/v1/messages)
      if (req.method === 'POST' && url.pathname === '/rest/v1/messages') {
        const payload = JSON.parse(body);
        const msg = {
          id: String(messages.length + 1),
          conversation_id: payload.conversation_id,
          role: payload.role,
          content: payload.content,
          created_at: new Date().toISOString()
        };
        messages.push(msg);
        res.statusCode = 201;
        res.end(JSON.stringify([msg]));
        return;
      }

      // Messages select (GET /rest/v1/messages)
      if (req.method === 'GET' && url.pathname === '/rest/v1/messages') {
        const convIdParam = url.searchParams.get('conversation_id');
        const convId = convIdParam ? convIdParam.split('.')[1] : null;
        const filtered = messages.filter(m => m.conversation_id === convId);
        res.statusCode = 200;
        res.end(JSON.stringify(filtered));
        return;
      }

      // Default fallback
      res.statusCode = 404;
      res.end(JSON.stringify({ error: 'Not Found' }));
    } catch (err) {
      console.error('[MOCK SUPABASE ERROR]', err);
      res.statusCode = 500;
      res.end(JSON.stringify({ error: err.message }));
    }
  });
});

server.listen(PORT, () => {
  console.log(`Mock Supabase server listening on port ${PORT}`);
});

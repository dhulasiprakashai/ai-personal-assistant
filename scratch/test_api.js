const http = require('http');

function postJSON(url, data) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const postData = JSON.stringify(data);

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || 80,
      path: parsedUrl.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(options, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => {
        responseBody += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseBody);
          resolve({ status: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, body: responseBody });
        }
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    req.write(postData);
    req.end();
  });
}

async function run() {
  try {
    console.log('Sending first message: "im prakash"');
    const res1 = await postJSON('http://localhost:3000/api/chat', { message: 'im prakash' });
    console.log('Response 1 Status:', res1.status);
    console.log('Response 1 Body:', JSON.stringify(res1.body, null, 2));

    if (res1.status !== 200 || !res1.body.conversationId) {
      console.error('Failed to get conversationId from first response');
      return;
    }

    const conversationId = res1.body.conversationId;
    console.log('\nSending second message: "what are u doing" with conversationId:', conversationId);
    const res2 = await postJSON('http://localhost:3000/api/chat', {
      message: 'what are u doing',
      conversationId: conversationId
    });
    console.log('Response 2 Status:', res2.status);
    console.log('Response 2 Body:', JSON.stringify(res2.body, null, 2));
  } catch (err) {
    console.error('Network/request error:', err);
  }
}

// Wait a bit to ensure Next.js is ready, then run
setTimeout(run, 1000);

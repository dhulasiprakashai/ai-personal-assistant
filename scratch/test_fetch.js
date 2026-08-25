async function run() {
  try {
    const res1 = await fetch('http://127.0.0.1:3000/api/conversations');
    console.log('GET /api/conversations status:', res1.status);
    const body1 = await res1.text();
    console.log('GET /api/conversations response body:', body1);

    const res2 = await fetch('http://127.0.0.1:3000/api/chat?conversationId=11111111-1111-1111-1111-111111111111');
    console.log('GET /api/chat status:', res2.status);
    const body2 = await res2.text();
    console.log('GET /api/chat response body:', body2);
  } catch (err) {
    console.error('Fetch error:', err);
  }
}
run();

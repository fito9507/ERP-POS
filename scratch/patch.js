const SUPA_URL = 'https://gpkslaqfqfdeoleiayng.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdwa3NsYXFmcWZkZW9sZWlheW5nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2Nzk0MzQsImV4cCI6MjA4OTI1NTQzNH0.iTMO4obXaYC2O1QkAgkaRjygMvjkFnCFuVBVO35DmRk';

fetch(SUPA_URL + '/rest/v1/productos?id=eq.959', {
  method: 'PATCH',
  headers: { apikey: SUPA_KEY, Authorization: 'Bearer ' + SUPA_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ badge_texto: 'RESERVADO' })
});

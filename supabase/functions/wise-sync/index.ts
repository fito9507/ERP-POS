import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const wiseToken = Deno.env.get('WISE_API_TOKEN');
    if (!wiseToken) throw new Error("Missing WISE_API_TOKEN");

    // We'll fetch activities from the active business profile: 65594311
    const profileId = '65594311';
    
    const actRes = await fetch(`https://api.transferwise.com/v1/profiles/${profileId}/activities?limit=50`, {
      headers: { 'Authorization': `Bearer ${wiseToken}` }
    });
    
    if (!actRes.ok) {
      throw new Error("Wise API Error: " + await actRes.text());
    }
    
    const actData = await actRes.json();
    const activities = actData.activities || [];

    const parsedTransactions = activities.map((a: any) => {
      // Parse amount and currency
      const rawAmt = a.primaryAmount.replace(/<[^>]*>?/gm, ''); // strip HTML
      const parts = rawAmt.trim().split(' ');
      let currency = 'USD';
      let amountNum = 0;
      
      if (parts.length >= 2) {
        currency = parts[parts.length - 1];
        const valStr = parts.slice(0, parts.length - 1).join('').replace(/,/g, '');
        amountNum = parseFloat(valStr);
      }
      
      // Determine if positive or negative
      let isIncome = false;
      if (a.primaryAmount.includes('<positive>') || a.primaryAmount.includes('+')) {
        isIncome = true;
      }
      if (a.description && a.description.toLowerCase().includes('received')) {
        isIncome = true;
      }
      if (a.type === 'DEPOSIT') isIncome = true;

      // Extract title
      const titleStr = a.title ? a.title.replace(/<[^>]*>?/gm, '').trim() : '';
      const descStr = a.description ? a.description.replace(/<[^>]*>?/gm, '').trim() : '';

      return {
        id: a.id, // Using base64 ID from Wise
        created_at: a.createdOn,
        currency: currency,
        amount: isIncome ? Math.abs(amountNum) : -Math.abs(amountNum),
        reference: titleStr + (descStr ? ' - ' + descStr : ''),
        type: a.type
      };
    });

    return new Response(JSON.stringify({ transactions: parsedTransactions }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import * as jose from "https://deno.land/x/jose@v4.14.4/index.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const clientId = Deno.env.get('REVOLUT_CLIENT_ID')
    const privateKeyPem = Deno.env.get('REVOLUT_PRIVATE_KEY') // PEM formatted private key
    const refreshToken = Deno.env.get('REVOLUT_REFRESH_TOKEN')

    // Revolut Base URL: https://sandbox-b2b.revolut.com (pruebas) o https://b2b.revolut.com (producción)
    const revUrl = Deno.env.get('REVOLUT_URL') || 'https://b2b.revolut.com'

    if (!clientId || !privateKeyPem || !refreshToken) {
      throw new Error('Faltan credenciales de Revolut en el entorno (Supabase Secrets).')
    }

    // 1. Crear el Client Assertion (JWT firmado con la clave privada)
    const privateKey = await jose.importPKCS8(privateKeyPem.replace(/\\n/g, '\n'), 'RS256')
    const jwt = await new jose.SignJWT({
      iss: 'google.com',
      sub: clientId,
      aud: 'https://revolut.com'
    })
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(privateKey)

    // 2. Intercambiar el JWT y refresh token por un Access Token
    const tokenUrl = `${revUrl}/api/1.0/auth/token`
    const params = new URLSearchParams()
    params.append('grant_type', 'refresh_token')
    params.append('refresh_token', refreshToken)
    params.append('client_id', clientId)
    params.append('client_assertion_type', 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer')
    params.append('client_assertion', jwt)

    const tokenRes = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    })

    if (!tokenRes.ok) {
      const err = await tokenRes.text()
      throw new Error(`Error obteniendo access token de Revolut: ${err}`)
    }

    const { access_token } = await tokenRes.json()

    // 3. Obtener transacciones de Revolut usando el access_token
    // Por defecto, descargamos los últimos 5 días
    const fromDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
    const txUrl = `${revUrl}/api/1.0/transactions?from=${fromDate}`
    
    const txRes = await fetch(txUrl, {
      headers: { 'Authorization': `Bearer ${access_token}` }
    })

    if (!txRes.ok) {
      const err = await txRes.text()
      throw new Error(`Error leyendo transacciones: ${err}`)
    }

    const transactions = await txRes.json()

    // Enviar transacciones de vuelta al ERP
    return new Response(
      JSON.stringify({ success: true, transactions }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
    )
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
    )
  }
})

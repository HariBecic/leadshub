import Stripe from 'stripe'

// Stripe Client initialisieren
const stripeSecretKey = process.env.STRIPE_SECRET_KEY

// Lazy initialization um Build-Fehler zu vermeiden
let stripeInstance: Stripe | null = null

export function getStripe(): Stripe {
  if (stripeInstance) return stripeInstance

  if (!stripeSecretKey) {
    throw new Error('STRIPE_SECRET_KEY ist nicht konfiguriert')
  }

  stripeInstance = new Stripe(stripeSecretKey, {
    apiVersion: '2026-01-28.clover',
    typescript: true,
  })

  return stripeInstance
}

// Stripe Payment Link erstellen
export async function createPaymentLink(params: {
  invoiceId: string
  invoiceNumber: string
  amount: number // in CHF
  description: string
  customerEmail: string
  successUrl?: string
  cancelUrl?: string
}): Promise<{ paymentLink: string; paymentLinkId: string }> {
  const stripe = getStripe()

  // Preis in Rappen umrechnen (Stripe verwendet kleinste Währungseinheit)
  const amountInCents = Math.round(params.amount * 100)

  // Produkt erstellen
  const product = await stripe.products.create({
    name: `Rechnung ${params.invoiceNumber}`,
    description: params.description,
    metadata: {
      invoice_id: params.invoiceId,
      invoice_number: params.invoiceNumber,
    },
  })

  // Preis erstellen
  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: amountInCents,
    currency: 'chf',
  })

  // Payment Link erstellen
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://leadshub2.vercel.app'

  const paymentLink = await stripe.paymentLinks.create({
    line_items: [
      {
        price: price.id,
        quantity: 1,
      },
    ],
    metadata: {
      invoice_id: params.invoiceId,
      invoice_number: params.invoiceNumber,
    },
    after_completion: {
      type: 'redirect',
      redirect: {
        url: params.successUrl || `${baseUrl}/zahlung-erfolgreich?invoice=${params.invoiceNumber}`,
      },
    },
    // Kundeninformationen vorausfüllen
    custom_fields: [],
    customer_creation: 'if_required',
  })

  return {
    paymentLink: paymentLink.url,
    paymentLinkId: paymentLink.id,
  }
}

// Stripe Checkout Session erstellen (Alternative zu Payment Link)
export async function createCheckoutSession(params: {
  invoiceId: string
  invoiceNumber: string
  amount: number // in CHF
  description: string
  customerEmail: string
  successUrl?: string
  cancelUrl?: string
}): Promise<{ sessionUrl: string; sessionId: string }> {
  const stripe = getStripe()

  const amountInCents = Math.round(params.amount * 100)
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://leadshub2.vercel.app'

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card', 'twint'],
    line_items: [
      {
        price_data: {
          currency: 'chf',
          unit_amount: amountInCents,
          product_data: {
            name: `Rechnung ${params.invoiceNumber}`,
            description: params.description,
          },
        },
        quantity: 1,
      },
    ],
    customer_email: params.customerEmail,
    metadata: {
      invoice_id: params.invoiceId,
      invoice_number: params.invoiceNumber,
    },
    success_url: params.successUrl || `${baseUrl}/zahlung-erfolgreich?invoice=${params.invoiceNumber}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: params.cancelUrl || `${baseUrl}/rechnungen`,
  })

  return {
    sessionUrl: session.url!,
    sessionId: session.id,
  }
}

// Webhook Signatur verifizieren
export function verifyWebhookSignature(
  payload: string | Buffer,
  signature: string,
  webhookSecret: string
): Stripe.Event {
  const stripe = getStripe()
  return stripe.webhooks.constructEvent(payload, signature, webhookSecret)
}

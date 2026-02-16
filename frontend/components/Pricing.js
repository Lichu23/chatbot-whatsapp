const WA_NUMBER = process.env.NEXT_PUBLIC_ADMIN_NUMBER || '5493XXXXXXXXXX';

const plans = [
  {
    name: 'B\u00e1sico',
    slug: 'basico',
    priceUSD: 10,
    priceARS: '$14.000',
    highlighted: false,
    cta: 'Empezar',
    ctaMessage: 'Quiero el plan Basico',
    features: [
      'Pedidos autom\u00e1ticos',
      '100 pedidos/mes',
      '3 zonas de entrega',
      'Todos los m\u00e9todos de pago',
      'Comandos de gesti\u00f3n',
      'Reportes b\u00e1sicos',
    ],
  },
  {
    name: 'Intermedio',
    slug: 'intermedio',
    priceUSD: 20,
    priceARS: '$28.000',
    highlighted: true,
    badge: 'RECOMENDADO',
    cta: 'Probar GRATIS 30 d\u00edas',
    ctaMessage: 'Quiero probar gratis',
    features: [
      'Todo B\u00e1sico +',
      'Asistente IA',
      '500 pedidos/mes',
      '10 zonas de entrega',
      'Resumen diario',
      'C\u00f3digos promo',
      '20 consultas analytics/mes',
    ],
  },
  {
    name: 'Pro',
    slug: 'pro',
    priceUSD: 60,
    priceARS: '$84.000',
    highlighted: false,
    cta: 'Contactar',
    ctaMessage: 'Quiero info sobre el plan Pro',
    features: [
      'Todo Intermedio +',
      'Pedidos ilimitados',
      'Zonas ilimitadas',
      'Difusiones WhatsApp',
      'Fidelizaci\u00f3n clientes',
      'Mensajes programados',
      'Analytics ilimitados',
      'Tendencias',
    ],
  },
];

export default function Pricing() {
  return (
    <section id="pricing" className="py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mx-auto mb-14 max-w-2xl text-center">
          <h2 className="text-3xl font-bold sm:text-4xl">
            Planes simples, sin sorpresas
          </h2>
          <p className="mt-4 text-gray-400">
            Eleg&iacute; el plan que mejor se adapte a tu negocio. Cambi&aacute; o
            cancel&aacute; en cualquier momento.
          </p>
        </div>

        <div className="grid items-start gap-6 lg:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.slug}
              className={`relative rounded-2xl border p-8 transition ${
                plan.highlighted
                  ? 'scale-[1.03] border-whatsapp bg-gray-900 shadow-lg shadow-whatsapp/10'
                  : 'border-gray-800 bg-gray-900'
              }`}
            >
              {plan.badge && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-whatsapp px-4 py-1 text-xs font-bold text-gray-950">
                  {plan.badge}
                </div>
              )}

              <h3 className="text-xl font-bold">{plan.name}</h3>

              <div className="mt-4">
                <span className="text-4xl font-extrabold">{plan.priceARS}</span>
                <span className="ml-1 text-gray-400">ARS/mes</span>
              </div>
              <p className="mt-1 text-sm text-gray-500">
                ~${plan.priceUSD} USD
              </p>

              <ul className="mt-8 space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm text-gray-300">
                    <svg
                      className="mt-0.5 h-4 w-4 shrink-0 text-whatsapp"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2.5}
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>

              <a
                href={`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(plan.ctaMessage)}`}
                target="_blank"
                rel="noopener noreferrer"
                className={`mt-8 block w-full rounded-xl py-3 text-center font-semibold transition ${
                  plan.highlighted
                    ? 'bg-whatsapp text-gray-950 hover:bg-whatsapp-dark hover:text-white'
                    : 'border border-gray-700 text-white hover:border-whatsapp hover:text-whatsapp'
                }`}
              >
                {plan.cta}
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

'use client';

import { useState } from 'react';

const faqs = [
  {
    question: '\u00bfC\u00f3mo funciona?',
    answer:
      'Conectamos tu n\u00famero de WhatsApp Business a nuestro sistema. Tus clientes te escriben, y el bot gestiona pedidos, pagos y entregas autom\u00e1ticamente.',
  },
  {
    question: '\u00bfNecesito instalar algo?',
    answer:
      'No. Todo funciona a trav\u00e9s de WhatsApp. No necesit\u00e1s descargar ninguna app ni instalar nada. Solo necesit\u00e1s un n\u00famero de WhatsApp Business.',
  },
  {
    question: '\u00bfPuedo cambiar de plan?',
    answer: 'S\u00ed, en cualquier momento. Pod\u00e9s subir o bajar de plan cuando quieras.',
  },
  {
    question: '\u00bfQu\u00e9 pasa despu\u00e9s del per\u00edodo gratis?',
    answer:
      'Eleg\u00eds el plan que m\u00e1s te convenga. Si no eleg\u00eds ninguno, el servicio se desactiva sin costo.',
  },
  {
    question: '\u00bfC\u00f3mo pago?',
    answer: 'Por transferencia bancaria mensual. Te enviamos los datos por WhatsApp.',
  },
  {
    question: '\u00bfPuedo cancelar?',
    answer: 'S\u00ed, sin penalidad. Cancel\u00e1s cuando quieras y no se cobra m\u00e1s.',
  },
];

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState(null);

  return (
    <section id="faq" className="bg-gray-900 py-20 sm:py-28">
      <div className="mx-auto max-w-3xl px-4">
        <h2 className="mb-12 text-center text-3xl font-bold sm:text-4xl">
          Preguntas frecuentes
        </h2>

        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <div key={i} className="rounded-xl border border-gray-800 bg-gray-950">
              <button
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="flex w-full items-center justify-between px-6 py-4 text-left"
              >
                <span className="font-medium">{faq.question}</span>
                <svg
                  className={`h-5 w-5 shrink-0 text-gray-400 transition-transform ${
                    openIndex === i ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </button>
              {openIndex === i && (
                <div className="px-6 pb-4 text-sm leading-relaxed text-gray-400">
                  {faq.answer}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

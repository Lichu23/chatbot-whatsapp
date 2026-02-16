const WA_NUMBER = process.env.NEXT_PUBLIC_ADMIN_NUMBER || '5493XXXXXXXXXX';
const WA_LINK = `https://wa.me/${WA_NUMBER}?text=Quiero%20probar%20gratis`;

export default function Hero() {
  return (
    <section className="relative overflow-hidden pt-28 pb-20 sm:pt-36 sm:pb-28">
      {/* Background gradient */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-whatsapp/5 to-transparent" />

      <div className="relative mx-auto max-w-4xl px-4 text-center">
        <div className="mb-6 inline-block rounded-full border border-whatsapp/30 bg-whatsapp/10 px-4 py-1.5 text-sm text-whatsapp">
          Para negocios argentinos
        </div>

        <h1 className="text-balance text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
          Automatiz&aacute; tus pedidos por{' '}
          <span className="text-whatsapp">WhatsApp</span>
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-400 sm:text-xl">
          Tu negocio recibe y gestiona pedidos autom&aacute;ticamente. Sin apps,
          sin instalaciones.
        </p>

        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <a
            href={WA_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl bg-whatsapp px-8 py-4 text-lg font-bold text-gray-950 shadow-lg shadow-whatsapp/20 transition hover:bg-whatsapp-dark hover:text-white"
          >
            <WhatsAppIcon />
            Probar GRATIS 30 d&iacute;as
          </a>
          <a
            href="#pricing"
            className="text-sm text-gray-400 underline underline-offset-4 transition hover:text-white"
          >
            Ver precios
          </a>
        </div>

        {/* WhatsApp chat mockup — catalog card style */}
        <div className="mx-auto mt-16 max-w-xs sm:max-w-sm">
          <div
            className="overflow-hidden rounded-2xl shadow-2xl"
            style={{
              backgroundColor: '#0b141a',
              backgroundImage:
                'url("data:image/svg+xml,%3Csvg width=\'200\' height=\'200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cdefs%3E%3Cpattern id=\'p\' width=\'40\' height=\'40\' patternUnits=\'userSpaceOnUse\'%3E%3Ccircle cx=\'20\' cy=\'20\' r=\'1\' fill=\'%23ffffff08\'/%3E%3C/pattern%3E%3C/defs%3E%3Crect width=\'200\' height=\'200\' fill=\'url(%23p)\'/%3E%3C/svg%3E")',
            }}
          >
            {/* Chat header */}
            <div className="flex items-center gap-3 bg-[#202c33] px-4 py-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#6b7c85]">
                <svg className="h-5 w-5 text-[#cfd4d6]" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 12c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm0 2c-3.33 0-10 1.67-10 5v2h20v-2c0-3.33-6.67-5-10-5z" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-[#e9edef]">Tu Negocio</p>
                <p className="text-xs text-[#8696a0]">en l&iacute;nea</p>
              </div>
            </div>

            {/* Chat body */}
            <div className="space-y-2 px-3 py-4">
              {/* Date pill */}
              <div className="flex justify-center">
                <span className="rounded-lg bg-[#182229] px-3 py-1 text-xs text-[#8696a0]">
                  Hoy
                </span>
              </div>

              {/* User message: "Menu" */}
              <div className="flex justify-end">
                <div className="relative max-w-[70%] rounded-lg rounded-tr-none bg-[#005c4b] px-3 py-1.5">
                  <span className="text-sm text-[#e9edef]">Menu</span>
                  <span className="ml-3 inline-flex items-center gap-0.5 text-[10px] text-[#ffffff99]">
                    4:55 PM
                    {/* Double check */}
                    <svg className="ml-0.5 h-3.5 w-3.5 text-[#53bdeb]" viewBox="0 0 16 15" fill="none">
                      <path d="M15.01 3.316l-.478-.372a.365.365 0 00-.51.063L8.666 9.88a.32.32 0 01-.484.033l-.358-.325a.32.32 0 00-.484.033l-.36.325a.32.32 0 01-.484-.033L4.8 8.385a.365.365 0 00-.51-.063l-.478.372a.365.365 0 00-.063.51l4.16 5.088a.32.32 0 00.484-.033l6.68-8.452a.365.365 0 00-.063-.51z" fill="currentColor" />
                      <path d="M11.01 3.316l-.478-.372a.365.365 0 00-.51.063L4.666 9.88a.32.32 0 01-.484.033l-1.592-1.47a.365.365 0 00-.51.063l-.478.372a.365.365 0 00-.063.51l4.16 5.088a.32.32 0 00.484-.033l6.68-8.452a.365.365 0 00-.063-.51z" fill="currentColor" />
                    </svg>
                  </span>
                </div>
              </div>

              {/* Bot message: Catalog card */}
              <div className="flex justify-start">
                <div className="max-w-[85%] overflow-hidden rounded-lg rounded-tl-none bg-[#202c33]">
                  {/* Catalog card */}
                  <div className="flex gap-3 p-2.5">
                    {/* Pizza thumbnail (CSS-drawn) */}
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-[#2a3942]">
                      <div className="flex h-full w-full items-center justify-center">
                        <svg className="h-8 w-8 text-[#8696a0]" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14h-2v-2h2v2zm0-4h-2V7h2v5zm4 4h-2v-2h2v2zm0-4h-2V7h2v5z" />
                          <circle cx="8" cy="9" r="1" fill="currentColor" />
                          <circle cx="14" cy="11" r="1" fill="currentColor" />
                          <circle cx="11" cy="14" r="1" fill="currentColor" />
                          <circle cx="12" cy="12" r="8" strokeWidth="1.5" fill="none" stroke="currentColor" />
                        </svg>
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-tight text-[#e9edef]">
                        Men&uacute; de Tu Negocio
                      </p>
                      <p className="mt-0.5 text-xs text-[#8696a0]">10 items</p>
                    </div>
                  </div>

                  {/* Message text */}
                  <div className="px-2.5 pb-1.5">
                    <p className="text-sm text-[#e9edef]">
                      Eleg&iacute; lo que quieras y agregalo al carrito 🛒
                    </p>
                    <p className="mt-1 text-right text-[10px] text-[#ffffff99]">
                      4:55 PM
                    </p>
                  </div>

                  {/* View items button */}
                  <div className="border-t border-[#8696a026]">
                    <div className="flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium text-[#53bdeb]">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                      </svg>
                      View items
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function WhatsAppIcon({ className = 'h-6 w-6' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

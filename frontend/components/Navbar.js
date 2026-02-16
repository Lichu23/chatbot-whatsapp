const WA_NUMBER = process.env.NEXT_PUBLIC_ADMIN_NUMBER || '5493XXXXXXXXXX';
const WA_LINK = `https://wa.me/${WA_NUMBER}?text=Quiero%20probar%20gratis`;

export default function Navbar() {
  return (
    <nav className="fixed top-0 z-50 w-full border-b border-gray-800 bg-gray-950/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <a href="#" className="text-xl font-bold text-white">
          <span className="text-whatsapp">Pedidos</span>Bot
        </a>

        <div className="hidden items-center gap-6 text-sm text-gray-400 sm:flex">
          <a href="#features" className="transition hover:text-white">
            Funciones
          </a>
          <a href="#pricing" className="transition hover:text-white">
            Precios
          </a>
          <a href="#faq" className="transition hover:text-white">
            FAQ
          </a>
        </div>

        <a
          href={WA_LINK}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg bg-whatsapp px-4 py-2 text-sm font-semibold text-gray-950 transition hover:bg-whatsapp-dark hover:text-white"
        >
          Probar gratis
        </a>
      </div>
    </nav>
  );
}

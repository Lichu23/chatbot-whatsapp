import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'PedidosYa Bot - Automatizá tus pedidos por WhatsApp',
  description:
    'Tu negocio recibe y gestiona pedidos automáticamente por WhatsApp. Sin apps, sin instalaciones. Para negocios argentinos.',
  keywords: 'WhatsApp, pedidos, automatización, Argentina, chatbot, negocio',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body className={inter.className}>{children}</body>
    </html>
  );
}

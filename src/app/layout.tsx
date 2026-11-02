import './globals.css';
import FloatingLogout from '@/components/FloatingLogout';

export const metadata = {
  title: 'WYAK Resto Suite',
  description: 'Management & POS Operations Dashboard',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" translate="no">
      <body className="antialiased bg-gray-950 text-gray-100 font-sans overflow-x-hidden selection:bg-amber-500 selection:text-gray-950">
        {children}
        {/* Global Floating Logout Widget for All Pages */}
        <FloatingLogout />
      </body>
    </html>
  );
}
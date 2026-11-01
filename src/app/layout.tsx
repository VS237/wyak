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
    <html lang="en" className="h-full" translate="no">
      <body className="h-full antialiased bg-gray-950 text-gray-100 font-sans">
        {children}
        {/* Global Floating Logout Widget for All Pages */}
        <FloatingLogout />
      </body>
    </html>
  );
}
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'HANA Export Utility',
  description: 'SAP HANA Cloud Data Export Utility',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-hana-dark text-white antialiased">
        {children}
      </body>
    </html>
  );
}

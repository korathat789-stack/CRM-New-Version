import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "CRM — Customers",
  description: "Customer management built with Next.js and Supabase",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen flex flex-col">
          <header className="border-b border-gray-200 bg-white">
            <div className="mx-auto max-w-6xl px-6 h-14 flex items-center justify-between">
              <Link href="/customers" className="flex items-center gap-2 font-semibold text-gray-900">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-indigo-600 text-white text-sm">
                  C
                </span>
                Acme CRM
              </Link>
              <nav className="text-sm text-gray-600">
                <Link href="/customers" className="hover:text-gray-900">
                  Customers
                </Link>
              </nav>
            </div>
          </header>
          <main className="flex-1">{children}</main>
        </div>
      </body>
    </html>
  );
}

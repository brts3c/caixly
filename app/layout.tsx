import type { Metadata } from "next";
import { headers } from "next/headers";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "https";
  const base = host ? `${protocol}://${host}` : "http://localhost:3000";
  const image = new URL("/og.png", base).toString();

  return {
    title: "Caixly — PDV simples para vender melhor",
    description:
      "PDV online, gestão de produtos e relatórios para pequenos negócios. Simples, rápido e acessível.",
    icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
    openGraph: {
      title: "Caixly — Seu negócio no ritmo que ele merece",
      description:
        "PDV online, gestão de produtos e relatórios para pequenos negócios.",
      images: [{ url: image, width: 1734, height: 907, alt: "Caixly" }],
      locale: "pt_BR",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "Caixly — Seu negócio no ritmo que ele merece",
      description:
        "PDV online, gestão de produtos e relatórios para pequenos negócios.",
      images: [image],
    },
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <meta name="referrer" content="strict-origin-when-cross-origin" />
        <meta httpEquiv="X-Content-Type-Options" content="nosniff" />
      </head>
      <body className={inter.variable}>{children}</body>
    </html>
  );
}

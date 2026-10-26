"use client";

import React from "react";
import Link from "next/link";
import {
  Shield,
  Zap,
  Globe,
  Lock,
  Server,
  ArrowRight,
  CheckCircle2,
  LayoutDashboard,
  Activity,
  Database,
  Building2,
  Code2,
  Store
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/30">
      {/* --- NAVIGATION --- */}
      <nav className="fixed top-0 w-full z-50 border-b bg-background/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-primary rounded-lg">
              <Globe className="h-6 w-6 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold tracking-tight">DevCloudhost</span>
          </div>
          <div className="hidden md:flex items-center gap-6 text-sm font-medium text-muted-foreground">
            <Link href="#features" className="hover:text-foreground transition-colors">Fitur</Link>
            <Link href="#use-cases" className="hover:text-foreground transition-colors">Solusi</Link>
            <Link href="#pricing" className="hover:text-foreground transition-colors">Harga</Link>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm">Masuk</Button>
            </Link>
            <Link href="/register">
              <Button size="sm" className="gap-2">
                Mulai Sekarang <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* --- HERO SECTION --- */}
      <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full -z-10">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/10 blur-[120px]" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-500/10 blur-[120px]" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Badge variant="outline" className="mb-4 py-1 px-4 rounded-full border-primary/30 text-primary bg-primary/5 animate-bounce">
            🚀 Solusi Instan Tanpa IP Public
          </Badge>
          <h1 className="text-5xl lg:text-7xl font-extrabold tracking-tight mb-6 bg-clip-text text-transparent bg-gradient-to-b from-foreground to-muted-foreground">
            Online-kan Server Lokal <br className="hidden lg:block" /> Anda dalam 60 Detik.
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            Akses server internal, database, atau aplikasi localhost Anda dari internet secara aman menggunakan
            <span className="text-foreground font-semibold"> DevCloudhost Secure Gateway</span>.
            Tanpa ribet urus IP Public ke ISP.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/register">
              <Button size="lg" className="h-14 px-8 text-lg font-semibold gap-2 rounded-full transition-transform hover:scale-105">
                Mulai Sekarang <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
            <Link href="#features">
              <Button size="lg" variant="outline" className="h-14 px-8 text-lg font-semibold rounded-full">
                Pelajari Fitur
              </Button>
            </Link>
          </div>

          {/* Mockup Dashboard Preview */}
          <div className="mt-16 relative max-w-5xl mx-auto rounded-2xl border bg-muted/30 p-2 shadow-2xl animate-in fade-in slide-in-from-bottom-8 duration-1000">
            <div className="rounded-xl border bg-background overflow-hidden aspect-video flex items-center justify-center text-muted-foreground italic">
              <div className="flex flex-col items-center gap-4">
                <LayoutDashboard className="h-12 w-12 opacity-20" />
                <p>Preview Dashboard DevCloudhost</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* --- PAIN POINTS --- */}
      <section className="py-20 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold mb-12">Kenapa Memilih DevCloudhost?</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                title: "Lupakan IP Public",
                desc: "Tidak perlu lagi menunggu berminggu-minggu pengajuan IP Public ke ISP yang mahal dan rumit.",
                icon: Globe,
                color: "text-blue-500"
              },
              {
                title: "Keamanan Enterprise",
                desc: "Enkripsi end-to-end menggunakan WireGuard. Data Anda aman, terisolasi, dan terenkripsi sepenuhnya.",
                icon: Shield,
                color: "text-indigo-500"
              },
              {
                title: "Setup Tanpa Ribet",
                desc: "Satu baris perintah (one-liner) untuk mengaktifkan tunnel. Tidak perlu konfigurasi firewall yang kompleks.",
                icon: Zap,
                color: "text-orange-500"
              }
            ].map((item, i) => (
              <Card key={i} className="border-none bg-transparent shadow-none text-center">
                <CardContent className="p-6">
                  <div className={`mx-auto w-12 h-12 rounded-full bg-background border flex items-center justify-center mb-4 ${item.color}`}>
                    <item.icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">{item.title}</h3>
                  <p className="text-muted-foreground">{item.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* --- KEY FEATURES --- */}
      <section id="features" className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Fitur Unggulan</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Semua alat yang Anda butuhkan untuk mengelola koneksi server internal secara profesional.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                title: "Multi-Port Forwarding",
                desc: "Buka banyak port sekaligus (HTTP, DB, SSH) dalam satu tunnel. Sempurna untuk aplikasi kompleks.",
                icon: Server,
              },
              {
                title: "Static Public IP",
                desc: "Dapatkan IP publik tetap untuk kebutuhan whitelisting API BPJS, SatuSehat, atau integrasi B2B.",
                icon: Database,
              },
              {
                title: "Instant Provisioning",
                desc: "Aktifkan tunnel dalam hitungan detik. Tidak ada downtime, tidak ada konfigurasi manual yang membosankan.",
                icon: Zap,
              },
              {
                title: "Health Monitoring",
                desc: "Pantau status koneksi tunnel Anda secara real-time. Notifikasi instan jika server offline.",
                icon: Activity,
              },
              {
                title: "Enterprise Security",
                desc: "Enkripsi tingkat tinggi dengan WireGuard. Akses terkontrol dengan RBAC dan Audit Log.",
                icon: Lock,
              },
              {
                title: "Universal Compatibility",
                desc: "Bekerja di semua OS Linux. Cocok untuk server legacy maupun modern.",
                icon: Globe,
              },
            ].map((feature, i) => (
              <Card key={i} className="group hover:border-primary transition-all duration-300">
                <CardContent className="p-6 flex gap-4">
                  <div className="p-3 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <feature.icon className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg mb-1">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{feature.desc}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* --- USE CASES --- */}
      <section id="use-cases" className="py-20 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Siapa yang Menggunakan DevCloudhost?</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Solusi kami dirancang untuk berbagai skala kebutuhan infrastruktur.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                title: "Rumah Sakit & Klinik",
                desc: "Meng-online-kan SIMRS untuk integrasi BPJS/SatuSehat tanpa perlu IP Public ISP.",
                icon: Building2,
                highlight: "Sangat Direkomendasikan"
              },
              {
                title: "UMKM & Startup",
                desc: "Menjalankan server stok atau aplikasi internal dari kantor/rumah dengan biaya terjangkau.",
                icon: Store,
                highlight: "Hemat Biaya"
              },
              {
                title: "Software Developers",
                desc: "Demo aplikasi localhost ke klien atau testing webhook API secara instan.",
                icon: Code2,
                highlight: "Produktivitas Tinggi"
              },
            ].map((useCase, i) => (
              <Card key={i} className="border-2 border-transparent hover:border-primary/50 transition-all duration-300">
                <CardHeader>
                  <div className="flex justify-between items-start mb-2">
                    <div className="p-2 bg-primary/10 rounded-lg text-primary">
                      <useCase.icon className="h-6 w-6" />
                    </div>
                    <Badge variant="secondary" className="text-[10px]">{useCase.highlight}</Badge>
                  </div>
                  <CardTitle className="text-xl">{useCase.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground leading-relaxed">{useCase.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* --- PRICING --- */}
      <section id="pricing" className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Harga Transparan</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Pilih paket yang sesuai dengan skala kebutuhan infrastruktur Anda.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                name: "Starter",
                price: "Rp 50k",
                period: "/bulan",
                features: ["1 Tunnel", "Dynamic Public IP", "1 Port Mapping", "Standard Support"],
                cta: "Mulai Sekarang",
                featured: false
              },
              {
                name: "Professional",
                price: "Rp 250k",
                period: "/bulan",
                features: ["3 Tunnels", "1 Static Public IP", "Up to 10 Port Mappings", "Priority Support"],
                cta: "Pilih Pro",
                featured: true
              },
              {
                name: "Enterprise",
                price: "Custom",
                period: "/kontrak",
                features: ["Unlimited Tunnels", "Multiple Static IPs", "Full Managed Setup", "SLA 99.9% Guarantee"],
                cta: "Hubungi Kami",
                featured: false
              },
            ].map((plan, i) => (
              <Card key={i} className={`relative ${plan.featured ? "border-primary shadow-xl scale-105 z-10" : "border-muted"}`}>
                {plan.featured && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full">
                    Paling Populer
                  </div>
                )}
                <CardHeader className="text-center">
                  <CardTitle className="text-2xl font-bold">{plan.name}</CardTitle>
                  <div className="mt-4 flex items-baseline justify-center gap-1">
                    <span className="text-4xl font-extrabold">{plan.price}</span>
                    <span className="text-muted-foreground">{plan.period}</span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <ul className="space-y-3">
                    {plan.features.map((f, idx) => (
                      <li key={idx} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <CheckCircle2 className="h-4 w-4 text-green-500" /> {f}
                      </li>
                    ))}
                  </ul>
                  <Button
                    className={`w-full h-12 font-semibold ${plan.featured ? "bg-primary hover:bg-primary/90" : "variant-outline"}`}
                    variant={plan.featured ? "default" : "outline"}
                  >
                    {plan.cta}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* --- CTA SECTION --- */}
      <section className="py-20 bg-primary text-primary-foreground overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent" />
        </div>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <h2 className="text-4xl font-bold mb-6">Siap Mengonline-kan Server Anda?</h2>
          <p className="text-lg text-primary-foreground/80 mb-10 leading-relaxed">
            Bergabunglah dengan ratusan pengelola infrastruktur yang telah beralih ke DevCloudhost.
            Cepat, Aman, dan Tanpa Ribet.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/register">
              <Button size="lg" variant="secondary" className="h-14 px-8 text-lg font-semibold gap-2 rounded-full">
                Daftar Gratis Sekarang <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* --- FOOTER --- */}
      <footer className="py-12 border-t bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="p-1 bg-primary rounded-md">
                <Globe className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="text-lg font-bold tracking-tight">DevCloudhost</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} DevCloudhost. All rights reserved.
            </p>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <Link href="/terms" className="hover:text-foreground">Terms</Link>
              <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

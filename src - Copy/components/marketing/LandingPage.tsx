import Link from "next/link";
import { Cloud, Server, LayoutGrid, Globe2, Zap, Wallet, Terminal as TerminalIcon, ArrowRight } from "lucide-react";
import { TerminalDemo } from "./TerminalDemo";

const REGIONS = ["Jakarta 1", "Jakarta 2", "Surabaya 1", "Singapore 1"];

const PRODUCTS = [
  {
    name: "Cloud VPS",
    description: "Root SSH penuh, resource sendiri. Dari 1 vCPU / 1GB RAM sampai 8 vCPU / 16GB RAM.",
    price: "Rp 75.000",
    unit: "/bln",
    icon: Server,
    href: "/register",
    highlight: true,
  },
  {
    name: "App Deployer",
    description: "WordPress, Node.js, Docker, PostgreSQL, MySQL, atau Redis — siap pakai dalam hitungan menit.",
    price: "Termasuk",
    unit: "di VPS kamu",
    icon: LayoutGrid,
    href: "/register",
    highlight: false,
  },
  {
    name: "Shared Hosting",
    description: "Hosting murah untuk website & WordPress skala kecil, tanpa perlu kelola server sendiri.",
    price: "Segera Hadir",
    unit: "",
    icon: Globe2,
    href: "#",
    highlight: false,
    comingSoon: true,
  },
];

const FEATURES = [
  {
    icon: Zap,
    title: "Provisioning dalam hitungan detik",
    description: "VPS baru siap dipakai begitu pembayaran masuk — tidak perlu menunggu tiket support.",
  },
  {
    icon: Wallet,
    title: "Bayar sesuai pemakaian",
    description: "Saldo wallet prepaid, ditagih per jam selama instance menyala. Matikan kapan saja, berhenti dihitung.",
  },
  {
    icon: TerminalIcon,
    title: "Kontrol penuh dari console",
    description: "Start, stop, reboot, snapshot, dan atur firewall langsung dari dashboard — tanpa buka tiket.",
  },
];

export function LandingPage() {
  return (
    <div className="bg-background">
      <Nav />
      <Hero />
      <Products />
      <Features />
      <DataCenters />
      <CtaBand />
      <Footer />
    </div>
  );
}

function Nav() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0a0e17]/95 backdrop-blur">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Cloud className="h-4.5 w-4.5" />
          </div>
          <span className="font-display font-bold text-lg tracking-tight text-white">CloudConsole</span>
        </Link>
        <nav className="hidden md:flex items-center gap-8 text-sm text-white/70">
          <a href="#produk" className="hover:text-white transition-colors">Produk</a>
          <a href="#lokasi" className="hover:text-white transition-colors">Data Center</a>
          <Link href="/berita" className="hover:text-white transition-colors">Berita</Link>
        </nav>
        <div className="flex items-center gap-3">
          <Link href="/login" className="text-sm font-medium text-white/80 hover:text-white transition-colors px-3 py-2">
            Masuk
          </Link>
          <Link
            href="/register"
            className="text-sm font-medium bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition-colors"
          >
            Daftar
          </Link>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="bg-[#0a0e17] text-white">
      <div className="container grid lg:grid-cols-[1.1fr_1fr] gap-16 py-20 lg:py-28 items-center">
        <div className="max-w-xl">
          <h1 className="font-display font-bold text-4xl sm:text-5xl leading-[1.1] tracking-tight">
            Cloud VPS Indonesia yang menyala secepat kamu mengetik perintahnya.
          </h1>
          <p className="mt-6 text-lg text-white/60 leading-relaxed">
            Deploy VPS, jalankan WordPress atau aplikasi kamu sendiri, dan kelola semuanya dari satu console —
            data center Jakarta &amp; Surabaya, ditagih per jam, tanpa kontrak.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-4">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-md font-medium hover:bg-primary/90 transition-colors"
            >
              Mulai Sekarang <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 border border-white/15 text-white px-6 py-3 rounded-md font-medium hover:bg-white/5 transition-colors"
            >
              Masuk ke Console
            </Link>
          </div>
          <p className="mt-6 text-sm text-white/40">Mulai dari Rp 75.000/bulan. Tanpa biaya setup.</p>
        </div>
        <TerminalDemo />
      </div>
    </section>
  );
}

function Products() {
  return (
    <section id="produk" className="container py-20 lg:py-28">
      <div className="max-w-xl mb-14">
        <h2 className="font-display font-bold text-3xl tracking-tight">Satu console, tiga cara deploy.</h2>
        <p className="mt-3 text-muted-foreground">
          Pilih sesuai kebutuhan — dari VPS mentah dengan kontrol penuh, sampai aplikasi yang tinggal pakai.
        </p>
      </div>
      <div className="grid md:grid-cols-3 gap-6">
        {PRODUCTS.map((p) => (
          <div
            key={p.name}
            className={
              p.highlight
                ? "rounded-xl border-2 border-primary bg-primary/[0.03] p-7 flex flex-col"
                : "rounded-xl border border-border p-7 flex flex-col"
            }
          >
            <p.icon className={p.highlight ? "h-7 w-7 text-primary" : "h-7 w-7 text-muted-foreground"} />
            <h3 className="font-display font-bold text-xl mt-4">{p.name}</h3>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed flex-1">{p.description}</p>
            <div className="mt-6 flex items-baseline gap-1.5">
              <span className="text-2xl font-bold tracking-tight">{p.price}</span>
              {p.unit && <span className="text-sm text-muted-foreground">{p.unit}</span>}
            </div>
            {p.comingSoon ? (
              <span className="mt-4 inline-flex w-fit items-center rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                Segera hadir
              </span>
            ) : (
              <Link
                href={p.href}
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline w-fit"
              >
                Pilih paket ini <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function Features() {
  return (
    <section className="bg-secondary/40 py-20 lg:py-28">
      <div className="container grid md:grid-cols-3 gap-10">
        {FEATURES.map((f) => (
          <div key={f.title}>
            <f.icon className="h-6 w-6 text-primary" />
            <h3 className="font-display font-bold text-lg mt-4">{f.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{f.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function DataCenters() {
  return (
    <section id="lokasi" className="container py-20 lg:py-28">
      <div className="max-w-xl mb-10">
        <h2 className="font-display font-bold text-3xl tracking-tight">Lokasi data center.</h2>
        <p className="mt-3 text-muted-foreground">
          Pilih region terdekat dengan pengguna kamu supaya latensi tetap rendah.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        {REGIONS.map((r) => (
          <span
            key={r}
            className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm"
          >
            <Globe2 className="h-3.5 w-3.5 text-muted-foreground" />
            {r}
          </span>
        ))}
      </div>
    </section>
  );
}

function CtaBand() {
  return (
    <section className="bg-[#0a0e17] text-white">
      <div className="container py-20 text-center">
        <h2 className="font-display font-bold text-3xl sm:text-4xl tracking-tight max-w-xl mx-auto">
          Siap deploy VPS pertama kamu?
        </h2>
        <p className="mt-4 text-white/60">Daftar gratis, isi saldo, langsung jalan. Tanpa komitmen jangka panjang.</p>
        <Link
          href="/register"
          className="mt-8 inline-flex items-center gap-2 bg-primary text-primary-foreground px-7 py-3.5 rounded-md font-medium hover:bg-primary/90 transition-colors"
        >
          Daftar Gratis <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="container py-10 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded bg-primary text-primary-foreground">
            <Cloud className="h-3.5 w-3.5" />
          </div>
          <span className="font-display font-bold">CloudConsole</span>
        </div>
        <nav className="flex items-center gap-6">
          <Link href="/berita" className="hover:text-foreground transition-colors">Berita</Link>
          <Link href="/login" className="hover:text-foreground transition-colors">Masuk</Link>
          <Link href="/register" className="hover:text-foreground transition-colors">Daftar</Link>
        </nav>
        <p>© {new Date().getFullYear()} CloudConsole.</p>
      </div>
    </footer>
  );
}

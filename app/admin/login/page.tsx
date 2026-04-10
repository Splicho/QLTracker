import Image from "next/image"
import Link from "next/link"

export const dynamic = "force-dynamic"

export default function AdminLoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#050505_0%,#121212_100%)] px-6 py-10 text-white sm:px-10">
      <div className="w-full max-w-md rounded-[2rem] border border-white/10 bg-white/5 p-8 shadow-2xl shadow-black/30 backdrop-blur">
        <div className="flex flex-col items-center gap-8 text-center">
          <Image
            alt="QLTracker"
            height={51}
            priority
            src="/images/logo.png"
            width={176}
          />

          <Link
            className="inline-flex h-12 w-full items-center justify-center rounded-full bg-white px-5 text-sm font-semibold text-black transition hover:bg-white/90"
            href="/admin/login/start"
          >
            Continue with Steam
          </Link>
        </div>
      </div>
    </main>
  )
}

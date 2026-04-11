import { redirect } from "next/navigation"

import { AdminShell } from "@/components/pickup-admin-shell"
import { getPickupBrowserSession } from "@/lib/server/pickup-auth"
import { toPickupPlayerDto } from "@/lib/server/pickup"

export const dynamic = "force-dynamic"

export default async function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getPickupBrowserSession()

  if (!session) {
    redirect("/admin/login")
  }

  if (!session.isAdmin) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#050505_0%,#121212_100%)] px-6 text-white">
        <div className="max-w-lg rounded-3xl border border-white/10 bg-[#0d0d0d] p-8 text-center">
          <p className="text-sm tracking-[0.28em] text-accent/80 uppercase">
            Access denied
          </p>
          <h1 className="mt-3 text-3xl font-semibold">
            Pickup admin access is restricted
          </h1>
          <p className="mt-4 text-sm text-white/60">
            This Steam account is not authorized for the pickup admin dashboard.
          </p>
        </div>
      </main>
    )
  }

  return (
    <AdminShell viewer={toPickupPlayerDto(session.player)}>
      {children}
    </AdminShell>
  )
}

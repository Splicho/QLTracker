import { ArrowRight } from "lucide-react"
import { motion } from "framer-motion"
import { Steam } from "@/components/icon"
import { Button } from "@/components/ui/button"

export function PickupAuthGate({
  isLinking,
  onContinueAsGuest,
  onConnectWithSteam,
}: {
  isLinking: boolean
  onContinueAsGuest: () => void
  onConnectWithSteam: () => void
}) {
  return (
    <main className="min-h-screen bg-gradient-to-t from-background via-background to-[#1C1A1A] text-foreground">
      <section className="flex min-h-screen items-center justify-center px-8 py-10">
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
          initial={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        >
          <div className="flex flex-col gap-6 text-center">
            <img
              alt="QLTracker"
              className="mx-auto size-20 rounded-3xl"
              src="/images/appicon.png"
            />
          </div>

          <div className="mt-10 flex flex-col gap-3">
            <Button
              className="h-12 justify-center gap-2 rounded-sm text-base"
              disabled={isLinking}
              onClick={onConnectWithSteam}
            >
              <Steam data-icon="inline-start" />
              {isLinking ? "Waiting for Steam..." : "Continue with Steam"}
            </Button>
            <Button
              className="group h-12 justify-center gap-2 rounded-sm text-base"
              onClick={onContinueAsGuest}
              variant="outline"
            >
              <span>Continue without login</span>
              <ArrowRight className="transition-transform duration-200 group-hover:translate-x-1" />
            </Button>
          </div>
        </motion.div>
      </section>
    </main>
  )
}

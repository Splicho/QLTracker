import { redirect } from "next/navigation"

export default async function PickupAdminNewsEditPage({
  params,
}: {
  params: Promise<{ articleId: string }>
}) {
  const { articleId } = await params
  redirect(`/admin/news/${articleId}`)
}

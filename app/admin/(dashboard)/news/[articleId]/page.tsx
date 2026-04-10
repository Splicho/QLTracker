import { notFound } from "next/navigation";

import { PickupAdminNewsEdit } from "@/components/pickup-admin-news-edit";
import { getNewsArticleById, toNewsArticleDto } from "@/lib/server/news";

export default async function AdminNewsEditPage({
  params,
}: {
  params: Promise<{ articleId: string }>;
}) {
  const { articleId } = await params;
  const article = await getNewsArticleById(articleId);

  if (!article) {
    notFound();
  }

  return <PickupAdminNewsEdit article={toNewsArticleDto(article)} />;
}

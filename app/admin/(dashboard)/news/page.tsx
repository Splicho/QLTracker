import { PickupAdminNews } from "@/components/pickup-admin-news";
import { listNewsArticleDtos } from "@/lib/server/news";

export default async function AdminNewsPage() {
  return <PickupAdminNews initialArticles={await listNewsArticleDtos()} />;
}

import { queryRows } from './database.js';

type QueueChoiceRow = {
  name: string;
  slug: string;
};

export function formatQueueName(queueName: string) {
  return queueName.trim() || 'pickup';
}

export async function listActiveQueueChoices(search: string) {
  const rows = await queryRows<QueueChoiceRow>(
    `
      select q."name", q."slug"
      from "PickupQueue" q
      where q."enabled" = true
        and exists (
          select 1
          from "PickupSeason" s
          where s."queueId" = q."id"
            and s."status" = 'active'
        )
        and ($1::text = '' or q."name" ilike '%' || $1 || '%' or q."slug" ilike '%' || $1 || '%')
      order by q."teamSize" asc, q."name" asc
      limit 25
    `,
    [search.trim()]
  );

  return rows.map((row) => ({
    name: row.name,
    value: row.slug
  }));
}

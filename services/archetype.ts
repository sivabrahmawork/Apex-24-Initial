// services/archetype.ts — nightly archetype computation from classification history.
// Rules: >=10 classified, non-hidden comments; dominant category share >= 40%.
// questions -> questioner | solutions -> solver | analysis+pro+con -> analyst.
// Measures behavior share, NOT correctness — never present these as accuracy awards.
import { db } from "../lib/db";
import { sql } from "drizzle-orm";

const MIN_CLASSIFIED = 10;
const MIN_SHARE = 0.4;

export async function recomputeArchetypes() {
  const rows = (await db.execute(sql`
    select c.persona_id,
      count(*)::int as total,
      count(*) filter (where coalesce(cc.corrected_label, cc.label) = 'question')::int as q,
      count(*) filter (where coalesce(cc.corrected_label, cc.label) = 'solution')::int as s,
      count(*) filter (where coalesce(cc.corrected_label, cc.label) in ('analysis','pro','con'))::int as a
    from comments c
    join comment_classifications cc on cc.comment_id = c.id
    where cc.confidence >= 0.55 or cc.user_corrected
    group by c.persona_id
    having count(*) >= ${MIN_CLASSIFIED}`)) as any[];

  let updated = 0;
  for (const r of rows) {
    const shares: [string, number][] = [
      ["questioner", r.q / r.total], ["solver", r.s / r.total], ["analyst", r.a / r.total]];
    shares.sort((x, y) => y[1] - x[1]);
    const archetype = shares[0][1] >= MIN_SHARE ? shares[0][0] : null;
    await db.execute(sql`update personas set archetype = ${archetype},
      archetype_computed_at = now() where id = ${r.persona_id}`);
    updated++;
  }
  return { personasEvaluated: rows.length, updated };
}

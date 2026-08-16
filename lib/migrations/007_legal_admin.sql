-- lib/migrations/007_legal_admin.sql — legal-order intake + editor action log + author notices.
CREATE TABLE IF NOT EXISTS legal_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL,
  agency text NOT NULL,          -- issuing authority (court / authorized agency)
  order_ref text NOT NULL,       -- order or notification reference number
  legal_basis text NOT NULL,     -- e.g. "S.69A IT Act", "IT Rules 3(1)(d)", court case no.
  actioned_by uuid NOT NULL,     -- editor user id
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS editor_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL,
  action text NOT NULL,          -- 'deleted'
  reason text NOT NULL,          -- mandatory, shown on internal audit
  editor_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS author_notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL,
  kind text NOT NULL,            -- 'legal_takedown' | 'editor_removal'
  detail text,
  created_at timestamptz NOT NULL DEFAULT now()
);

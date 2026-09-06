-- ============================================================================
-- AI Operations — Operations Wall widget configuration (persistent).
--
-- Prompt 1/3: a dedicated, persistent per-site wall-widget configuration layer.
-- The authoritative site identity source remains `ai_sites` (site_key → id).
-- This table holds ONE widget per site, linked by the resolved `ai_sites.id`
-- UUID, plus the wall's presentational settings (display name, initials,
-- subtitle, approved brand colour, visibility, ordering, hub flag).
--
-- Guarantees:
--   * One widget per site      → UNIQUE (site_id).
--   * One central DFP hub      → partial unique index (is_hub = true).
--   * Brand colour is validated → CHECK against the approved palette.
--   * Repeatable seed          → INSERT ... ON CONFLICT (site_id) DO NOTHING,
--                                so a re-run never overwrites later user edits.
--
-- Auth model (unchanged): reuses public.internal_role() (owner/admin/viewer).
--   * Read  → any authenticated internal viewer (internal_role() IS NOT NULL).
--   * Write → owner/admin only.
--   * Delete→ owner only.
--   * Anonymous access is denied (no policies for the anon role).
--   * No credentials are stored here (display metadata only).
--
-- This migration does NOT change the visible wall layout, create duplicate site
-- records, enable workflows, or alter monitoring.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. TABLE
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_site_widgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL UNIQUE REFERENCES public.ai_sites(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  initials text NOT NULL,
  subtitle text,
  brand_color text NOT NULL,
  visible_on_wall boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  visible_in_autonomous boolean NOT NULL DEFAULT true,
  is_hub boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_site_widgets_brand_color_check CHECK (
    brand_color IN ('cyan','blue','teal','orange','purple','yellow','pink','violet')
  ),
  CONSTRAINT ai_site_widgets_display_order_check CHECK (display_order >= 0),
  CONSTRAINT ai_site_widgets_initials_len_check CHECK (char_length(initials) BETWEEN 1 AND 4)
);

-- ---------------------------------------------------------------------------
-- 2. INDEXES (one central hub only)
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS ai_site_widgets_display_order_idx
  ON public.ai_site_widgets (display_order);

CREATE INDEX IF NOT EXISTS ai_site_widgets_site_id_idx
  ON public.ai_site_widgets (site_id);

-- At most one widget may be the central DFP hub.
CREATE UNIQUE INDEX IF NOT EXISTS ai_site_widgets_single_hub_idx
  ON public.ai_site_widgets ((is_hub))
  WHERE is_hub = true;

-- ---------------------------------------------------------------------------
-- 3. UPDATED_AT TRIGGER (reuse existing public.set_updated_at())
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS ai_site_widgets_set_updated_at ON public.ai_site_widgets;
CREATE TRIGGER ai_site_widgets_set_updated_at
  BEFORE UPDATE ON public.ai_site_widgets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY (least privilege)
-- ---------------------------------------------------------------------------
ALTER TABLE public.ai_site_widgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY ai_site_widgets_select ON public.ai_site_widgets
  FOR SELECT TO authenticated
  USING (public.internal_role() IS NOT NULL);

CREATE POLICY ai_site_widgets_insert ON public.ai_site_widgets
  FOR INSERT TO authenticated
  WITH CHECK (public.internal_role() IN ('owner','admin'));

CREATE POLICY ai_site_widgets_update ON public.ai_site_widgets
  FOR UPDATE TO authenticated
  USING (public.internal_role() IN ('owner','admin'))
  WITH CHECK (public.internal_role() IN ('owner','admin'));

CREATE POLICY ai_site_widgets_delete ON public.ai_site_widgets
  FOR DELETE TO authenticated
  USING (public.internal_role() = 'owner');

-- ---------------------------------------------------------------------------
-- 5. SEED — the eight existing wall widgets (appearance + order preserved).
--
-- Site identity resolved by the stable registry key (never by display-name
-- spelling). The Forge uses its own identity (site_key 'the-forge' → "The
-- Forge" / "TF"); there is no BuildNerve alias and no BuildNerve widget.
-- Vowora retains its existing 'wedora' database mapping (site_key 'wedora' →
-- "Vowora" / "VW"). ON CONFLICT DO NOTHING keeps this repeatable without
-- overwriting later user edits.
-- ---------------------------------------------------------------------------
INSERT INTO public.ai_site_widgets (
  site_id, display_name, initials, subtitle, brand_color,
  visible_on_wall, display_order, visible_in_autonomous, is_hub
) VALUES
  ((SELECT id FROM public.ai_sites WHERE site_key = 'digital-footprint'), 'DFP',        'DFP', 'AGENCY & OPERATIONS',  'cyan',   true, 0, true, true),
  ((SELECT id FROM public.ai_sites WHERE site_key = 'quickguard'),       'QuickGuard', 'QG',  'SECURITY MARKETPLACE',  'blue',   true, 1, true, false),
  ((SELECT id FROM public.ai_sites WHERE site_key = 'guardianhub'),      'GuardianHub','GH',  'SECURITY COMPANIES',     'teal',   true, 2, true, false),
  ((SELECT id FROM public.ai_sites WHERE site_key = 'the-forge'),        'The Forge',  'TF',  'AI BUILD PLATFORM',      'orange', true, 3, true, false),
  ((SELECT id FROM public.ai_sites WHERE site_key = 'lethub'),           'LetHub',     'LH',  'LETTINGS PLATFORM',      'purple', true, 4, true, false),
  ((SELECT id FROM public.ai_sites WHERE site_key = 'garageflow'),       'GarageFlow', 'GF',  'VEHICLE CARE',           'yellow', true, 5, true, false),
  ((SELECT id FROM public.ai_sites WHERE site_key = 'wedora'),           'Vowora',     'VW',  'WEDDING PLANNING',       'pink',   true, 6, true, false),
  ((SELECT id FROM public.ai_sites WHERE site_key = 'synqoro'),          'Synqoro',    'SQ',  'AI & DATA SOLUTIONS',    'violet', true, 7, true, false)
ON CONFLICT (site_id) DO NOTHING;
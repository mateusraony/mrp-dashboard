-- ─── economic_calendar_notifications ──────────────────────────────────────────
-- Tabela dedicada para controle anti-duplicação de alertas do calendário econômico.
-- Separada do telegram_delivery_log para permitir diferentes canais futuros.
--
-- Constraints de unicidade:
--   • (event_id, notification_type) para pre_5min e post_release
--   • (notification_date_brt, notification_type) para daily_summary
-- ───────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS economic_calendar_notifications (
  id                    uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id              text         NULL REFERENCES economic_calendar_events(id) ON DELETE CASCADE,
  notification_type     text         NOT NULL CHECK (notification_type IN (
                                       'daily_summary', 'pre_5min', 'post_release',
                                       'source_failure', 'actual_missing_warning'
                                     )),
  notification_date_brt date         NULL,       -- usado por daily_summary
  scheduled_for_utc     timestamptz  NULL,
  scheduled_for_brt     timestamptz  NULL,
  sent_at               timestamptz  NULL,
  channel               text         NOT NULL DEFAULT 'telegram',
  status                text         NOT NULL DEFAULT 'pending'
                                       CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
  telegram_message_id   text         NULL,
  error_message         text         NULL,
  payload               jsonb        NULL,
  created_at            timestamptz  NOT NULL DEFAULT now(),
  updated_at            timestamptz  NOT NULL DEFAULT now()
);

-- ─── Anti-duplicação ──────────────────────────────────────────────────────────
-- Previne reenvio do mesmo alerta pré/pós evento
CREATE UNIQUE INDEX IF NOT EXISTS ecn_event_type_unique
  ON economic_calendar_notifications (event_id, notification_type)
  WHERE event_id IS NOT NULL AND notification_type != 'daily_summary';

-- Previne reenvio do daily summary no mesmo dia
CREATE UNIQUE INDEX IF NOT EXISTS ecn_daily_summary_unique
  ON economic_calendar_notifications (notification_date_brt, channel)
  WHERE notification_type = 'daily_summary' AND notification_date_brt IS NOT NULL;

-- ─── Índices de query ─────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS ecn_notification_type_idx ON economic_calendar_notifications (notification_type);
CREATE INDEX IF NOT EXISTS ecn_status_idx            ON economic_calendar_notifications (status);
CREATE INDEX IF NOT EXISTS ecn_event_id_idx          ON economic_calendar_notifications (event_id);
CREATE INDEX IF NOT EXISTS ecn_sent_at_idx           ON economic_calendar_notifications (sent_at);
CREATE INDEX IF NOT EXISTS ecn_date_brt_idx          ON economic_calendar_notifications (notification_date_brt);

-- ─── Trigger: updated_at automático ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_ecn_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ecn_updated_at ON economic_calendar_notifications;
CREATE TRIGGER trg_ecn_updated_at
  BEFORE UPDATE ON economic_calendar_notifications
  FOR EACH ROW EXECUTE FUNCTION update_ecn_updated_at();

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE economic_calendar_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ecn_select_public   ON economic_calendar_notifications;
DROP POLICY IF EXISTS ecn_write_service   ON economic_calendar_notifications;

-- Leitura pública (front-end pode exibir histórico de notificações)
CREATE POLICY ecn_select_public ON economic_calendar_notifications
  FOR SELECT USING (true);

-- Escrita apenas via service_role (scripts backend/GitHub Actions)
CREATE POLICY ecn_write_service ON economic_calendar_notifications
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ─── View de diagnóstico ──────────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_notification_health AS
SELECT
  notification_type,
  channel,
  status,
  COUNT(*)                                                    AS total,
  COUNT(*) FILTER (WHERE sent_at >= now() - INTERVAL '24h') AS last_24h,
  MAX(sent_at)                                                AS last_sent,
  COUNT(*) FILTER (WHERE status = 'failed')                  AS failed_total
FROM economic_calendar_notifications
GROUP BY notification_type, channel, status
ORDER BY notification_type, channel, status;

COMMENT ON TABLE economic_calendar_notifications IS
  'Controle anti-duplicação de alertas do calendário econômico. '
  'Garantias: pre_5min e post_release únicos por event_id; '
  'daily_summary único por dia/canal.';

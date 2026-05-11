// ─── PORTFOLIO MANAGER PAGE ──────────────────────────────────────────────────────────────
import { useState, useMemo, useEffect, useRef } from 'react';
import {
  computePortfolioGreeks, computePositionPnL,
  stressTest, stressScenarios, SPOT_PRICE,
} from '../components/data/mockDataPortfolio';
import { usePortfolioPositions, useUpsertPosition, useDeletePosition } from '@/hooks/useSupabase';
import { useBtcTicker, useKlines } from '@/hooks/useBtcData';
import { computeLiveRiskMetrics } from '@/utils/riskCalculations';
import { IS_LIVE } from '@/lib/env';
import { ModeBadge } from '../components/ui/DataBadge';
import { StaleIndicator } from '../components/ui/StaleIndicator';
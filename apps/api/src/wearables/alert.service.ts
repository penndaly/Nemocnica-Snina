/**
 * Clinical alert engine (Sprint W5).
 *
 * evaluateReading classifies a numeric reading against the patient's thresholds
 * (per-patient row if present, else DEFAULT_THRESHOLDS) and emits to RabbitMQ:
 *   • critical → wearables.alert.critical (immediate; SMS within 60 s downstream)
 *   • high/low + share_with_physician → wearables.alert.batch (15-min digest)
 * Normal readings emit nothing. No raw RC ever leaves this layer.
 */
import { Injectable, Logger } from '@nestjs/common';
import type { DeviceReading, WearableDevice } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  classify,
  DEFAULT_THRESHOLDS,
  type AlertResult,
  type ThresholdSet,
} from './alert-thresholds';
import {
  RK_ALERT_BATCH,
  RK_ALERT_CRITICAL,
  WearablesQueueService,
} from './wearables-queue.service';

@Injectable()
export class AlertService {
  private readonly logger = new Logger(AlertService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: WearablesQueueService,
  ) {}

  /**
   * Resolve the effective threshold set for (patient, metric). Precedence:
   *   1. physician per-patient row (device_alert_thresholds, W5) — always wins
   *   2. global admin default (wearable_global_thresholds, A4) — fallback
   *   3. hardcoded DEFAULT_THRESHOLDS — last resort
   */
  async thresholdsFor(patientToken: string, metricType: string): Promise<ThresholdSet | null> {
    const row = await this.prisma.deviceAlertThreshold.findUnique({
      where: { patientToken_metricType: { patientToken, metricType } },
    });
    if (row) {
      return {
        high: row.thresholdHigh !== null ? Number(row.thresholdHigh) : null,
        low: row.thresholdLow !== null ? Number(row.thresholdLow) : null,
        criticalHigh: row.thresholdCriticalHigh !== null ? Number(row.thresholdCriticalHigh) : null,
        criticalLow: row.thresholdCriticalLow !== null ? Number(row.thresholdCriticalLow) : null,
      };
    }
    const global = await this.prisma.wearableGlobalThreshold.findUnique({ where: { metricType } });
    if (global) {
      return {
        high: global.highHigh,
        low: global.highLow,
        criticalHigh: global.criticalHigh,
        criticalLow: global.criticalLow,
      };
    }
    return DEFAULT_THRESHOLDS[metricType] ?? null;
  }

  /** Classify a single reading. Non-numeric metrics (e.g. ECG text) are normal. */
  async evaluateReading(
    reading: Pick<DeviceReading, 'metricType' | 'valueNumeric'>,
    patientToken: string,
  ): Promise<AlertResult> {
    if (reading.valueNumeric === null || reading.valueNumeric === undefined) {
      return { flag: 'normal', exceeded: null };
    }
    const t = await this.thresholdsFor(patientToken, reading.metricType);
    if (!t) return { flag: 'normal', exceeded: null };
    return classify(Number(reading.valueNumeric), t);
  }

  /**
   * Evaluate a freshly-ingested reading and emit any alert. Returns the result so
   * the caller can persist the flag. Critical → immediate; high/low (when shared
   * with the physician) → batch digest.
   */
  async processReading(device: WearableDevice, reading: DeviceReading): Promise<AlertResult> {
    const result = await this.evaluateReading(reading, device.patientToken);
    if (result.flag === 'normal') return result;

    const base = {
      patientToken: device.patientToken,
      deviceId: device.id,
      deviceLabel: device.deviceLabel,
      readingId: reading.id,
      metricType: reading.metricType,
      value: reading.valueNumeric !== null ? Number(reading.valueNumeric) : reading.valueText,
      unit: reading.unit,
      flag: result.flag,
      exceeded: result.exceeded,
      recordedAt: reading.recordedAt.toISOString(),
    };

    if (result.flag === 'critical') {
      await this.queue.publish(RK_ALERT_CRITICAL, base);
    } else if (device.shareWithPhysician) {
      await this.queue.publish(RK_ALERT_BATCH, base);
    }
    return result;
  }
}

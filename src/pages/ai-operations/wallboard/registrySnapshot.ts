import { supabase } from '@/lib/supabase';
import type { BackupRecordRow, RestoreDrillRow } from './backupStore';
import type { BusinessCheckoutRow, BusinessInvoiceRow } from './businessStore';

export interface WallboardRegistrySnapshot {
  invoices: BusinessInvoiceRow[] | null;
  checkout: BusinessCheckoutRow[] | null;
  backupRecords: BackupRecordRow[] | null;
  restoreDrills: RestoreDrillRow[] | null;
}

export async function loadWallboardRegistries(): Promise<WallboardRegistrySnapshot | null> {
  try {
    const { data, error } = await supabase.functions.invoke<WallboardRegistrySnapshot>(
      'wallboard-registries', { body: {} },
    );
    return error ? null : data;
  } catch {
    return null;
  }
}

import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test from 'node:test';

const mockSupabase = 'data:text/javascript,' + encodeURIComponent(`
  export const supabase = {
    from: () => ({ select: () => Promise.resolve({ data: [], error: null }) }),
  };
`);
const hook = registerHooks({
  resolve(specifier, context, nextResolve) {
    return nextResolve(specifier === '@/lib/supabase' ? mockSupabase : specifier, context);
  },
});
const { clearBusinessData, getBusinessData, refreshBusinessData } = await import(
  '../src/pages/ai-operations/wallboard/businessStore.ts'
);
const { clearBackupData, getBackupData, refreshBackupData } = await import(
  '../src/pages/ai-operations/wallboard/backupStore.ts'
);
hook.deregister();

function refreshBoth(registries, session) {
  return Promise.all([
    refreshBusinessData(registries, session.signal),
    refreshBackupData(registries, session.signal),
  ]);
}

test('an account switch clears protected data and rejects late responses from the old session', async () => {
  const operator = new AbortController();
  const viewer = new AbortController();
  const rows = {
    invoices: [{ id: 'invoice' }],
    checkout: [{ id: 'checkout' }],
    backupRecords: [{ id: 'backup' }],
    restoreDrills: [{ id: 'restore' }],
  };

  await refreshBoth(Promise.resolve(rows), operator);
  assert.deepEqual(getBusinessData().invoices, rows.invoices);
  assert.deepEqual(getBusinessData().checkout, rows.checkout);
  assert.deepEqual(getBackupData().records, rows.backupRecords);
  assert.deepEqual(getBackupData().drills, rows.restoreDrills);

  const response = Promise.withResolvers();
  const lateRefresh = refreshBoth(response.promise, operator);
  operator.abort();
  clearBusinessData();
  clearBackupData();

  assert.deepEqual(getBusinessData().invoices, []);
  assert.deepEqual(getBusinessData().checkout, []);
  assert.deepEqual(getBackupData().records, []);
  assert.deepEqual(getBackupData().drills, []);

  await refreshBoth(Promise.resolve(null), viewer);
  const viewerBusiness = getBusinessData();
  const viewerBackup = getBackupData();
  response.resolve(rows);
  await lateRefresh;

  assert.equal(getBusinessData(), viewerBusiness);
  assert.equal(getBackupData(), viewerBackup);
  assert.equal(viewerBusiness.availability.invoices, false);
  assert.equal(viewerBusiness.availability.checkout, false);
  assert.equal(viewerBackup.recordsAvailability, false);
  assert.equal(viewerBackup.drillsAvailability, false);
});

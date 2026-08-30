import { useState } from 'react';
import type { UatJob, UatTestCase } from '../types';
import UatTestCaseFormModal from './UatTestCaseFormModal';
import UatTestCaseManagerModal from './UatTestCaseManagerModal';

interface Props {
  job: UatJob;
  projectName: string;
  caseCount: number;
  onChanged: () => void;
}

const PRIMARY_BTN =
  'bg-accent-500 hover:bg-accent-400 text-background-950 px-4 py-2 rounded-full text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap';
const SECONDARY_BTN =
  'bg-background-50 border border-background-300/60 text-foreground-300 hover:text-foreground-100 hover:border-accent-500/40 px-4 py-2 rounded-full text-xs font-medium transition-colors cursor-pointer whitespace-nowrap';

export default function UatTestCasesSection({ job, projectName, caseCount, onChanged }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [showManager, setShowManager] = useState(false);
  const [editingCase, setEditingCase] = useState<UatTestCase | null>(null);

  const handleAdd = () => {
    setEditingCase(null);
    setShowForm(true);
  };

  const handleEdit = (testCase: UatTestCase) => {
    setShowManager(false);
    setEditingCase(testCase);
    setShowForm(true);
  };

  const handleSaved = () => {
    setShowForm(false);
    setEditingCase(null);
    onChanged();
  };

  return (
    <div className="rounded-md bg-background-50 border border-background-200/60 p-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div>
          <p className="text-[10px] font-label text-foreground-400 uppercase tracking-wide">Test Cases</p>
          <p className="text-xs text-foreground-300 mt-0.5">{caseCount} test case{caseCount === 1 ? '' : 's'}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleAdd} className={`${PRIMARY_BTN} flex items-center gap-1.5`}>
            <i className="ri-add-line text-sm w-4 h-4 flex items-center justify-center"></i>
            Add Test Case
          </button>
          <button onClick={() => setShowManager(true)} className={SECONDARY_BTN}>
            Manage Test Cases
          </button>
        </div>
      </div>

      {caseCount === 0 && (
        <p className="text-xs text-foreground-500">No test cases have been created for this test run yet.</p>
      )}

      <UatTestCaseFormModal
        open={showForm}
        job={job}
        projectName={projectName}
        existingCase={editingCase}
        onClose={() => setShowForm(false)}
        onSaved={handleSaved}
      />

      <UatTestCaseManagerModal
        open={showManager}
        job={job}
        onClose={() => setShowManager(false)}
        onEdit={handleEdit}
        onChanged={onChanged}
      />
    </div>
  );
}
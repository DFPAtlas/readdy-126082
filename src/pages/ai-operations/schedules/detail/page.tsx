import { useParams, Link } from 'react-router-dom';
import { useSchedules } from '@/pages/ai-operations/schedules/SchedulesContext';
import ScheduleHeader from '@/pages/ai-operations/schedules/detail/components/ScheduleHeader';
import ScheduleOverview from '@/pages/ai-operations/schedules/detail/components/ScheduleOverview';
import TriggerConfig from '@/pages/ai-operations/schedules/detail/components/TriggerConfig';
import AssignedAgent from '@/pages/ai-operations/schedules/detail/components/AssignedAgent';
import TaskDefinition from '@/pages/ai-operations/schedules/detail/components/TaskDefinition';
import Governance from '@/pages/ai-operations/schedules/detail/components/Governance';
import RetryFailure from '@/pages/ai-operations/schedules/detail/components/RetryFailure';
import NotificationEscalation from '@/pages/ai-operations/schedules/detail/components/NotificationEscalation';
import RunHistory from '@/pages/ai-operations/schedules/detail/components/RunHistory';

export default function ScheduleDetailPage() {
  const { scheduleId } = useParams<{ scheduleId: string }>();
  const { getSchedule, loading } = useSchedules();

  const schedule = getSchedule(scheduleId ?? '');

  if (loading && !schedule) {
    return (
      <div className="bg-background-100 border border-background-200/60 rounded-lg p-12 text-center max-w-lg mx-auto mt-16">
        <i className="ri-loader-4-line text-2xl text-accent-400 w-8 h-8 flex items-center justify-center mx-auto animate-spin"></i>
        <p className="text-sm text-foreground-500 mt-3">Loading schedule…</p>
      </div>
    );
  }

  if (!schedule) {
    return (
      <div className="bg-background-100 border border-background-200/60 rounded-lg p-10 text-center max-w-lg mx-auto mt-16">
        <i className="ri-calendar-2-line text-4xl text-foreground-600 w-10 h-10 flex items-center justify-center mx-auto"></i>
        <h1 className="text-lg font-heading font-semibold text-foreground-50 mt-4">Schedule not found</h1>
        <p className="text-sm text-foreground-500 mt-2">The requested schedule does not exist in the registry.</p>
        <Link
          to="/ai-operations/schedules"
          className="inline-flex items-center gap-2 mt-6 text-sm font-label bg-accent-500 hover:bg-accent-400 text-background-950 rounded-md px-4 py-2 transition-colors duration-150 cursor-pointer whitespace-nowrap"
        >
          <i className="ri-arrow-left-line w-4 h-4 flex items-center justify-center"></i>
          Back to Scheduling &amp; Automation
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ScheduleHeader schedule={schedule} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ScheduleOverview schedule={schedule} />
        <TriggerConfig schedule={schedule} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <AssignedAgent schedule={schedule} />
        <TaskDefinition schedule={schedule} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Governance schedule={schedule} />
        <div className="space-y-5">
          <RetryFailure schedule={schedule} />
          <NotificationEscalation schedule={schedule} />
        </div>
      </div>

      <RunHistory schedule={schedule} />
    </div>
  );
}
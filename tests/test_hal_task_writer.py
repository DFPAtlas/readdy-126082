import concurrent.futures
import datetime as dt
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

SCRIPT = Path(__file__).resolve().parents[1] / 'runtime-bridge/tools/record-task-event.py'


class WriterTests(unittest.TestCase):
    def test_retention_clock_is_sampled_after_lock_acquisition(self):
        spec = importlib.util.spec_from_file_location('task_writer', SCRIPT)
        writer = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(writer)
        real_datetime = dt.datetime
        now = real_datetime.now(dt.timezone.utc)
        with tempfile.TemporaryDirectory() as folder:
            target = Path(folder) / 'events.json'
            existing = dict(eventId='other-writer', instance='hall-n8n', workflowId='wf1', executionId='1',
                            taskId='task', phase='checking', occurredAt=(now - dt.timedelta(seconds=1)).isoformat())
            target.write_text(json.dumps(dict(version=1, events=[existing])))
            arguments = [str(SCRIPT), '--file', str(target), '--instance', 'hall-n8n', '--workflow-id', 'wf1',
                         '--execution-id', '1', '--task-id', 'task', '--event-id', 'this-writer', '--phase', 'ranking']
            with patch.object(writer.dt, 'datetime', wraps=real_datetime) as clock, patch.object(sys, 'argv', arguments):
                clock.now.side_effect = [now - dt.timedelta(seconds=2), now]
                writer.main()
            self.assertEqual([item['eventId'] for item in json.loads(target.read_text())['events']], ['other-writer', 'this-writer'])

    def test_atomic_concurrent_events_retry_conflicts_and_permissions(self):
        with tempfile.TemporaryDirectory() as folder:
            target = Path(folder) / 'events.json'
            base = [sys.executable, str(SCRIPT), '--file', str(target), '--instance', 'hall-n8n',
                    '--workflow-id', 'wf1', '--execution-id', '1', '--task-id', 'opaque-task']

            def record(i):
                return subprocess.run(base + ['--phase', 'checking', '--event-id', f'event-{i}'], capture_output=True)

            with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
                results = list(pool.map(record, range(20)))
            self.assertTrue(all(item.returncode == 0 for item in results))
            original = json.loads(target.read_text())
            self.assertEqual(len(original['events']), 20)
            self.assertEqual(target.stat().st_mode & 0o777, 0o640)
            self.assertEqual(record(0).returncode, 0)
            self.assertEqual(json.loads(target.read_text()), original)
            conflict = subprocess.run(base + ['--phase', 'ranking', '--event-id', 'event-0'], capture_output=True)
            self.assertNotEqual(conflict.returncode, 0)
            self.assertEqual(json.loads(target.read_text()), original)
            invalid = subprocess.run(base + ['--phase', 'handoff_requested'], capture_output=True)
            self.assertNotEqual(invalid.returncode, 0)
            self.assertEqual(json.loads(target.read_text()), original)
            for i in range(20, 105):
                self.assertEqual(record(i).returncode, 0)
            self.assertEqual(len(json.loads(target.read_text())['events']), 100)
            self.assertLessEqual(target.stat().st_size, 65536)


if __name__ == '__main__':
    unittest.main()

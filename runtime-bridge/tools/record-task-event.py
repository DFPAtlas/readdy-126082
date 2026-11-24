#!/usr/bin/env python3
"""Local producer helper. Atomic bounded snapshot; no network or business actions."""
import argparse
import datetime as dt
import fcntl
import json
import os
from pathlib import Path
import re
import tempfile
import uuid

PHASES = ('checking', 'discovering', 'ranking', 'drafting', 'notifying', 'repairing',
          'waiting', 'completed', 'failed', 'handoff_requested', 'handoff_received')
INSTANCES = ('hall-n8n', 'leadgen_n8n')


def identifier(value):
    if not re.fullmatch(r'[A-Za-z0-9_-]{1,100}', value):
        raise argparse.ArgumentTypeError('Use an opaque ID of 1–100 letters, digits, _ or -')
    return value


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--file', required=True, type=Path)
    parser.add_argument('--instance', required=True, choices=INSTANCES)
    parser.add_argument('--workflow-id', required=True, type=identifier)
    parser.add_argument('--execution-id', required=True, type=identifier)
    parser.add_argument('--task-id', required=True, type=identifier)
    parser.add_argument('--event-id', type=identifier, default=str(uuid.uuid4()))
    parser.add_argument('--phase', required=True, choices=PHASES)
    parser.add_argument('--target-instance', choices=INSTANCES)
    parser.add_argument('--target-workflow-id', type=identifier)
    args = parser.parse_args()
    handoff = args.phase.startswith('handoff_')
    if handoff != bool(args.target_instance and args.target_workflow_id) or (not handoff and (args.target_instance or args.target_workflow_id)):
        parser.error('Handover events require both peer fields; other events accept neither')
    now = dt.datetime.now(dt.timezone.utc)
    event = dict(eventId=args.event_id, instance=args.instance, workflowId=args.workflow_id,
                 executionId=args.execution_id, taskId=args.task_id, phase=args.phase,
                 occurredAt=now.isoformat())
    if handoff:
        event.update(targetInstance=args.target_instance, targetWorkflowId=args.target_workflow_id)
    # Parent directory must be provisioned by the operator, not workflow input.
    lock_path = args.file.with_name(args.file.name + '.lock')
    with open(lock_path, 'a', encoding='utf-8') as lock:
        os.chmod(lock_path, 0o600)
        fcntl.flock(lock, fcntl.LOCK_EX)
        # Sample time after acquiring the lock: another writer may have emitted
        # an event while this process waited. A pre-lock clock would drop it.
        now = dt.datetime.now(dt.timezone.utc)
        event['occurredAt'] = now.isoformat()
        events = []
        if args.file.exists():
            with open(args.file, 'rb') as source:
                raw = source.read(65_537)
            if len(raw) > 65_536:
                raise ValueError('Existing snapshot exceeds 64 KiB')
            previous = json.loads(raw)
            if previous.get('version') != 1 or not isinstance(previous.get('events'), list):
                raise ValueError('Invalid existing snapshot')
            for item in previous['events']:
                stamp = dt.datetime.fromisoformat(item['occurredAt'].replace('Z', '+00:00'))
                if 0 <= (now - stamp).total_seconds() <= 86_400:
                    events.append(item)
        for item in events:
            if item['instance'] == args.instance and item['eventId'] == args.event_id:
                if {k: v for k, v in item.items() if k != 'occurredAt'} != {k: v for k, v in event.items() if k != 'occurredAt'}:
                    raise ValueError('Event ID reused with different metadata')
                # Retrying the same event never advances its original timestamp.
                return
        events = (events + [event])[-100:]
        payload = json.dumps(dict(version=1, events=events), separators=(',', ':')).encode()
        while len(payload) > 65_536:
            events.pop(0)
            payload = json.dumps(dict(version=1, events=events), separators=(',', ':')).encode()
        temporary = None
        try:
            with tempfile.NamedTemporaryFile(dir=args.file.parent, delete=False) as target:
                temporary = target.name
                os.chmod(temporary, 0o640)
                target.write(payload)
                target.flush()
                os.fsync(target.fileno())
            os.replace(temporary, args.file)
            temporary = None
        finally:
            if temporary:
                os.unlink(temporary)


if __name__ == '__main__':
    main()

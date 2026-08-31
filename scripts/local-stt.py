#!/usr/bin/env python3
"""Persistent local Whisper worker. Reads an audio path per stdin line, writes one transcript line."""
import sys

from faster_whisper import WhisperModel

model_name = sys.argv[1] if len(sys.argv) > 1 else 'base'
model = WhisperModel(model_name, device='cpu', compute_type='int8')
sys.stderr.write('READY\n')
sys.stderr.flush()
for line in sys.stdin:
    path = line.strip()
    if not path:
        continue
    try:
        segments, _info = model.transcribe(path, language='zh', vad_filter=True, beam_size=1)
        text = ''.join(segment.text for segment in segments).strip()
        sys.stdout.write(text + '\n')
    except Exception as exc:
        sys.stdout.write('ERROR:' + str(exc).replace('\n', ' ') + '\n')
    sys.stdout.flush()

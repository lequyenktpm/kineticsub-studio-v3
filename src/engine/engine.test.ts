import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cuesToBlockTranscript,
  cuesToSrt,
  interpolateWordTimings,
  parseTranscriptAuto,
} from './transcriptParser';
import { buildSceneGenerationPrompt } from './aiPromptBuilder';
import { choreographFromTranscript } from './autoChoreographer';
import { computeElementFrameState } from './animationMath';
import { generatePythonProjectFiles } from './pythonGenerator';
import {
  PRESET_3D_SHAPES_KARAOKE,
  PRESET_ED_PRONUNCIATION,
  PRESET_JP_EN_POLITE,
  PRESET_WATER_POLITE,
  PRESET_XUN52000_DARK,
  SAMPLE_JP_EN_SCENE_JSON,
  SAMPLE_JP_EN_TRANSCRIPT,
  SAMPLE_SCENE_PLAN,
  SAMPLE_WORDS_JSON,
  SAMPLE_XUN52000_SCENE_JSON,
  SAMPLE_XUN52000_TRANSCRIPT,
} from './demoPresets';
import {
  parseScenePlanJson,
  parseWordLevelJson,
  projectToWordsAndScenePlan,
  scenePlanToProject,
  summarizeScenePlan,
} from './scenePlanAdapter';
import { buildZipArchive } from '../utils/zipBuilder';
import { buildFfmpegArgs } from './ffmpegArgs';
import { resolveMp4EncodingParams } from './mp4Config';
import {
  applyCompositionToProject,
  LAYOUT_COMPOSITIONS,
  matchIllustrationForCue,
  pickCompositionFromContext,
  pickRandomComposition,
  recomposeProjectWithStyle,
} from './illustrationLayouts';
import {
  findVisualOverlaps,
  resolveProjectOverlaps,
  STAGE_SAFE_BOTTOM,
  estimateElementBounds,
} from './layoutSolver';
import { SceneElement } from './types';

test('interpolateWordTimings distributes word timestamps across cue duration', () => {
  const words = interpolateWordTimings('Give me water please', 1.0, 3.0);
  assert.equal(words.length, 4);
  assert.equal(words[0].start, 1.0);
  assert.equal(words[words.length - 1].end, 3.0);
  for (let i = 1; i < words.length; i++) {
    assert.ok(words[i].start >= words[i - 1].start);
    assert.ok(words[i].end >= words[i].start);
  }
});

test('parseTranscriptAuto parses SRT, Whisper JSON, and timestamped lines', () => {
  const srt = `1
00:00:00,500 --> 00:00:02,500
"Give me coffee." sounds rude!

2
00:00:02,600 --> 00:00:05,000
Try "Could I have a coffee?" instead.`;

  const srtCues = parseTranscriptAuto(srt);
  assert.equal(srtCues.length, 2);
  assert.equal(srtCues[0].start, 0.5);
  assert.equal(srtCues[1].end, 5.0);
  assert.ok(srtCues[0].words.length >= 4);

  const jsonCues = parseTranscriptAuto(
    JSON.stringify({
      segments: [
        { start: 0.1, end: 1.5, text: 'Hello world' },
        { start: 1.6, end: 3.2, text: 'Speak politely' },
      ],
    }),
  );
  assert.equal(jsonCues.length, 2);
  assert.equal(jsonCues[1].text, 'Speak politely');

  const roundTripSrt = cuesToSrt(jsonCues);
  assert.ok(roundTripSrt.includes('-->'));
});

test('choreographFromTranscript generates arranged elements with show/hide lifespans', () => {
  const cues = parseTranscriptAuto(`[0:00 - 0:02.5] "Give me water" is rude.
[0:02.6 - 0:05.2] Try "Could I have some water?" instead.`);
  const project = choreographFromTranscript(cues, { title: 'Polite Water' });

  assert.equal(project.title, 'Polite Water');
  assert.ok(project.duration >= 5.2);
  assert.ok(project.elements.some((e) => e.type === 'comparison-strip'));
  assert.ok(project.elements.some((e) => e.type === 'sentence-card'));
  assert.ok(project.elements.some((e) => e.type === 'karaoke-card'));
  assert.ok(project.elements.some((e) => e.type === 'tone-meter'));
});

test('computeElementFrameState handles appear/visible/disappear states accurately', () => {
  const el = PRESET_WATER_POLITE.elements.find((e) => e.id === 'el-card-rude')!;
  const before = computeElementFrameState(el, el.startTime - 0.1);
  assert.equal(before.visible, false);

  const entering = computeElementFrameState(el, el.startTime + 0.05);
  assert.equal(entering.visible, true);
  assert.ok(entering.opacity > 0 && entering.opacity < 1);

  const steady = computeElementFrameState(el, (el.startTime + el.endTime) / 2);
  assert.equal(steady.visible, true);
  assert.equal(steady.opacity, 1);

  const after = computeElementFrameState(el, el.endTime + 0.1);
  assert.equal(after.visible, false);
});

test('scenePlanAdapter parses words.json + scene.json and converts 3D shapes accurately', () => {
  const words = parseWordLevelJson(JSON.stringify(SAMPLE_WORDS_JSON));
  const plan = parseScenePlanJson(JSON.stringify(SAMPLE_SCENE_PLAN));
  assert.equal(words.length, 13);
  assert.ok(plan !== null && plan.scenes.length === 2);

  const converted = scenePlanToProject(words, plan!, { title: '3D Test' });
  const shapes = converted.elements.filter((e) => e.type === 'shape-3d');
  const karaokes = converted.elements.filter((e) => e.type === 'karaoke-card');
  assert.equal(shapes.length, 4);
  assert.ok(karaokes.length >= 2);
  assert.equal(shapes[0].startTime, words[0].start);

  const exported = projectToWordsAndScenePlan(PRESET_3D_SHAPES_KARAOKE);
  assert.equal(exported.wordsJson.words.length, 13);
  assert.ok(exported.scenePlan.scenes[0].shapes!.length >= 3);
});

test('generatePythonProjectFiles outputs complete modular video_maker package and valid ZIP', () => {
  const files = generatePythonProjectFiles(PRESET_3D_SHAPES_KARAOKE);
  const expectedFiles = [
    'main.py',
    'loader.py',
    'renderer_shapes.py',
    'renderer_text.py',
    'renderer_subtitles.py',
    'timeline.py',
    'video_builder.py',
    'sample_words.json',
    'sample_scene.json',
    'requirements.txt',
    'README.md',
  ] as const;

  for (const name of expectedFiles) {
    assert.ok(files[name].length > 20, `Expected non-empty file ${name}`);
  }

  assert.ok(files['renderer_shapes.py'].includes('GaussianBlur'));
  assert.ok(files['renderer_shapes.py'].includes('staircase_3d'));
  assert.ok(files['renderer_subtitles.py'].includes('#FACC15'));
  assert.ok(files['video_builder.py'].includes('VideoClip'));
  assert.ok(files['requirements.txt'].includes('moviepy'));

  const parsedWords = JSON.parse(files['sample_words.json']);
  const parsedScene = JSON.parse(files['sample_scene.json']);
  assert.ok(Array.isArray(parsedWords.words) && parsedWords.words.length > 0);
  assert.ok(Array.isArray(parsedScene.scenes) && parsedScene.scenes.length > 0);

  const zipBytes = buildZipArchive(files);
  assert.equal(zipBytes[0], 0x50);
  assert.equal(zipBytes[1], 0x4b);
  assert.equal(zipBytes[2], 0x03);
  assert.equal(zipBytes[3], 0x04);
});

test('parseTranscriptAuto parses standalone 00:00:00.000 JP-EN blocks and chunks CJK for karaoke', () => {
  const cues = parseTranscriptAuto(SAMPLE_JP_EN_TRANSCRIPT);
  assert.equal(cues.length, 27);
  assert.equal(cues[0].start, 0);
  assert.equal(cues[1].start, 11.96);
  assert.equal(cues[2].start, 17.04);
  assert.equal(cues[cues.length - 1].start, 99.8);
  assert.equal(cues[cues.length - 1].text, 'Follow along.');
  assert.deepEqual(
    cues[cues.length - 1].words.map((w) => w.word),
    ['Follow', 'along.'],
  );

  // Japanese cue 1 must be split into readable chunks rather than one giant token
  assert.ok(cues[0].words.length >= 12);
  for (const w of cues[0].words) {
    assert.ok(w.word.length <= 5, `Chunk too long: ${w.word}`);
  }

  const blockRoundTrip = cuesToBlockTranscript(cues.slice(0, 2));
  assert.ok(blockRoundTrip.includes('00:00:00.000'));
  assert.ok(blockRoundTrip.includes('00:00:11.960'));
});

test('buildSceneGenerationPrompt embeds formatted cues and flexible element schema', () => {
  const cues = parseTranscriptAuto(SAMPLE_JP_EN_TRANSCRIPT);
  const prompt = buildSceneGenerationPrompt(cues, {
    title: 'Can / Could / May',
    style: 'tiktok-cards',
  });

  assert.ok(prompt.includes('[Cue 1 | 00:00:00.000 ->'));
  assert.ok(prompt.includes('[Cue 27 | 00:01:39.800 ->'));
  assert.ok(prompt.includes('comparison_strip'));
  assert.ok(prompt.includes('staircase_3d'));
  assert.ok(prompt.includes('sentence_card'));
  assert.ok(prompt.includes('Can you pass the salt?'));
});

test('scenePlanToProject supports AI flexible elements[] with cuesOverride and Python export', () => {
  const cues = parseTranscriptAuto(SAMPLE_JP_EN_TRANSCRIPT);
  const words = cues.flatMap((c) => c.words);
  const parsed = parseScenePlanJson(JSON.stringify(SAMPLE_JP_EN_SCENE_JSON));
  assert.ok(parsed !== null);

  const project = scenePlanToProject(words, parsed!, {
    title: 'JP-EN Polite Lesson',
    cuesOverride: cues,
  });

  assert.equal(project.cues.length, 27);
  assert.ok(project.elements.some((e) => e.type === 'comparison-strip'));
  assert.ok(project.elements.some((e) => e.type === 'topic-pill'));
  assert.ok(project.elements.some((e) => e.type === 'illustration-prop'));
  assert.ok(project.elements.some((e) => e.type === 'sentence-card'));
  assert.ok(project.elements.some((e) => e.type === 'tone-meter'));
  assert.ok(
    project.elements.some(
      (e) => e.type === 'shape-3d' && e.props.kind === 'shape-3d' && e.props.shapeType === 'staircase_3d',
    ),
  );
  assert.equal(project.elements.filter((e) => e.type === 'karaoke-card').length, 27);

  const pyFiles = generatePythonProjectFiles(PRESET_JP_EN_POLITE);
  assert.ok(pyFiles['loader.py'].includes('from typing import Any, Dict, List, Tuple'));
  assert.ok(pyFiles['loader.py'].includes('_tokenize_for_karaoke'));
  assert.ok(pyFiles['renderer_text.py'].includes('NotoSansCJK'));
  assert.ok(pyFiles['timeline.py'].includes('_resolve_time_value'));
});

test('parseScenePlanJson extracts JSON from ChatGPT/Gemini markdown fences and converts word_stack/subtext', () => {
  const aiResponse = `Dưới đây là JSON dựng video tự động của bạn:

\`\`\`json
{
  "title": "AI Office Tip",
  "theme": "mint-breeze",
  "scenes": [
    {
      "id": "sc1",
      "elements": [
        { "type": "illustration", "variant": "office-work", "start": "00:00:00.000", "end": "00:00:04.000", "y": 620 },
        {
          "type": "sentence_card",
          "start": "00:00:00.500",
          "end": "00:00:03.800",
          "y": 970,
          "text": "Could I take Friday off?",
          "subtext": "Lịch sự với sếp",
          "badge": "question",
        },
        {
          "type": "word_stack",
          "start": "00:00:04.000",
          "end": "00:00:07.500",
          "y": 720,
          "rows": [
            { "prefix": "Can ", "suffix": "I...", "suffixColor": "#2563EB", "appearAt": "00:00:04.200", "phonetic": "Casual" }
          ]
        }
      ]
    }
  ]
}
\`\`\`

Chúc bạn render thành công!`;

  const parsed = parseScenePlanJson(aiResponse);
  assert.ok(parsed !== null);
  const cues = parseTranscriptAuto('00:00:00.000\nCould I take Friday off?\n\n00:00:04.000\nAsk politely.');
  const summary = summarizeScenePlan(parsed!, cues);
  assert.equal(summary.elementCount, 3);
  assert.equal(summary.cueCount, 2);

  const project = scenePlanToProject(
    cues.flatMap((c) => c.words),
    parsed!,
    { cuesOverride: cues },
  );
  assert.equal(project.theme, 'mint-breeze');
  const card = project.elements.find((e) => e.type === 'sentence-card');
  assert.ok(card && card.props.kind === 'sentence-card');
  assert.equal(card.props.subtext, 'Lịch sự với sếp');
  assert.equal(card.props.badge, 'question');
  assert.ok(project.elements.some((e) => e.type === 'word-stack'));
});

test('buildFfmpegArgs configures MJPEG -> H.264/AAC MP4 with audio or silent fallback', () => {
  const withAudio = buildFfmpegArgs({
    fps: 30,
    framesPath: '/tmp/job/frames.mjpeg',
    outputPath: '/tmp/job/output.mp4',
    audioPath: '/tmp/job/audio.mp3',
  });
  assert.ok(withAudio.includes('-f'));
  assert.ok(withAudio.includes('mjpeg'));
  assert.ok(withAudio.includes('/tmp/job/audio.mp3'));
  assert.ok(!withAudio.includes('anullsrc=channel_layout=stereo:sample_rate=44100'));
  assert.ok(withAudio.includes('libx264'));
  assert.ok(withAudio.includes('yuv420p'));
  assert.ok(withAudio.includes('aac'));
  assert.ok(withAudio.includes('+faststart'));
  assert.equal(withAudio[withAudio.length - 1], '/tmp/job/output.mp4');

  const silentClamped = buildFfmpegArgs({
    fps: 120,
    framesPath: '/tmp/job/frames.mjpeg',
    outputPath: '/tmp/job/silent.mp4',
    audioPath: null,
    crf: 10,
  });
  const fpsIdx = silentClamped.indexOf('-framerate');
  assert.equal(silentClamped[fpsIdx + 1], '60');
  const crfIdx = silentClamped.indexOf('-crf');
  assert.equal(silentClamped[crfIdx + 1], '16');
  assert.ok(silentClamped.includes('anullsrc=channel_layout=stereo:sample_rate=44100'));

  const highCrf = buildFfmpegArgs({
    fps: 24,
    framesPath: '/tmp/job/frames.mjpeg',
    outputPath: '/tmp/job/light.mp4',
    audioPath: null,
    crf: 99,
  });
  assert.equal(highCrf[highCrf.indexOf('-crf') + 1], '32');
});

test('resolveMp4EncodingParams resolves dimensions, bitrate scaling, and CRF for presets', () => {
  const fhdHigh30 = resolveMp4EncodingParams({
    resolution: '1080p',
    quality: 'high',
    fps: 30,
  });
  assert.equal(fhdHigh30.width, 1080);
  assert.equal(fhdHigh30.height, 1920);
  assert.equal(fhdHigh30.fps, 30);
  assert.equal(fhdHigh30.videoBitrate, 6_000_000);
  assert.equal(fhdHigh30.audioBitrate, 192_000);
  assert.equal(fhdHigh30.crf, 22);

  const hdUltra24 = resolveMp4EncodingParams({
    resolution: '720p',
    quality: 'ultra',
    fps: 24,
  });
  assert.equal(hdUltra24.width, 720);
  assert.equal(hdUltra24.height, 1280);
  assert.equal(hdUltra24.fps, 24);
  assert.equal(hdUltra24.crf, 18);
  assert.ok(hdUltra24.videoBitrate > 3_500_000 && hdUltra24.videoBitrate < 5_000_000);

  const qhdUltra60 = resolveMp4EncodingParams({
    resolution: '1440p',
    quality: 'ultra',
    fps: 60,
  });
  assert.equal(qhdUltra60.width, 1440);
  assert.equal(qhdUltra60.height, 2560);
  assert.equal(qhdUltra60.fps, 60);
  assert.ok(qhdUltra60.videoBitrate > 25_000_000);

  const sdStandard24 = resolveMp4EncodingParams({
    resolution: '540p',
    quality: 'standard',
    fps: 24,
  });
  assert.equal(sdStandard24.width, 540);
  assert.equal(sdStandard24.height, 960);
  assert.equal(sdStandard24.crf, 27);
  assert.ok(sdStandard24.videoBitrate >= 650_000);
});

test('resolveProjectOverlaps eliminates vertical collisions and protects karaoke zone', () => {
  const crowded: SceneElement[] = [
    {
      id: 'strip',
      type: 'comparison-strip',
      label: 'Strip',
      startTime: 0,
      endTime: 5,
      enterAnimation: 'drop-in',
      exitAnimation: 'fade-out',
      layout: { x: 540, y: 185, width: 900, scale: 1, zIndex: 10 },
      props: {
        kind: 'comparison-strip',
        items: [
          { label: 'At', accentColor: '#2563EB' },
          { label: 'On', accentColor: '#16A34A' },
          { label: 'In', accentColor: '#7C3AED' },
        ],
      },
    },
    {
      id: 'pill',
      type: 'topic-pill',
      label: 'Pill',
      startTime: 0,
      endTime: 5,
      enterAnimation: 'pop-up',
      exitAnimation: 'fade-out',
      layout: { x: 540, y: 260, width: 340, scale: 1, zIndex: 12 }, // Deliberately overlaps strip!
      props: { kind: 'topic-pill', text: 'Prepositions', bgColor: '#DDD6FE', textColor: '#4338CA' },
    },
    {
      id: 'stack',
      type: 'word-stack',
      label: '4-row stack',
      startTime: 0,
      endTime: 5,
      enterAnimation: 'pop-up',
      exitAnimation: 'fade-out',
      layout: { x: 540, y: 520, width: 760, scale: 1, zIndex: 16 }, // Tall 4-row stack!
      props: {
        kind: 'word-stack',
        rows: [
          { prefix: 'At ', suffix: 'point', suffixColor: '#2563EB', appearAt: 0 },
          { prefix: 'On ', suffix: 'surface', suffixColor: '#16A34A', appearAt: 0.2 },
          { prefix: 'In ', suffix: 'space', suffixColor: '#7C3AED', appearAt: 0.4 },
          { prefix: 'By ', suffix: 'time', suffixColor: '#EA580C', appearAt: 0.6 },
        ],
      },
    },
    {
      id: 'card',
      type: 'sentence-card',
      label: 'Long card',
      startTime: 0,
      endTime: 5,
      enterAnimation: 'pop-up',
      exitAnimation: 'shrink',
      layout: { x: 540, y: 780, width: 830, scale: 1, zIndex: 20 }, // Collides with tall stack!
      props: {
        kind: 'sentence-card',
        text: 'Could I take Friday off, please? Let me double check.',
        badge: 'check',
      },
    },
    {
      id: 'meter',
      type: 'tone-meter',
      label: 'Meter',
      startTime: 0,
      endTime: 5,
      enterAnimation: 'slide-up',
      exitAnimation: 'fade-out',
      layout: { x: 540, y: 920, width: 700, scale: 1, zIndex: 18 }, // Collides with card!
      props: {
        kind: 'tone-meter',
        title: 'TONE',
        leftLabel: 'casual',
        rightLabel: 'polite',
        valueStart: 0.2,
        valueEnd: 0.9,
        animateStart: 0.5,
        animateEnd: 4,
      },
    },
  ];

  const resolved = resolveProjectOverlaps(crowded);
  const violations = findVisualOverlaps(resolved);
  assert.deepEqual(violations, []);

  for (const el of resolved) {
    const b = estimateElementBounds(el);
    assert.ok(b.bottom <= STAGE_SAFE_BOTTOM + 10, `${el.id} exceeded safe bottom: ${b.bottom}`);
  }
});

test('matchIllustrationForCue matches contextually accurate vector scenes', () => {
  assert.equal(matchIllustrationForCue('In a cafe, thirsty for water'), 'cafe-water');
  assert.equal(matchIllustrationForCue('Give me a coffee latte please'), 'coffee-cup');
  assert.equal(matchIllustrationForCue('Boss walks by on Friday at the office'), 'office-work');
  assert.equal(matchIllustrationForCue('Heard at a hotel reception desk'), 'hotel-desk');
  assert.equal(matchIllustrationForCue('8:20 means twenty past eight on the clock'), 'clock-face');
  assert.equal(matchIllustrationForCue('Tone and smile sound warm and polite'), 'gauge-arc');
  assert.equal(matchIllustrationForCue('Ear check listening quiz'), 'ear-listen');
  assert.equal(matchIllustrationForCue('Here is a quick tip to remember'), 'lightbulb-tip');
});

test('all @englishpracticing168 compositions and presets produce 0 overlap violations', () => {
  const presets = [
    PRESET_JP_EN_POLITE,
    PRESET_WATER_POLITE,
    PRESET_ED_PRONUNCIATION,
    PRESET_3D_SHAPES_KARAOKE,
  ];
  for (const preset of presets) {
    const resolved = resolveProjectOverlaps(preset.elements);
    assert.deepEqual(findVisualOverlaps(resolved), [], `Preset ${preset.id} had overlaps`);
  }

  for (const comp of LAYOUT_COMPOSITIONS) {
    const recomposed = recomposeProjectWithStyle(PRESET_JP_EN_POLITE, comp.id);
    assert.equal(recomposed.compositionId, comp.id);
    assert.equal(recomposed.cues.length, PRESET_JP_EN_POLITE.cues.length);
    assert.ok(
      recomposed.elements.some(
        (e) => e.props.kind === 'illustration-prop' && e.props.variant === comp.signatureVariant,
      ) || comp.id === 'story-scenes',
      `Expected signature variant for composition ${comp.id}`,
    );
    if (comp.id === 'dialogue-upgrade') {
      const firstDiag = recomposed.elements.find(
        (e) => e.props.kind === 'illustration-prop' && e.props.variant === 'dialogue-upgrade',
      );
      assert.ok(firstDiag && firstDiag.props.kind === 'illustration-prop');
      const prompts = (firstDiag.props.data?.upgrades || []).map((r) => r.prompt);
      assert.equal(new Set(prompts).size, prompts.length, 'Dialogue upgrade rows must not repeat prompts');
    }
    const violations = findVisualOverlaps(recomposed.elements);
    assert.deepEqual(violations, [], `Composition ${comp.id} produced overlaps`);
  }
});

test('pickRandomComposition rotates away from current composition and parses new AI diagram JSON', () => {
  for (const comp of LAYOUT_COMPOSITIONS) {
    const picked = pickRandomComposition(comp.id, comp.recommendedTheme, () => 0.42);
    assert.notEqual(picked.compositionId, comp.id);
  }

  const aiDiagramPlan = parseScenePlanJson(
    JSON.stringify({
      title: 'Time & Politeness',
      scenes: [
        {
          id: 'sc1',
          elements: [
            {
              type: 'clock_face',
              start: '00:00:00.000',
              end: '00:00:04.000',
              timeHour: 8,
              timeMinute: 20,
              formula: '8:20',
              subtitle: 'twenty past eight',
            },
            {
              type: 'gauge_arc',
              start: '00:00:00.000',
              end: '00:00:04.000',
              y: 635, // Deliberately placed at same Y as clock_face to verify collision solver!
              value: 0.85,
              subtitle: 'Polite',
            },
          ],
        },
      ],
    }),
  );
  assert.ok(aiDiagramPlan !== null);
  const cues = parseTranscriptAuto('00:00:00.000\nIt is twenty past eight.');
  const proj = scenePlanToProject(
    cues.flatMap((c) => c.words),
    aiDiagramPlan!,
    { cuesOverride: cues },
  );
  assert.equal(findVisualOverlaps(proj.elements).length, 0);
  assert.ok(
    proj.elements.some((e) => e.props.kind === 'illustration-prop' && e.props.variant === 'clock-face'),
  );
  assert.ok(
    proj.elements.some((e) => e.props.kind === 'illustration-prop' && e.props.variant === 'gauge-arc'),
  );
});

test('buildSceneGenerationPrompt supports @xun52000 Word Reveal Dark template and ai-decide composition', () => {
  const cues = parseTranscriptAuto(SAMPLE_XUN52000_TRANSCRIPT);

  // 1. Xun52000 Word Reveal style
  const xunPrompt = buildSceneGenerationPrompt(cues, {
    title: 'Stop Saying Very',
    style: 'word-reveal-dark',
  });
  assert.ok(xunPrompt.includes('WORD-REVEAL TỐI (@xun52000'));
  assert.ok(xunPrompt.includes('"theme": "studio-slate"'));
  assert.ok(xunPrompt.includes('sentence_card'));

  // 2. AI decides composition mode
  const aiDecidePrompt = buildSceneGenerationPrompt(cues, {
    title: 'Can / Could / May',
    style: 'tiktok-cards',
    compositionId: 'ai-decide',
  });
  assert.ok(aiDecidePrompt.includes('CHẾ ĐỘ AI TỰ CHỌN PHỐI TỐI ƯU'));
  assert.ok(aiDecidePrompt.includes('compositionId'));
  assert.ok(aiDecidePrompt.includes('compositionReason'));
  assert.ok(aiDecidePrompt.includes('phrase-icon-split'));
  assert.ok(aiDecidePrompt.includes('KHÔNG invent type'));

  // 3. Preset Xun52000 project validation
  assert.equal(PRESET_XUN52000_DARK.theme, 'studio-slate');
  assert.equal(findVisualOverlaps(PRESET_XUN52000_DARK.elements).length, 0);
  assert.ok(PRESET_XUN52000_DARK.elements.length > 0);
  assert.ok(PRESET_XUN52000_DARK.elements.some((e) => e.type === 'sentence-card'));
});

test('Look/See/Watch context picks phrase-icon-split and still applies after JSON exists', () => {
  const transcript = 'Look, see, and watch. I see TV every night is wrong. Watch the TV instead.';
  assert.equal(pickCompositionFromContext(transcript), 'phrase-icon-split');
  const recomposed = recomposeProjectWithStyle(PRESET_JP_EN_POLITE, 'phrase-icon-split');
  assert.ok(
    recomposed.elements.some(
      (e) => e.props.kind === 'illustration-prop' && e.props.variant === 'phrase-icon-split',
    ),
  );
  const forced = applyCompositionToProject(PRESET_JP_EN_POLITE, 'phrase-icon-split');
  assert.equal(forced.compositionId, 'phrase-icon-split');
  assert.equal(findVisualOverlaps(recomposed.elements).length, 0);
});





import React from 'react';
import { Layers, Plus, Trash2 } from 'lucide-react';
import {
  EnterAnimation,
  ExitAnimation,
  LessonProject,
  SceneElement,
  Shape3DType,
} from '../engine/types';

interface TimelineAndInspectorProps {
  project: LessonProject;
  currentTime: number;
  selectedElementId: string | null;
  onSelectElement: (id: string) => void;
  onUpdateElement: (id: string, patch: Partial<SceneElement>) => void;
  onDeleteElement: (id: string) => void;
  onAddElement: (type: 'sentence-card' | 'topic-pill' | 'shape-3d') => void;
  onSeek: (time: number) => void;
}

const TYPE_LABELS: Record<SceneElement['type'], string> = {
  'comparison-strip': 'Thanh so sánh',
  'topic-pill': 'Nhãn ngữ cảnh',
  'illustration-prop': 'Minh họa',
  'sentence-card': 'Thẻ câu nổi',
  'tone-meter': 'Thanh sắc thái',
  'word-stack': 'Thẻ xếp chữ',
  'shape-3d': 'Khối 3D',
  'karaoke-card': 'Sub từng từ',
};

const TYPE_COLORS: Record<SceneElement['type'], string> = {
  'comparison-strip': 'bg-violet-100 border-violet-300 text-violet-900',
  'topic-pill': 'bg-emerald-100 border-emerald-300 text-emerald-900',
  'illustration-prop': 'bg-amber-100 border-amber-300 text-amber-900',
  'sentence-card': 'bg-indigo-100 border-indigo-300 text-indigo-900',
  'tone-meter': 'bg-rose-100 border-rose-300 text-rose-900',
  'word-stack': 'bg-sky-100 border-sky-300 text-sky-900',
  'shape-3d': 'bg-teal-100 border-teal-300 text-teal-900',
  'karaoke-card': 'bg-slate-200 border-slate-300 text-slate-900',
};

export const TimelineAndInspector: React.FC<TimelineAndInspectorProps> = ({
  project,
  currentTime,
  selectedElementId,
  onSelectElement,
  onUpdateElement,
  onDeleteElement,
  onAddElement,
  onSeek,
}) => {
  const selected = project.elements.find((e) => e.id === selectedElementId) ?? null;

  return (
    <aside className="flex flex-col bg-white border border-slate-200 rounded-xl overflow-hidden h-full">
      {/* Inspector Section */}
      <div className="p-4 border-b border-slate-200">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h2 className="text-sm font-semibold text-slate-900">Chỉnh thẻ &amp; Ẩn/Hiện</h2>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onAddElement('shape-3d')}
              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-teal-700 bg-teal-50 border border-teal-200 rounded-md hover:bg-teal-100 transition-colors whitespace-nowrap"
            >
              <Plus className="w-3 h-3" />
              <span>Khối 3D</span>
            </button>
            <button
              type="button"
              onClick={() => onAddElement('sentence-card')}
              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-md hover:bg-indigo-100 transition-colors whitespace-nowrap"
            >
              <Plus className="w-3 h-3" />
              <span>Thẻ câu</span>
            </button>
            <button
              type="button"
              onClick={() => onAddElement('topic-pill')}
              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-md hover:bg-slate-100 transition-colors whitespace-nowrap"
            >
              <Plus className="w-3 h-3" />
              <span>Nhãn</span>
            </button>
          </div>
        </div>

        {selected ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-slate-700 truncate">
                {TYPE_LABELS[selected.type]} · {selected.label}
              </span>
              <button
                type="button"
                onClick={() => onDeleteElement(selected.id)}
                aria-label={`Xóa ${selected.label}`}
                className="p-1.5 text-slate-400 hover:text-red-600 rounded-md hover:bg-red-50 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Appear / Disappear Lifespan */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label
                  htmlFor="el-start-time"
                  className="block text-[11px] font-medium text-slate-500 mb-1"
                >
                  Hiện lúc (giây)
                </label>
                <input
                  id="el-start-time"
                  type="number"
                  step={0.1}
                  min={0}
                  max={project.duration}
                  value={selected.startTime}
                  onChange={(e) =>
                    onUpdateElement(selected.id, {
                      startTime: Math.max(0, Number(e.target.value)),
                    })
                  }
                  className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label
                  htmlFor="el-end-time"
                  className="block text-[11px] font-medium text-slate-500 mb-1"
                >
                  Ẩn lúc (giây)
                </label>
                <input
                  id="el-end-time"
                  type="number"
                  step={0.1}
                  min={0.2}
                  max={project.duration + 10}
                  value={selected.endTime}
                  onChange={(e) =>
                    onUpdateElement(selected.id, {
                      endTime: Math.max(selected.startTime + 0.2, Number(e.target.value)),
                    })
                  }
                  className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums border border-slate-200 rounded-lg"
                />
              </div>
            </div>

            {/* Enter / Exit Animations */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label
                  htmlFor="el-enter-anim"
                  className="block text-[11px] font-medium text-slate-500 mb-1"
                >
                  Hiệu ứng hiện
                </label>
                <select
                  id="el-enter-anim"
                  value={selected.enterAnimation}
                  onChange={(e) =>
                    onUpdateElement(selected.id, {
                      enterAnimation: e.target.value as EnterAnimation,
                    })
                  }
                  className="w-full px-2 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                >
                  <option value="pop-up">Bật nảy (Pop-up)</option>
                  <option value="slide-up">Trượt lên (Slide-up)</option>
                  <option value="drop-in">Thả xuống (Drop-in)</option>
                  <option value="fade-scale">Phóng nhẹ (Fade-scale)</option>
                </select>
              </div>
              <div>
                <label
                  htmlFor="el-exit-anim"
                  className="block text-[11px] font-medium text-slate-500 mb-1"
                >
                  Hiệu ứng ẩn
                </label>
                <select
                  id="el-exit-anim"
                  value={selected.exitAnimation}
                  onChange={(e) =>
                    onUpdateElement(selected.id, {
                      exitAnimation: e.target.value as ExitAnimation,
                    })
                  }
                  className="w-full px-2 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                >
                  <option value="fade-out">Mờ dần (Fade-out)</option>
                  <option value="shrink">Thu nhỏ (Shrink)</option>
                  <option value="slide-down">Trượt xuống (Slide-down)</option>
                </select>
              </div>
            </div>

            {/* Position X, Y */}
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label
                  htmlFor="el-pos-x"
                  className="block text-[11px] font-medium text-slate-500 mb-1"
                >
                  Tọa độ X
                </label>
                <input
                  id="el-pos-x"
                  type="number"
                  step={10}
                  value={selected.layout.x}
                  onChange={(e) =>
                    onUpdateElement(selected.id, {
                      layout: { ...selected.layout, x: Number(e.target.value) },
                    })
                  }
                  className="w-full px-2 py-1.5 text-xs font-mono tabular-nums border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label
                  htmlFor="el-pos-y"
                  className="block text-[11px] font-medium text-slate-500 mb-1"
                >
                  Tọa độ Y
                </label>
                <input
                  id="el-pos-y"
                  type="number"
                  step={10}
                  value={selected.layout.y}
                  onChange={(e) =>
                    onUpdateElement(selected.id, {
                      layout: { ...selected.layout, y: Number(e.target.value) },
                    })
                  }
                  className="w-full px-2 py-1.5 text-xs font-mono tabular-nums border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label
                  htmlFor="el-width"
                  className="block text-[11px] font-medium text-slate-500 mb-1"
                >
                  Chiều rộng
                </label>
                <input
                  id="el-width"
                  type="number"
                  step={20}
                  value={selected.layout.width}
                  onChange={(e) =>
                    onUpdateElement(selected.id, {
                      layout: { ...selected.layout, width: Number(e.target.value) },
                    })
                  }
                  className="w-full px-2 py-1.5 text-xs font-mono tabular-nums border border-slate-200 rounded-lg"
                />
              </div>
            </div>

            {/* Type-specific quick editors */}
            {selected.props.kind === 'shape-3d' && (
              <div className="space-y-2 pt-1 border-t border-slate-100">
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label
                      htmlFor="el-shape-type"
                      className="block text-[11px] font-medium text-slate-500 mb-1"
                    >
                      Loại khối 3D
                    </label>
                    <select
                      id="el-shape-type"
                      value={selected.props.shapeType}
                      onChange={(e) =>
                        onUpdateElement(selected.id, {
                          props: {
                            ...selected.props,
                            shapeType: e.target.value as Shape3DType,
                          } as SceneElement['props'],
                        })
                      }
                      className="w-full px-2 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                    >
                      <option value="card_3d">card_3d</option>
                      <option value="pill_3d">pill_3d</option>
                      <option value="cube_3d">cube_3d</option>
                      <option value="rect_3d">rect_3d</option>
                      <option value="staircase_3d">staircase_3d</option>
                    </select>
                  </div>
                  <div>
                    <label
                      htmlFor="el-shape-fill"
                      className="block text-[11px] font-medium text-slate-500 mb-1"
                    >
                      Màu nền
                    </label>
                    <input
                      id="el-shape-fill"
                      type="color"
                      value={selected.props.fill}
                      onChange={(e) =>
                        onUpdateElement(selected.id, {
                          props: {
                            ...selected.props,
                            fill: e.target.value,
                          } as SceneElement['props'],
                        })
                      }
                      className="w-full h-8 p-0.5 bg-white border border-slate-200 rounded-lg cursor-pointer"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="el-shape-depth"
                      className="block text-[11px] font-medium text-slate-500 mb-1"
                    >
                      Độ dày 3D
                    </label>
                    <input
                      id="el-shape-depth"
                      type="number"
                      min={0}
                      max={32}
                      value={selected.props.depth}
                      onChange={(e) =>
                        onUpdateElement(selected.id, {
                          props: {
                            ...selected.props,
                            depth: Number(e.target.value),
                          } as SceneElement['props'],
                        })
                      }
                      className="w-full px-2 py-1.5 text-xs font-mono tabular-nums border border-slate-200 rounded-lg"
                    />
                  </div>
                </div>
                <div>
                  <label
                    htmlFor="el-shape-text"
                    className="block text-[11px] font-medium text-slate-500 mb-1"
                  >
                    Chữ trong khối
                  </label>
                  <input
                    id="el-shape-text"
                    type="text"
                    value={selected.props.textContent || ''}
                    placeholder="VD: Hello everyone!"
                    onChange={(e) =>
                      onUpdateElement(selected.id, {
                        props: {
                          ...selected.props,
                          textContent: e.target.value,
                        } as SceneElement['props'],
                      })
                    }
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg"
                  />
                </div>
              </div>
            )}

            {selected.props.kind === 'sentence-card' && (
              <div className="space-y-2 pt-1 border-t border-slate-100">
                <div>
                  <label
                    htmlFor="el-card-text"
                    className="block text-[11px] font-medium text-slate-500 mb-1"
                  >
                    Nội dung thẻ câu
                  </label>
                  <input
                    id="el-card-text"
                    type="text"
                    value={selected.props.text}
                    onChange={(e) =>
                      onUpdateElement(selected.id, {
                        label: `Thẻ câu: ${e.target.value.slice(0, 24)}`,
                        props: { ...selected.props, text: e.target.value } as SceneElement['props'],
                      })
                    }
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label
                      htmlFor="el-card-badge"
                      className="block text-[11px] font-medium text-slate-500 mb-1"
                    >
                      Biểu tượng
                    </label>
                    <select
                      id="el-card-badge"
                      value={selected.props.badge || 'none'}
                      onChange={(e) =>
                        onUpdateElement(selected.id, {
                          props: {
                            ...selected.props,
                            badge: e.target.value as 'check' | 'cross' | 'none',
                          } as SceneElement['props'],
                        })
                      }
                      className="w-full px-2 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                    >
                      <option value="check">Dấu tích xanh (Đúng)</option>
                      <option value="cross">Dấu X đỏ (Tránh)</option>
                      <option value="none">Không có</option>
                    </select>
                  </div>
                  <div>
                    <label
                      htmlFor="el-card-emphasis"
                      className="block text-[11px] font-medium text-slate-500 mb-1"
                    >
                      Từ nhấn mạnh
                    </label>
                    <input
                      id="el-card-emphasis"
                      type="text"
                      value={selected.props.emphasisWord || ''}
                      placeholder="VD: Could I"
                      onChange={(e) =>
                        onUpdateElement(selected.id, {
                          props: {
                            ...selected.props,
                            emphasisWord: e.target.value,
                          } as SceneElement['props'],
                        })
                      }
                      className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg"
                    />
                  </div>
                </div>
              </div>
            )}

            {selected.props.kind === 'topic-pill' && (
              <div className="pt-1 border-t border-slate-100">
                <label
                  htmlFor="el-pill-text"
                  className="block text-[11px] font-medium text-slate-500 mb-1"
                >
                  Chữ trên nhãn
                </label>
                <input
                  id="el-pill-text"
                  type="text"
                  value={selected.props.text}
                  onChange={(e) =>
                    onUpdateElement(selected.id, {
                      label: `Nhãn: ${e.target.value}`,
                      props: { ...selected.props, text: e.target.value } as SceneElement['props'],
                    })
                  }
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg"
                />
              </div>
            )}
          </div>
        ) : (
          <div className="py-5 px-3 text-center bg-slate-50 border border-dashed border-slate-200 rounded-lg">
            <Layers className="w-5 h-5 text-slate-400 mx-auto mb-1.5" />
            <p className="text-xs text-slate-600">
              Chọn một lớp trên Timeline bên dưới hoặc chạm vào thẻ trên khung 9:16 để chỉnh vị
              trí &amp; thời gian ẩn/hiện.
            </p>
          </div>
        )}
      </div>

      {/* Visual Timeline Bars */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-900 mb-2.5">
          <span>Timeline Sắp Xếp &amp; Ẩn/Hiện ({project.elements.length} lớp)</span>
          <span className="text-[11px] font-mono text-slate-500 tabular-nums">
            {currentTime.toFixed(2)}s
          </span>
        </div>

        <div className="space-y-1.5 relative">
          {project.elements.map((el) => {
            const leftPct = Math.max(0, Math.min(100, (el.startTime / project.duration) * 100));
            const widthPct = Math.max(
              4,
              Math.min(100 - leftPct, ((el.endTime - el.startTime) / project.duration) * 100),
            );
            const isSelected = el.id === selectedElementId;
            const isCurrentlyVisible =
              currentTime >= el.startTime && currentTime <= el.endTime;

            return (
              <button
                key={el.id}
                type="button"
                onClick={() => {
                  onSelectElement(el.id);
                  if (currentTime < el.startTime || currentTime > el.endTime) {
                    onSeek(Math.min(project.duration, el.startTime + 0.35));
                  }
                }}
                className={`w-full text-left p-2 rounded-lg border transition-colors ${
                  isSelected
                    ? 'bg-indigo-50/70 border-indigo-400'
                    : 'bg-slate-50/60 border-slate-200 hover:bg-slate-100/70'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-[11px] font-medium text-slate-800 truncate">
                    {el.label}
                  </span>
                  <span className="text-[10px] font-mono text-slate-500 tabular-nums shrink-0">
                    {el.startTime.toFixed(1)}s–{el.endTime.toFixed(1)}s
                  </span>
                </div>
                <div className="relative h-2.5 bg-slate-200/80 rounded-full overflow-hidden">
                  <div
                    className={`absolute top-0 bottom-0 rounded-full border ${
                      TYPE_COLORS[el.type]
                    } ${isCurrentlyVisible ? 'opacity-100' : 'opacity-65'}`}
                    style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                  />
                  {/* Playhead marker */}
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-slate-900"
                    style={{
                      left: `${Math.min(100, (currentTime / project.duration) * 100)}%`,
                    }}
                  />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
};

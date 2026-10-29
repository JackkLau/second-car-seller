import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import {
  ArrowRight,
  ChevronDown,
  RotateCcw,
  SlidersHorizontal,
} from "lucide-react";
import type { DrivingNeeds } from "../types";
import { defaultNeeds, summarizeNeeds } from "../lib/recommendations";

interface NeedsProfileProps {
  needs: DrivingNeeds | null;
  onApply: (needs: DrivingNeeds) => void;
  onClear: () => void;
}

export function NeedsProfile({ needs, onApply, onClear }: NeedsProfileProps) {
  const [draft, setDraft] = useState<DrivingNeeds>(() => ({
    ...(needs ?? defaultNeeds),
  }));
  const [announcement, setAnnouncement] = useState("");
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const summaryRef = useRef<HTMLElement>(null);
  const id = useId();
  const summary = needs ? summarizeNeeds(needs) : [];

  useEffect(() => {
    setDraft({ ...(needs ?? defaultNeeds) });
  }, [needs]);

  function change<K extends keyof DrivingNeeds>(
    key: K,
    value: DrivingNeeds[K],
  ) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function closeAndFocus() {
    if (detailsRef.current) detailsRef.current.open = false;
    summaryRef.current?.focus();
  }

  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (summarizeNeeds(draft).length === 0) {
      onClear();
      setAnnouncement("尚未设置明确需求，保留当前筛选与排序。");
    } else {
      onApply({ ...draft });
      setAnnouncement("用车需求已应用，推荐理由和看车建议已更新。");
    }
    closeAndFocus();
  }

  function clear() {
    setDraft({ ...defaultNeeds });
    onClear();
    setAnnouncement("已清除用车需求，保留当前筛选与排序。");
    closeAndFocus();
  }

  return (
    <section className="needs-profile" aria-label="用车需求">
      <details ref={detailsRef}>
        <summary ref={summaryRef} className="needs-profile-toggle">
          <SlidersHorizontal size={21} aria-hidden="true" />
          <span className="needs-profile-copy">
            <strong>按我的需求选车</strong>
            <span className="needs-profile-summary">
              {summary.length
                ? summary.join(" · ")
                : "说说预算和使用场景，了解每台车为什么适合你"}
            </span>
          </span>
          <span className="needs-profile-edit">
            {needs ? "修改需求" : "填写需求"}
          </span>
          <ChevronDown
            className="needs-profile-chevron"
            size={18}
            aria-hidden="true"
          />
        </summary>
        <form className="needs-profile-form" noValidate onSubmit={apply}>
          <p className="needs-profile-help" id={`${id}-help`}>
            各项均可选，点击应用后生效。推荐会保留不匹配提醒，不代表车况保证。
          </p>
          <div className="needs-profile-grid">
            <div>
              <label className="field-label" htmlFor={`${id}-purpose`}>
                主要用途
              </label>
              <div className="select-wrap">
                <select
                  id={`${id}-purpose`}
                  value={draft.purpose}
                  onChange={(event) =>
                    change(
                      "purpose",
                      event.target.value as DrivingNeeds["purpose"],
                    )
                  }
                >
                  <option value="unsure">暂不确定</option>
                  <option value="commute">日常通勤</option>
                  <option value="family">家庭出行</option>
                  <option value="long-distance">经常长途</option>
                </select>
                <ChevronDown size={15} aria-hidden="true" />
              </div>
            </div>
            <div>
              <label className="field-label" htmlFor={`${id}-budget`}>
                已列费用预算上限
              </label>
              <div className="select-wrap">
                <select
                  id={`${id}-budget`}
                  aria-describedby={`${id}-budget-help`}
                  value={draft.maxBudget ?? ""}
                  onChange={(event) =>
                    change(
                      "maxBudget",
                      event.target.value === ""
                        ? null
                        : Number(event.target.value),
                    )
                  }
                >
                  <option value="">暂不设上限</option>
                  <option value="100000">10 万元</option>
                  <option value="150000">15 万元</option>
                  <option value="200000">20 万元</option>
                  <option value="250000">25 万元</option>
                  <option value="300000">30 万元</option>
                </select>
                <ChevronDown size={15} aria-hidden="true" />
              </div>
            </div>
            <div>
              <label className="field-label" htmlFor={`${id}-passengers`}>
                常乘人数（含驾驶员）
              </label>
              <div className="select-wrap">
                <select
                  id={`${id}-passengers`}
                  value={draft.passengers}
                  onChange={(event) =>
                    change(
                      "passengers",
                      event.target.value as DrivingNeeds["passengers"],
                    )
                  }
                >
                  <option value="unsure">暂不确定</option>
                  <option value="1-2">1–2 人</option>
                  <option value="3-5">3–5 人，按 5 座核对</option>
                  <option value="6+">6 人及以上</option>
                </select>
                <ChevronDown size={15} aria-hidden="true" />
              </div>
            </div>
            <div>
              <label className="field-label" htmlFor={`${id}-distance`}>
                日常里程
              </label>
              <div className="select-wrap">
                <select
                  id={`${id}-distance`}
                  value={draft.dailyDistance}
                  onChange={(event) =>
                    change(
                      "dailyDistance",
                      event.target.value as DrivingNeeds["dailyDistance"],
                    )
                  }
                >
                  <option value="unsure">暂不确定</option>
                  <option value="under30">每天少于 30 公里</option>
                  <option value="30to80">每天 30–80 公里</option>
                  <option value="over80">每天超过 80 公里</option>
                </select>
                <ChevronDown size={15} aria-hidden="true" />
              </div>
            </div>
            <div>
              <label className="field-label" htmlFor={`${id}-charging`}>
                补能条件
              </label>
              <div className="select-wrap">
                <select
                  id={`${id}-charging`}
                  value={draft.charging}
                  onChange={(event) =>
                    change(
                      "charging",
                      event.target.value as DrivingNeeds["charging"],
                    )
                  }
                >
                  <option value="unsure">尚未确认</option>
                  <option value="home">有固定家充</option>
                  <option value="public">主要依赖公共充电</option>
                  <option value="none">暂无方便的充电条件</option>
                </select>
                <ChevronDown size={15} aria-hidden="true" />
              </div>
            </div>
            <div>
              <label className="field-label" htmlFor={`${id}-priority`}>
                更看重什么
              </label>
              <div className="select-wrap">
                <select
                  id={`${id}-priority`}
                  value={draft.priority}
                  onChange={(event) =>
                    change(
                      "priority",
                      event.target.value as DrivingNeeds["priority"],
                    )
                  }
                >
                  <option value="balanced">综合考虑</option>
                  <option value="parking">停车便利</option>
                  <option value="comfort">乘坐舒适</option>
                  <option value="running-cost">日常使用成本</option>
                </select>
                <ChevronDown size={15} aria-hidden="true" />
              </div>
            </div>
          </div>
          <p className="needs-profile-budget-note" id={`${id}-budget-help`}>
            这里的预算包含车价、服务费和过户服务费；保险、专项检测、整备、运输等仍需报价，请另留预算。车辆筛选中的预算仅按车价。
          </p>
          <div className="needs-profile-actions">
            <button type="submit" className="button">
              应用用车需求 <ArrowRight size={16} aria-hidden="true" />
            </button>
            <button type="button" className="text-button" onClick={clear}>
              <RotateCcw size={14} aria-hidden="true" /> 清除用车需求
            </button>
          </div>
          <p className="needs-profile-privacy">
            需求仅保留在当前页面，刷新后清除；不会发送给销售。
          </p>
        </form>
      </details>
      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>
    </section>
  );
}

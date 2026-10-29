import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  Info,
  LoaderCircle,
  MapPin,
} from "lucide-react";
import type { Vehicle, VisitTask } from "../types";
import { Modal } from "./Modal";
import { VisitPlanSummary } from "./VehicleGuidance";

import { getVisitDates, isAvailableVisitDate } from "../lib/appointmentDates";

type Errors = Partial<Record<"date" | "slot" | "phone" | "demo", string>>;

export function AppointmentDialog({
  open,
  vehicle,
  visitTasks,
  needsSummary,
  onReviewPlan,
  onClose,
}: {
  open: boolean;
  vehicle: Vehicle | null;
  visitTasks: VisitTask[];
  needsSummary: string[];
  onReviewPlan: () => void;
  onClose: () => void;
}) {
  const [dates, setDates] = useState(getVisitDates);
  const [date, setDate] = useState("");
  const [slot, setSlot] = useState("");
  const [phone, setPhone] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{
    date: string;
    slot: string;
    phone: string;
    tasks: VisitTask[];
    needs: string[];
  } | null>(null);
  const dateRef = useRef<HTMLInputElement>(null);
  const slotRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const demoRef = useRef<HTMLInputElement>(null);
  const successRef = useRef<HTMLHeadingElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    let refreshTimer: ReturnType<typeof setTimeout>;
    const refresh = () => {
      const current = getVisitDates();
      setDates(current);
      const nextMidnight = new Date(
        `${current[0].value}T00:00:00+08:00`,
      ).getTime();
      refreshTimer = setTimeout(
        refresh,
        Math.max(250, nextMidnight - Date.now() + 100),
      );
    };
    const onVisible = () => {
      if (document.hidden) return;
      clearTimeout(refreshTimer);
      refresh();
    };
    refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(refreshTimer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [open]);

  useEffect(() => {
    setDate("");
    setSlot("");
    setPhone("");
    setAcknowledged(false);
    setErrors({});
    setResult(null);
  }, [vehicle?.id]);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  useEffect(() => {
    if (result) successRef.current?.focus();
  }, [result]);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (pendingRef.current) return;
    const next: Errors = {};
    if (!isAvailableVisitDate(date)) {
      setDates(getVisitDates());
      next.date = date
        ? "日期已过期或不在未来七天内，请重新选择。"
        : "请选择一个看车日期。";
    }
    if (!slot) next.slot = "请选择一个看车时段。";
    if (!/^1[3-9]\d{9}$/.test(phone.trim()))
      next.phone = "请输入11位手机号，演示可使用 13800000000。";
    if (!acknowledged) next.demo = "请先确认你已了解这是演示预约。";
    setErrors(next);
    if (Object.keys(next).length) {
      const first = next.date
        ? dateRef
        : next.slot
          ? slotRef
          : next.phone
            ? phoneRef
            : demoRef;
      requestAnimationFrame(() => first.current?.focus());
      return;
    }
    pendingRef.current = true;
    setPending(true);
    timer.current = setTimeout(() => {
      setResult({
        date,
        slot,
        phone: `${phone.slice(0, 3)}****${phone.slice(-4)}`,
        tasks: visitTasks.map((task) => ({ ...task })),
        needs: [...needsSummary],
      });
      setPhone("");
      setPending(false);
      pendingRef.current = false;
    }, 450);
  }

  function close() {
    if (pendingRef.current) return;
    if (result) {
      setResult(null);
      setDate("");
      setSlot("");
      setAcknowledged(false);
      setErrors({});
    }
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title={result ? "预约示例已生成" : "预约看车"}
      subtitle={
        result
          ? "你已完成一次完整的预约体验"
          : "选个方便的时间，近距离了解这台车"
      }
      className="appointment-modal"
      busy={pending}
    >
      {vehicle && (
        <div className="modal-body appointment-body">
          {result ? (
            <div className="booking-success">
              <div className="success-icon">
                <CheckCircle2 size={42} />
              </div>
              <h3 ref={successRef} tabIndex={-1}>
                预约示例已生成
              </h3>
              <p>以下是你的演示预约单</p>
              <dl className="booking-summary">
                <div>
                  <dt>所选车辆</dt>
                  <dd>
                    {vehicle.brand} {vehicle.model}
                  </dd>
                </div>
                <div>
                  <dt>看车时间</dt>
                  <dd>
                    {result.date} {result.slot}
                  </dd>
                </div>
                <div>
                  <dt>示例地点</dt>
                  <dd>{vehicle.location}</dd>
                </div>
                <div>
                  <dt>示例联系号码</dt>
                  <dd>{result.phone}</dd>
                </div>
              </dl>
              <VisitPlanSummary
                tasks={result.tasks}
                needsSummary={result.needs}
              />
              <p className="demo-notice">
                <Info size={17} />
                这份预约仅用于体验，没有发送给商家，也不会产生电话联系。
              </p>
              <button className="button full-width" onClick={close}>
                完成，继续选车
                <ArrowRight size={16} />
              </button>
            </div>
          ) : (
            <form noValidate onSubmit={submit}>
              <div className="booking-car">
                <img
                  src={vehicle.image}
                  alt={`${vehicle.brand}${vehicle.model}车型示意图`}
                />
                <div>
                  <h3>
                    {vehicle.brand} {vehicle.model}
                  </h3>
                  <p>{vehicle.trim}</p>
                  <span>
                    <MapPin size={13} />
                    {vehicle.location}
                  </span>
                </div>
              </div>
              <VisitPlanSummary
                tasks={visitTasks}
                needsSummary={needsSummary}
              />
              <button
                type="button"
                className="button button-outline button-small booking-plan-review"
                onClick={onReviewPlan}
                disabled={pending}
              >
                返回车况，调整检测清单
              </button>
              <div className="demo-notice">
                <Info size={17} />
                <p>
                  这是预约流程演示。无需真实手机号，可输入{" "}
                  <strong>13800000000</strong> 体验。
                </p>
              </div>
              <fieldset
                className="booking-field"
                aria-describedby={
                  errors.date ? "booking-date-error" : undefined
                }
              >
                <legend>
                  <CalendarDays size={17} />
                  看车日期
                </legend>
                <div className="date-options">
                  {dates.map((item, index) => (
                    <label
                      className={`date-option ${date === item.value ? "is-selected" : ""}`}
                      key={item.value}
                    >
                      <input
                        ref={index === 0 ? dateRef : undefined}
                        type="radio"
                        name="visit-date"
                        value={item.value}
                        checked={date === item.value}
                        onChange={() => {
                          setDate(item.value);
                          setErrors((current) => ({
                            ...current,
                            date: undefined,
                          }));
                        }}
                        aria-invalid={!!errors.date}
                        aria-describedby={
                          errors.date ? "booking-date-error" : undefined
                        }
                      />
                      <span>{item.weekday}</span>
                      <strong>{item.label}</strong>
                    </label>
                  ))}
                </div>
                {errors.date && (
                  <p className="field-error" id="booking-date-error">
                    {errors.date}
                  </p>
                )}
              </fieldset>
              <fieldset
                className="booking-field"
                aria-describedby={
                  errors.slot ? "booking-slot-error" : undefined
                }
              >
                <legend>
                  <Clock3 size={17} />
                  看车时段<span className="legend-note">香港 / 北京时间</span>
                </legend>
                <div className="slot-options">
                  {[
                    "09:00–11:00",
                    "11:00–13:00",
                    "14:00–16:00",
                    "16:00–18:00",
                  ].map((item, index) => (
                    <label
                      className={`slot-option ${slot === item ? "is-selected" : ""}`}
                      key={item}
                    >
                      <input
                        ref={index === 0 ? slotRef : undefined}
                        type="radio"
                        name="visit-slot"
                        value={item}
                        checked={slot === item}
                        onChange={() => {
                          setSlot(item);
                          setErrors((current) => ({
                            ...current,
                            slot: undefined,
                          }));
                        }}
                        aria-invalid={!!errors.slot}
                        aria-describedby={
                          errors.slot ? "booking-slot-error" : undefined
                        }
                      />
                      {item}
                    </label>
                  ))}
                </div>
                {errors.slot && (
                  <p className="field-error" id="booking-slot-error">
                    {errors.slot}
                  </p>
                )}
              </fieldset>
              <div className="booking-field">
                <label className="field-label" htmlFor="booking-phone">
                  联系手机号
                </label>
                <input
                  ref={phoneRef}
                  id="booking-phone"
                  type="tel"
                  autoComplete="off"
                  inputMode="numeric"
                  maxLength={11}
                  value={phone}
                  onChange={(event) => {
                    setPhone(event.target.value);
                    setErrors((current) => ({ ...current, phone: undefined }));
                  }}
                  placeholder="演示号码：13800000000"
                  aria-invalid={!!errors.phone}
                  aria-describedby={
                    errors.phone ? "booking-phone-error" : "booking-phone-help"
                  }
                />
                <p className="field-error" id="booking-phone-error">
                  {errors.phone}
                </p>
                <p id="booking-phone-help" className="field-caption">
                  号码仅用于当前演示，不会保存或发送。
                </p>
              </div>
              <label className="check-option booking-ack">
                <input
                  ref={demoRef}
                  type="checkbox"
                  checked={acknowledged}
                  onChange={(event) => {
                    setAcknowledged(event.target.checked);
                    setErrors((current) => ({ ...current, demo: undefined }));
                  }}
                  aria-invalid={!!errors.demo}
                  aria-describedby={
                    errors.demo ? "booking-demo-error" : undefined
                  }
                />
                <span className="checkbox-mark">
                  {acknowledged && <Check size={12} />}
                </span>
                <span>我已了解这是一份演示预约</span>
              </label>
              {errors.demo && (
                <p className="field-error" id="booking-demo-error">
                  {errors.demo}
                </p>
              )}
              <button
                type="submit"
                className="button full-width booking-submit"
                disabled={pending}
                aria-busy={pending}
              >
                {pending ? (
                  <>
                    <LoaderCircle size={18} className="spin" />
                    正在生成…
                  </>
                ) : (
                  <>
                    生成预约示例
                    <ArrowRight size={17} />
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      )}
    </Modal>
  );
}

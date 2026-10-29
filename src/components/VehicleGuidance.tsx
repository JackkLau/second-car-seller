import { ArrowRight, ClipboardList, Info, UsersRound } from "lucide-react";
import type { DrivingNeeds, Vehicle, VisitTask } from "../types";
import { buildVisitTasks, getAdditionalCosts } from "../lib/visitPlan";

export function VisitPlanSummary({
  tasks,
  needsSummary,
}: {
  tasks: VisitTask[];
  needsSummary: string[];
}) {
  return (
    <section className="visit-plan-summary" aria-label="看车沟通清单">
      <h3>看车沟通清单</h3>
      {needsSummary.length > 0 && <p>用车需求：{needsSummary.join(" · ")}</p>}
      {tasks.length ? (
        <ul>
          {tasks.map((task) => (
            <li key={task.id}>
              <strong>{task.title}</strong>
              <p>销售配合：{task.salesAction}</p>
              <small>费用：{task.feeNote}</small>
            </li>
          ))}
        </ul>
      ) : (
        <p>尚未勾选专项项目，可先在车况详情中完善清单。</p>
      )}
      <p className="field-caption">
        清单仅保留在当前页面，未发送给销售；勾选不代表检测已完成、销售已确认或同意付费。
      </p>
    </section>
  );
}

export function VehicleGuidance({
  vehicle,
  needs,
  selectedTaskIds,
  onToggleTask,
  onBook,
}: {
  vehicle: Vehicle;
  needs: DrivingNeeds | null;
  selectedTaskIds: string[];
  onToggleTask: (id: string) => void;
  onBook: () => void;
}) {
  const tasks = buildVisitTasks(vehicle, needs);
  const selected = tasks.filter((task) => selectedTaskIds.includes(task.id));
  const costs = getAdditionalCosts(vehicle);
  return (
    <section className="vehicle-guidance" aria-label="针对这台车的看车计划">
      <div className="section-title">
        <ClipboardList size={21} />
        <h3>把感兴趣，变成有准备的看车</h3>
      </div>
      <p className="section-description">
        {needs
          ? "结合你的用车需求和这台车的检查记录，选择想进一步确认的项目。"
          : "先从待补检查和实际体验开始；填写用车需求后，建议会更有针对性。"}
      </p>
      <fieldset className="visit-task-list">
        <legend>选择需要销售配合的项目</legend>
        {tasks.map((task) => (
          <div
            className={`visit-task ${selectedTaskIds.includes(task.id) ? "is-selected" : ""}`}
            key={task.id}
          >
            <label className="visit-task-choice">
              <input
                type="checkbox"
                checked={selectedTaskIds.includes(task.id)}
                onChange={() => onToggleTask(task.id)}
                aria-describedby={`task-reason-${vehicle.id}-${task.id}`}
              />
              <strong>{task.title}</strong>
              {task.suggested && <span>建议优先</span>}
            </label>
            <p id={`task-reason-${vehicle.id}-${task.id}`}>{task.reason}</p>
            <details className="task-coordination">
              <summary>查看体验方法、销售配合与费用</summary>
              <dl>
                <div>
                  <dt>你可以做</dt>
                  <dd>{task.userAction}</dd>
                </div>
                <div>
                  <dt>销售需配合</dt>
                  <dd>{task.salesAction}</dd>
                </div>
                <div>
                  <dt>费用先确认</dt>
                  <dd>{task.feeNote}</dd>
                </div>
              </dl>
            </details>
          </div>
        ))}
      </fieldset>
      <div className="visit-plan-action">
        <p role="status">
          已选择 <strong>{selected.length}</strong> 项 · 未发送，费用未确认
        </p>
        <button className="button" onClick={onBook}>
          带着清单选时间
          <ArrowRight size={16} />
        </button>
      </div>

      <section className="sales-cooperation" aria-label="销售如何配合后续操作">
        <div className="section-title">
          <UsersRound size={21} />
          <h3>接下来，销售怎么配合你</h3>
        </div>
        <p className="section-description">
          下面是待沟通的配合要求，不代表商家已经承诺提供。
        </p>
        <ol>
          <li>
            <strong>到店前：资料与报价先确认</strong>
            <p>
              你确认需求和所选项目；销售核实车辆是否在售，提供逐项检测范围、原始报告与瑕疵照片，书面说明检测方、费用承担方及是否包含在服务费中。
            </p>
          </li>
          <li>
            <strong>到店时：按你的使用场景体验</strong>
            <p>
              你核对实车，体验座位、行李和停车需求；销售安排陪同、合适路线和专业检测资源，先确认试驾条件及费用，再开始操作。
            </p>
          </li>
          <li>
            <strong>检测后：拿到结果，再决定</strong>
            <p>
              专业检测方出具项目结果；销售说明异常、维修方案与单独报价。是否整备或复检由你确认，也可以继续比较或停止购买。
            </p>
          </li>
          <li>
            <strong>决定购买后：逐项确认交付</strong>
            <p>
              销售列明车款、服务费、过户、保险、运输及自选服务的收款方和金额，说明交付条件与售后范围；你核对明细后再决定是否签约或付款。
            </p>
          </li>
        </ol>
      </section>

      <section className="additional-costs" aria-label="后续可能涉及的费用">
        <h3>除了已列车款，还可能有哪些费用</h3>
        <p>
          以下金额均未确认，未计入“已列费用合计”。并非每项都会发生，先确认是否需要，再取得报价。
        </p>
        <ul>
          {costs.map((cost) => (
            <li key={cost.id}>
              <div>
                <strong>{cost.name}</strong>
                <span>
                  {cost.amount === null
                    ? "待报价"
                    : `¥${cost.amount.toLocaleString("zh-CN")}`}
                </span>
              </div>
              <p>发生条件：{cost.trigger}</p>
              <p>报价/收款方：{cost.payee}</p>
              <small>{cost.note}</small>
            </li>
          ))}
        </ul>
        <p className="cost-confirmation">
          <Info size={16} />
          未报价不等于免费；未经确认的专项检测、整备或自选服务不视为已授权。
        </p>
      </section>
    </section>
  );
}

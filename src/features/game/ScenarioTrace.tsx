"use client";

import type { GameData, Metrics, SimulationResult } from "@/shared/types";
import { directionLabels, formatNumber } from "./labels";
import styles from "./trace.module.css";

interface ScenarioTraceProps { result: SimulationResult; data: GameData }
const signed = (value: number) => `${value > 0 ? "+" : ""}${formatNumber(value)}`;

export function ScenarioTrace({ result, data }: ScenarioTraceProps) {
  const districtNames = new Map(data.districts.map(district => [district.id, district.name]));
  const initiatives = new Map(data.initiatives.map(initiative => [initiative.id, initiative]));

  function metricsTable(title: string, before: Metrics, after: Metrics) {
    return <table className={styles.metrics}>
      <caption>{title}</caption>
      <thead><tr><th scope="col">Показатель</th><th scope="col">Было</th><th scope="col">Стало</th></tr></thead>
      <tbody>{data.config.directions.map(metric => <tr key={metric}>
        <th scope="row">{directionLabels[metric]}</th>
        <td>{formatNumber(before[metric])}</td>
        <td className={after[metric] < before[metric] ? styles.decrease : undefined}><strong>{formatNumber(after[metric])}</strong></td>
      </tr>)}</tbody>
    </table>;
  }

  return <section className={styles.panel} aria-label="Последствия для города">
    <div className={styles.sectionHeading}><h3>Что изменилось в городе</h3><span>Шкала {data.config.bounds.min}–{data.config.bounds.max} · больше — лучше</span></div>
    <p className={styles.note}>Это условные последствия мероприятий. Средние значения показаны до двух знаков; исходная точность расчёта сохранена.</p>
    <div className={styles.cityMetrics}>{metricsTable("Город целиком", result.city.before, result.city.after)}</div>
    <details className={styles.trace}>
      <summary><strong>Откуда взялись числа</strong><span>Все показатели и вклад каждого мероприятия</span></summary>
      <p className={styles.note}>Сначала складываются все эффекты в районе. Затем значение один раз ограничивается шкалой {data.config.bounds.min}–{data.config.bounds.max}.</p>
      {result.districts.map(district => <section key={district.districtId} className={styles.traceDistrict} aria-label={`Разбор: ${districtNames.get(district.districtId) ?? district.districtId}`}>
        <h4>{districtNames.get(district.districtId) ?? district.districtId} район</h4>
        {result.trace.filter(entry => entry.districtId === district.districtId).map(entry => <details key={entry.metric} className={styles.traceMetric}>
          <summary><span>{directionLabels[entry.metric]}</span><strong>{formatNumber(entry.baseline)} → {formatNumber(entry.after)}</strong></summary>
          <dl className={styles.traceTotals}><div><dt>Исходное значение</dt><dd>{formatNumber(entry.baseline)}</dd></div></dl>
          {entry.contributions.length === 0 ? <p className={styles.note}>Выбранные мероприятия не меняют этот показатель.</p> : <ul className={styles.contributions}>{entry.contributions.map((contribution, index) => {
            const initiative = initiatives.get(contribution.initiativeId);
            const effect = initiative?.effects.find(item => item.ruleId === contribution.ruleId);
            return <li key={`${contribution.ruleId}:${index}`}>
              <div><strong>{initiative?.title ?? contribution.initiativeId}</strong><b className={contribution.delta < 0 ? styles.decrease : undefined}>{signed(contribution.delta)}</b></div>
              {initiative && <p>{initiative.description}</p>}
              {effect && <p>{effect.explanation}</p>}
              <code>{contribution.ruleId}</code>
            </li>;
          })}</ul>}
          <dl className={styles.traceTotals}>
            <div><dt>Сумма до ограничения</dt><dd>{formatNumber(entry.rawAfter)}</dd></div>
            <div><dt>Поправка ограничения (clamp)</dt><dd>{signed(entry.clampAdjustment)}</dd></div>
            <div><dt>Итоговый показатель</dt><dd>{formatNumber(entry.after)}</dd></div>
          </dl>
        </details>)}
      </section>)}
    </details>
  </section>;
}

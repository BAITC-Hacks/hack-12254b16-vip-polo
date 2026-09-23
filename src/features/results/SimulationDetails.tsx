"use client";

import { useState } from "react";
import { getGameData } from "@/lib/simulation";
import { DIRECTIONS } from "@/shared/constants";
import type { Direction, SimulationResult } from "@/shared/types";
import styles from "./results.module.css";

const labels: Record<Direction, string> = {
  transport: "Транспорт", greenery: "Озеленение", social: "Социальная среда",
  safety: "Безопасность", service: "Городские услуги",
};
const number = (value: number) => new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(value);
const signed = (value: number) => `${value > 0 ? "+" : ""}${number(value)}`;

// This view displays the supplied calculation; it never runs a simulation.
export function SimulationDetails({ result }: { result: SimulationResult }) {
  const [cityOpen, setCityOpen] = useState(false);
  const data = getGameData();
  const catalogMatches = data.config.modelVersion === result.modelVersion && data.config.datasetVersion === result.datasetVersion;
  const districtNames = new Map(catalogMatches ? data.districts.map(district => [district.id, district.name]) : []);
  const initiatives = new Map(catalogMatches ? data.initiatives.map(initiative => [initiative.id, initiative]) : []);
  return <div className={styles.calculationDetails}>
    <details className={styles.cityDetails} onToggle={event => setCityOpen(event.currentTarget.open)}>
      <summary>Показатели города целиком</summary>
      {cityOpen && <><p className={styles.muted}>Средние показатели из проверенного результата. Округление применяется только к отображению.</p>
      <table className={styles.cityMetrics}>
        <caption>Город целиком</caption>
        <thead><tr><th scope="col">Показатель</th><th scope="col">До</th><th scope="col">После</th></tr></thead>
        <tbody>{DIRECTIONS.map(metric => <tr key={metric}>
          <th scope="row">{labels[metric]}</th>
          <td>{number(result.city.before[metric])}</td>
          <td className={result.city.after[metric] < result.city.before[metric] ? styles.negative : undefined}>{number(result.city.after[metric])}</td>
        </tr>)}</tbody>
      </table></>}
    </details>
    <details className={styles.trace}>
      <summary><strong>Откуда взялись числа</strong><span>Все показатели и вклад каждого мероприятия</span></summary>
      <p className={styles.muted}>Сначала складываются все эффекты в районе, затем применяется ограничение шкалы. Ниже показаны исходные значения, вклады и итог из проверенного расчёта.</p>
      {result.districts.map(district => <section key={district.districtId} className={styles.traceDistrict} aria-label={`Разбор: ${districtNames.get(district.districtId) ?? district.districtId}`}>
        <h4>{districtNames.get(district.districtId) ?? district.districtId} район</h4>
        {result.trace.filter(entry => entry.districtId === district.districtId).map(entry => <details key={entry.metric} className={styles.traceMetric}>
          <summary><span>{labels[entry.metric]}</span><strong>{number(entry.baseline)} → {number(entry.after)}</strong></summary>
          <dl className={styles.traceTotals}><div><dt>Исходное значение</dt><dd>{number(entry.baseline)}</dd></div></dl>
          {entry.contributions.length === 0 ? <p className={styles.muted}>Выбранные мероприятия не меняют этот показатель.</p> : <ul className={styles.contributions}>{entry.contributions.map((contribution, index) => {
            const initiative = initiatives.get(contribution.initiativeId);
            const effect = initiative?.effects.find(item => item.ruleId === contribution.ruleId);
            return <li key={`${contribution.ruleId}:${index}`}>
              <div><strong>{initiative?.title ?? contribution.initiativeId}</strong><b className={contribution.delta < 0 ? styles.negative : undefined}>{signed(contribution.delta)}</b></div>
              {initiative && <p>{initiative.description}</p>}
              {effect && <p>{effect.explanation}</p>}
              <code>{contribution.ruleId}</code>
            </li>;
          })}</ul>}
          <dl className={styles.traceTotals}>
            <div><dt>Сумма до ограничения</dt><dd>{number(entry.rawAfter)}</dd></div>
            <div><dt>Поправка ограничения (clamp)</dt><dd>{signed(entry.clampAdjustment)}</dd></div>
            <div><dt>Итоговый показатель</dt><dd>{number(entry.after)}</dd></div>
          </dl>
        </details>)}
      </section>)}
    </details>
  </div>;
}

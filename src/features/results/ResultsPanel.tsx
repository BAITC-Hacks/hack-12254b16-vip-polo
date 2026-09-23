"use client";

import { useId, useMemo, useState } from "react";
import { getGameData } from "@/lib/simulation";
import { DIRECTIONS } from "@/shared/constants";
import type { ResultsPanelProps } from "@/shared/ports";
import type { AnalysisPoint, Direction, Fact } from "@/shared/types";
import { createResultsExport, matchingAnalysis } from "./export";
import styles from "./results.module.css";
import { SimulationDetails } from "./SimulationDetails";

const metricLabels: Record<Direction, string> = {
  transport: "Транспорт", greenery: "Озеленение", social: "Социальная среда",
  safety: "Безопасность", service: "Городские услуги",
};
const numberFormat = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 });
const number = (value: number) => numberFormat.format(value);
const change = (value: number) => `${value > 0 ? "+" : ""}${number(value)}`;
const fallbackReasons = {
  unavailable: "AI недоступен. Показано локальное объяснение по правилам модели.",
  timeout: "AI не ответил вовремя. Показано локальное объяснение по правилам модели.",
  invalid_response: "Ответ AI не прошёл проверку. Показано локальное объяснение по правилам модели.",
  ready: "Показано локальное объяснение по правилам модели.",
};

function Explanation({ point, facts, idPrefix }: { point: AnalysisPoint; facts: Fact[]; idPrefix: string }) {
  return <div className={styles.explanation}>
    <p>{point.text}</p>
    <ul className={styles.references} aria-label="Основания объяснения">
      {point.factIds.map(factId => {
        const index = facts.findIndex(fact => fact.id === factId);
        const fact = facts[index];
        return fact ? <li key={factId}><a href={`#${idPrefix}-fact-${index}`}>
          {fact.label}: <strong>{number(fact.value)} {fact.unit}</strong>
        </a></li> : null;
      })}
    </ul>
  </div>;
}

export function ResultsPanel({ result, analysisState, onRetryAnalysis, onReplay, onEdit }: ResultsPanelProps) {
  const id = useId();
  const data = useMemo(() => getGameData(), []);
  const catalogMatches = data.config.modelVersion === result.modelVersion && data.config.datasetVersion === result.datasetVersion;
  const districtNames = new Map(catalogMatches ? data.districts.map(district => [district.id, district.name]) : []);
  const [exportMessage, setExportMessage] = useState("");
  const analysis = matchingAnalysis(result, analysisState);
  const loading = analysisState.status === "loading";
  const mismatched = analysisState.status === "ready" && !analysis;

  function download() {
    let url: string | undefined;
    const link = document.createElement("a");
    try {
      const json = JSON.stringify(createResultsExport(result, analysisState), null, 2);
      url = URL.createObjectURL(new Blob([json], { type: "application/json;charset=utf-8" }));
      link.href = url;
      link.download = "akim-results.json";
      link.hidden = true;
      document.body.append(link);
      link.click();
      setExportMessage("JSON-файл подготовлен к скачиванию.");
    } catch {
      setExportMessage("Не удалось скачать JSON. Попробуйте ещё раз.");
    } finally {
      link.remove();
      if (url) {
        const objectUrl = url;
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      }
    }
  }

  return <section className={styles.panel} aria-labelledby={`${id}-title`}>
    <header className={styles.header}>
      <div><p className={styles.eyebrow}>Итоги ваших решений</p><h2 id={`${id}-title`}>Результаты сценария</h2></div>
      <span className={styles.badge}>Синтетические данные</span>
    </header>
    <p className={styles.disclaimer}>Учебная модель условных районов. Score не является официальной оценкой Астаны. Последствия описывают условный сценарий после реализации мероприятий.</p>
    <div className={styles.summary}>
      <section className={styles.scoreCard} aria-labelledby={`${id}-score`}>
        <h3 id={`${id}-score`}>Astana Quality of Life Score</h3>
        <dl className={styles.scoreNumbers}>
          <div><dt>До решений</dt><dd>{number(result.score.before)}</dd></div>
          <div><dt>После решений</dt><dd>{number(result.score.after)}</dd></div>
          <div><dt>Изменение Score</dt><dd>{change(result.score.delta)}</dd></div>
        </dl>
        <p>Учебный индекс · шкала от 0 до 100</p>
      </section>
      <section className={styles.budgetCard} aria-labelledby={`${id}-budget`}>
        <h3 id={`${id}-budget`}>Бюджет</h3>
        <dl className={styles.budgetNumbers}>
          <div><dt>Начальный</dt><dd>{number(result.budget.initial)}</dd></div>
          <div><dt>Потрачено</dt><dd>{number(result.budget.spent)}</dd></div>
          <div><dt>Осталось</dt><dd>{number(result.budget.remaining)}</dd></div>
        </dl>
        <progress className={styles.budgetProgress} value={result.budget.spent} max={result.budget.initial || 1} aria-label="Использованный бюджет" />
        <p>Условных единиц. Экономия не добавляет баллы.</p>
        <p className={styles.completeness}>{result.complete ? "Все направления включены в план" : "Промежуточный результат: план ещё не завершён"}</p>
      </section>
    </div>
    {result.warnings.length > 0 && <section className={styles.notice} aria-label="Оговорки расчёта"><ul>{result.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></section>}

    <section aria-labelledby={`${id}-districts`}>
      <h3 id={`${id}-districts`}>Изменения районов</h3>
      <p className={styles.muted}>Все показатели взяты из расчёта. Больше — лучше.</p>
      <div className={styles.districts}>{result.districts.map(district => <div className={styles.districtCard} key={district.districtId}>
        <table>
          <caption>{districtNames.has(district.districtId) ? `${districtNames.get(district.districtId)} район` : `Район ${district.districtId}`}</caption>
          <thead><tr><th scope="col">Показатель</th><th scope="col">До</th><th scope="col">После</th><th scope="col"><span className={styles.desktopLabel}>Изменение</span><span className={styles.mobileLabel} aria-hidden="true">Δ</span><span className={styles.mobileAccessibleLabel}>Изменение</span></th></tr></thead>
          <tbody>{DIRECTIONS.map(metric => {
            const delta = district.after[metric] - district.before[metric];
            return <tr key={metric}><th scope="row">{metricLabels[metric]}</th><td>{number(district.before[metric])}</td><td>{number(district.after[metric])}</td><td className={delta < 0 ? styles.negative : undefined}>{change(delta)}</td></tr>;
          })}</tbody>
        </table>
      </div>)}</div>
    </section>

    <section className={styles.analysis} aria-labelledby={`${id}-analysis`}>
      <div className={styles.analysisHeader}><h3 id={`${id}-analysis`}>Объяснение результатов</h3>
        {analysis && <span className={styles.badge}>{analysis.source === "ai" ? "AI-анализ" : "Fallback · без AI"}</span>}
      </div>
      <div role="status" aria-live="polite" aria-atomic="true">
        {analysisState.status === "idle" && <p>Расчёт готов. AI-анализ ещё не запущен.</p>}
        {loading && <p>Готовим AI-анализ… Расчёт и JSON-экспорт уже доступны.</p>}
        {analysisState.status === "error" && <p className={styles.notice}>Анализ недоступен: {analysisState.message} Расчёт сохранён.</p>}
        {mismatched && <p role="alert" className={styles.notice}>Объяснение не соответствует текущему сценарию или ссылается на неизвестные факты. Повторите анализ. Расчёт сохранён.</p>}
        {analysis?.source === "fallback" && <p className={styles.notice}>{fallbackReasons[analysis.status]} Это не ответ AI.</p>}
        {analysis?.source === "ai" && <p className={styles.muted}>AI объясняет готовый расчёт и не меняет Score. Сверяйте выводы с указанными фактами.</p>}
      </div>
      {analysis && <>
        <Explanation point={analysis.summary} facts={result.facts} idPrefix={id} />
        <div className={styles.analysisGrid}>{([
          ["Сильные стороны", analysis.strengths], ["Риски", analysis.risks],
          ["Компромиссы", analysis.tradeoffs], ["Что можно пересмотреть", analysis.recommendations],
        ] as const).map(([title, points]) => points.length > 0 && <section className={styles.analysisGroup} key={title}>
          <h4>{title}</h4><ul>{points.map((point, index) => <li key={index}><Explanation point={point} facts={result.facts} idPrefix={id} /></li>)}</ul>
        </section>)}</div>
      </>}
      <button type="button" className={styles.secondaryButton} onClick={onRetryAnalysis} disabled={loading}>{loading ? "Анализ выполняется…" : analysisState.status === "idle" ? "Запустить AI-анализ" : "Повторить AI-анализ"}</button>
    </section>

    <SimulationDetails result={result} />

    <section aria-labelledby={`${id}-facts`}>
      <h3 id={`${id}-facts`}>Факты расчёта</h3>
      <p className={styles.muted}>Числа и подписи — из проверенного расчёта. Ссылки в объяснениях ведут к этим фактам.</p>
      <div className={styles.factsViewport} role="region" aria-labelledby={`${id}-facts`} tabIndex={0}>
        <dl className={styles.facts}>{result.facts.map((fact, index) => <div id={`${id}-fact-${index}`} key={fact.id} tabIndex={-1}>
          <dt>{fact.label}<code>{fact.id}</code></dt><dd>{number(fact.value)} {fact.unit}</dd>
        </div>)}</dl>
      </div>
    </section>
    <footer className={styles.footer}>
      <div className={styles.actions}>
        <button type="button" className={styles.primaryButton} onClick={onEdit}>Редактировать решения</button>
        <button type="button" className={styles.secondaryButton} onClick={onReplay}>Новая игра</button>
        <button type="button" className={styles.secondaryButton} onClick={download}>Скачать JSON</button>
      </div>
      <p className={styles.muted} role="status" aria-live="polite">{exportMessage}</p>
      <p className={styles.versions}>Модель: {result.modelVersion} · Данные: {result.datasetVersion}</p>
    </footer>
  </section>;
}

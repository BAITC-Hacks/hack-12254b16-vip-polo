"use client";
import { directionLabels, formatNumber } from "@/features/game/labels";
import { getGameData } from "@/lib/simulation";
import type { ResultsPanelProps } from "@/shared/ports";
import { aiAnalysisSchema } from "@/shared/schema";
import type { AnalysisPoint, Fact, Metrics } from "@/shared/types";
import styles from "./results.module.css";

const signed = (value: number) => `${value > 0 ? "+" : ""}${formatNumber(value)}`;

function AnalysisPointView({ point, facts }: { point: AnalysisPoint; facts: Map<string, Fact> }) {
  return <div className={styles.analysisPoint}>
    <p>{point.text}</p>
    <details className={styles.factDetails}>
      <summary>Факты в основе вывода ({point.factIds.length})</summary>
      <ul>{point.factIds.map((id, index) => {
        const fact = facts.get(id);
        return fact ? <li key={`${id}:${index}`}><span>{fact.label}: <strong>{formatNumber(fact.value)} {fact.unit}</strong></span><code>{fact.id}</code></li> : null;
      })}</ul>
    </details>
  </div>;
}

export function ResultsPanel({ result, analysisState, onRetryAnalysis, onReplay }: ResultsPanelProps) {
  const data = getGameData();
  const { config } = data;
  const districtNames = new Map(data.districts.map(district => [district.id, district.name]));
  const initiatives = new Map(data.initiatives.map(initiative => [initiative.id, initiative]));
  const facts = new Map(result.facts.map(fact => [fact.id, fact]));
  const parsedAnalysis = analysisState.status === "ready" ? aiAnalysisSchema.safeParse(analysisState.analysis) : null;
  const candidate = parsedAnalysis?.success ? parsedAnalysis.data : null;
  const analysis = candidate && candidate.scenarioId === result.scenarioId
    && candidate.modelVersion === result.modelVersion && candidate.datasetVersion === result.datasetVersion
    && [candidate.summary, ...candidate.strengths, ...candidate.risks, ...candidate.tradeoffs, ...candidate.recommendations]
      .every(point => point.factIds.length > 0 && point.factIds.every(id => facts.has(id))) ? candidate : null;
  const analysisRejected = analysisState.status === "ready" && analysis === null;

  function metricsTable(title: string, before: Metrics, after: Metrics) {
    return <table className={styles.metrics}>
      <caption>{title}</caption>
      <thead><tr><th scope="col">Показатель</th><th scope="col">Было</th><th scope="col">Стало</th></tr></thead>
      <tbody>{config.directions.map(metric => <tr key={metric}>
        <th scope="row">{directionLabels[metric]}</th>
        <td>{formatNumber(before[metric])}</td>
        <td className={after[metric] < before[metric] ? styles.decrease : undefined}><strong>{formatNumber(after[metric])}</strong></td>
      </tr>)}</tbody>
    </table>;
  }

  return <section aria-label="Результаты" className={styles.panel}>
    <div className={styles.summary}>
      <section aria-label="Итоговый Score" className={styles.scoreCard}>
        <p className={styles.eyebrow}>Astana Quality of Life Score</p>
        <p className={styles.score}>{formatNumber(result.score.after)}<span> / {formatNumber(config.bounds.max)}</span></p>
        <div className={styles.scoreChange}><span>Было {formatNumber(result.score.before)}</span><strong>{signed(result.score.delta)} балла</strong></div>
        <p className={styles.scoreNote}>Учебный индекс качества жизни. AI не участвует в расчёте.</p>
      </section>
      <section aria-label="Итоговый бюджет" className={styles.budgetCard}>
        <p className={styles.eyebrow}>Бюджет сценария</p>
        <p className={styles.budgetNumber}>{formatNumber(result.budget.spent)}<span> из {formatNumber(result.budget.initial)}</span></p>
        <progress value={result.budget.spent} max={result.budget.initial || 1} aria-label="Использованный бюджет" />
        <p>Осталось <strong>{formatNumber(result.budget.remaining)} {config.currencyLabel}</strong></p>
        <span className={styles.status}>{result.complete ? "Все направления включены в план" : "Промежуточный результат: план ещё не завершён"}</span>
      </section>
    </div>

    {result.warnings.length > 0 && <aside className={styles.notice} aria-label="Замечания расчёта"><ul>{result.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></aside>}

    <section className={styles.section} aria-label="Последствия для города">
      <div className={styles.sectionHeading}><h3>Что изменилось в городе</h3><span>Шкала {config.bounds.min}–{config.bounds.max} · больше — лучше</span></div>
      <p className={styles.note}>Это условные последствия мероприятий. Средние значения показаны до двух знаков; исходная точность расчёта сохранена.</p>
      <div className={styles.cityMetrics}>{metricsTable("Город целиком", result.city.before, result.city.after)}</div>
      <div className={styles.districts}>{result.districts.map(district => <div key={district.districtId} className={styles.districtCard}>
        {metricsTable(`${districtNames.get(district.districtId) ?? district.districtId} район`, district.before, district.after)}
      </div>)}</div>
    </section>

    <details className={styles.trace}>
      <summary><strong>Откуда взялись числа</strong><span>Все показатели и вклад каждого мероприятия</span></summary>
      <p className={styles.note}>Сначала складываются все эффекты в районе. Затем значение один раз ограничивается шкалой {config.bounds.min}–{config.bounds.max}.</p>
      {result.districts.map(district => <section key={district.districtId} className={styles.traceDistrict} aria-label={`Разбор: ${districtNames.get(district.districtId) ?? district.districtId}`}>
        <h4>{districtNames.get(district.districtId) ?? district.districtId} район</h4>
        {result.trace.filter(entry => entry.districtId === district.districtId).map(entry => <details key={entry.metric} className={styles.traceMetric}>
          <summary><span>{directionLabels[entry.metric]}</span><strong>{formatNumber(entry.baseline)} → {formatNumber(entry.after)}</strong></summary>
          <dl className={styles.traceTotals}>
            <div><dt>Исходное значение</dt><dd>{formatNumber(entry.baseline)}</dd></div>
          </dl>
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

    <section className={styles.analysis} aria-label="Объяснение результата" aria-busy={analysisState.status === "loading"}>
      <div className={styles.sectionHeading}><h3>Разбор решений</h3><span>Дополнение к проверенному расчёту</span></div>
      {analysisState.status === "idle" && <p className={styles.note}>AI-анализ ещё не запрошен. Все числа и последствия уже доступны выше.</p>}
      {analysisState.status === "loading" && <p role="status" className={styles.notice}>Готовим объяснение решений. Расчёт уже готов — можно изучить показатели и правила выше.</p>}
      {analysisState.status === "error" && <div role="alert" className={styles.notice}><strong>AI-анализ сейчас недоступен.</strong><p>{analysisState.message}</p><p>Расчёт сохранён. Можно повторить запрос.</p></div>}
      {analysisRejected && <p role="alert" className={styles.notice}>Объяснение не соответствует этому сценарию или ссылается на неизвестные факты. Запросите анализ повторно.</p>}
      {analysis && <>
        <p className={styles.analysisSource}>{analysis.source === "ai" ? "Объяснение AI" : "Резервное объяснение · AI недоступен"}</p>
        {analysis.source === "fallback" && <p className={styles.note}>{analysis.status === "timeout" ? "Сервис не ответил вовремя." : analysis.status === "invalid_response" ? "Ответ сервиса не прошёл проверку." : "Сервис анализа недоступен."} Показано резервное объяснение из полученного ответа.</p>}
        <AnalysisPointView point={analysis.summary} facts={facts} />
        <div className={styles.analysisGrid}>{([
          ["Сильные стороны", analysis.strengths], ["Риски", analysis.risks],
          ["Компромиссы", analysis.tradeoffs], ["Рекомендации", analysis.recommendations],
        ] as const).filter(([, points]) => points.length > 0).map(([title, points]) => <section key={title}>
          <h4>{title}</h4>{points.map((point, index) => <AnalysisPointView key={index} point={point} facts={facts} />)}
        </section>)}</div>
      </>}
      {analysisState.status !== "loading" && (!analysis || analysis.source === "fallback") && <button type="button" className={styles.button} onClick={onRetryAnalysis}>{analysisState.status === "idle" ? "Запросить AI-анализ" : "Повторить AI-анализ"}</button>}
    </section>

    <div className={styles.footer}>
      <button type="button" className={styles.button} onClick={onReplay}>Новый сценарий</button>
      <details className={styles.metadata}><summary>Данные расчёта</summary><dl>
        <div><dt>Модель</dt><dd>{result.modelVersion}</dd></div>
        <div><dt>Набор данных</dt><dd>{result.datasetVersion}</dd></div>
        <div><dt>Идентификатор сценария</dt><dd><code>{result.scenarioId}</code></dd></div>
      </dl></details>
    </div>
  </section>;
}

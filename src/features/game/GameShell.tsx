"use client";

import { useEffect, useRef, useState } from "react";
import type { GameShellProps } from "@/shared/ports";
import { simulateScenario } from "@/lib/simulation";
import { ResultsPanel } from "@/features/results";
import { CityMap } from "./CityMap";
import { InitiativePicker } from "./InitiativePicker";
import { directionLabels, formatNumber } from "./labels";
import { useGame } from "./useGame";
import styles from "./game.module.css";

export function GameShell({ data }: GameShellProps) {
  // A new model/dataset starts a new session and cancels the previous requests.
  return <GameSession key={JSON.stringify([data.config.modelVersion, data.config.datasetVersion])} data={data} />;
}

function GameSession({ data }: GameShellProps) {
  const game = useGame(data);
  const [districtId, setDistrictId] = useState(data.districts[0]?.id ?? "");
  const [direction, setDirection] = useState(data.config.directions[0]);
  const [briefing, setBriefing] = useState(true);
  const resultHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (game.result) resultHeading.current?.focus();
  }, [game.result]);
  const selected = game.decisions.find(item => item.direction === direction);
  const district = data.districts.find(item => item.id === districtId);
  const shown = game.result ?? game.preview;
  const canFinish = game.preview?.complete === true && !game.submitting && game.analysisState.status !== "loading";
  const nextDirection = data.config.directions.find(item => item !== direction && !game.decisions.some(decision => decision.direction === item));
  // The model validates each full candidate, including the released replacement cost.
  const candidates = Object.fromEntries(data.initiatives.filter(item => item.direction === direction).map(item => [item.id, simulateScenario({
    modelVersion: data.config.modelVersion,
    datasetVersion: data.config.datasetVersion,
    decisions: [...game.decisions.filter(decision => decision.direction !== direction), { direction, districtId, initiativeId: item.id }]
  }, data, "draft")]));
  return <div className={styles.shell}>
    <header className={styles.header}><a className={styles.brand} href="#main-content"><span className={styles.brandMark} aria-hidden="true">А</span>ГОРОД / ЛАБ</a><span className={styles.headerNote}>VIP POLO · Учебный симулятор</span><button className={styles.textButton} onClick={() => setBriefing(value => !value)} aria-expanded={briefing} aria-controls="briefing">Как играть {briefing ? "−" : "+"}</button></header>
    <div id="main-content" className={styles.hero}>
      <div><p className={styles.eyebrow}>Ваш город. Ваши решения.</p><h1>Аким на 5 часов</h1><p className={styles.intro}>Пять решений, один бюджет.<br />Каким станет город после вашего выбора?</p></div>
      <div className={styles.heroAside}><span className={styles.bigNumber}>05</span><span>направлений<br />для перемен</span></div>
    </div>
    {briefing && <section id="briefing" className={styles.briefing} aria-label="Как играть"><strong>Ваша задача</strong><p>Выберите район и одно мероприятие в каждом направлении. Меняйте решения, сравнивайте последствия и завершите сценарий в пределах бюджета.</p><button className={styles.textButton} onClick={() => setBriefing(false)}>Понятно <span aria-hidden="true">↗</span></button></section>}
    <section className={styles.overview} aria-label="Состояние сценария">
      <div><span>Общий бюджет</span><strong>{data.config.budget} <small>{data.config.currencyLabel}</small></strong></div>
      <div><span>Остаток бюджета</span><strong aria-live="polite">{shown ? formatNumber(shown.budget.remaining) : "—"}<small>{shown ? "условных единиц" : "ожидает расчёта"}</small></strong></div>
      <div><span>Решения</span><strong>{game.decisions.length} <small>из {data.config.directions.length}</small></strong><progress value={game.decisions.length} max={data.config.directions.length} aria-label="Прогресс решений" /></div>
      <div><span>Учебный Score</span><strong>{shown ? formatNumber(shown.score.after) : "—"}<small>{shown ? "/ 100" : "ожидает расчёта"}</small></strong>{shown && <span className={styles.scoreChange}>{shown.score.delta > 0 ? "+" : ""}{formatNumber(shown.score.delta)} к исходному {formatNumber(shown.score.before)}</span>}</div>
    </section>
    {shown && <div className={styles.budgetTrack}><span>Использовано {formatNumber(shown.budget.spent)} из {formatNumber(shown.budget.initial)}</span><progress value={shown.budget.spent} max={shown.budget.initial} aria-label="Использованный бюджет" /><span>{game.result ? "Проверено на сервере" : "Предварительный результат"}</span></div>}
    {game.unavailable && <p className={styles.notice} role="status"><strong>Расчёт ещё не подключён.</strong> Можно собрать черновик решений. Бюджет и последствия пока не проверяются; полное прохождение недоступно.</p>}
    {!game.previewOutcome.ok && !game.unavailable && <p role="alert" className={styles.error}>{game.previewOutcome.error.message}</p>}
    <div className={styles.workspace}>
      <CityMap districts={data.districts} selectedDistrictId={districtId} preview={game.preview} onSelectDistrict={setDistrictId} />
      <section className={styles.decisionPanel} aria-labelledby="decisions-title">
        <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>02 / Решения</p><h2 id="decisions-title">План изменений</h2></div><span className={styles.tag}>{district?.name ?? "Выберите район"}</span></div>
        <div role="group" aria-label="Направления" className={styles.directions}>{data.config.directions.map((item, index) => <button type="button" key={item} aria-pressed={item === direction} onClick={() => setDirection(item)}><span>{game.decisions.some(d => d.direction === item) ? "✓" : `0${index + 1}`}</span>{directionLabels[item]}</button>)}</div>
        {selected && <p className={styles.selectionNote}>Текущее решение: {data.districts.find(d => d.id === selected.districtId)?.name}. {selected.districtId !== districtId && "Новый выбор перенесёт это решение в выбранный район."}</p>}
        {district && <InitiativePicker initiatives={data.initiatives} direction={direction} districtId={districtId}
          selectedInitiativeId={selected?.districtId === districtId ? selected.initiativeId : null} remainingBudget={game.preview?.budget.remaining ?? 0}
          candidates={candidates} replacing={!!selected}
          onSelect={initiativeId => game.select({ direction, districtId, initiativeId })} onRemove={() => game.remove(direction)} />}
        {selected && nextDirection && <button className={styles.nextButton} onClick={() => setDirection(nextDirection)}>Далее: {directionLabels[nextDirection]} <span aria-hidden="true">→</span></button>}
        {game.error && <p className={styles.error} role="alert">{game.error}</p>}
        <section className={styles.plan} aria-label="Ваши решения"><h3>В вашем плане <span>{game.decisions.length} / {data.config.directions.length}</span></h3>
          {!game.decisions.length ? <p className={styles.small}>Пока пусто. Начните с одного мероприятия.</p> : <ul>{data.config.directions.flatMap(item => {
            const decision = game.decisions.find(d => d.direction === item); if (!decision) return [];
            const initiative = data.initiatives.find(i => i.id === decision.initiativeId);
            return <li key={item}><button className={styles.planEdit} aria-label={`Изменить: ${directionLabels[item]}`} onClick={() => { setDirection(item); setDistrictId(decision.districtId); }}><strong>{directionLabels[item]} <em>{initiative?.cost} ед.</em></strong><span>{initiative?.title} · {data.districts.find(d => d.id === decision.districtId)?.name}</span></button><button className={styles.textButton} aria-label={`Удалить: ${directionLabels[item]}`} onClick={() => game.remove(item)}>×</button></li>;
          })}</ul>}
        </section>
        <div className={styles.actions}><button className={styles.primaryButton} disabled={!canFinish} onClick={() => void game.finish()}>{game.submitting ? "Рассчитываем…" : "Завершить сценарий"}<span aria-hidden="true">↗</span></button><button className={styles.textButton} disabled={!game.decisions.length && !game.result} onClick={game.replay}>Начать заново</button></div>
        <p className={styles.small}>{game.unavailable ? "Завершение станет доступно после подключения расчёта." : game.decisions.length < data.config.directions.length ? "Для завершения выберите по одному мероприятию в каждом направлении." : "Результат будет повторно проверен на сервере."}</p>
      </section>
    </div>
    {game.result && <section className={styles.resultArea} aria-label="Итог сценария">
      <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>03 / Последствия</p><h2 ref={resultHeading} tabIndex={-1}>Сценарий рассчитан</h2></div><button className={styles.textButton} onClick={game.edit}>Редактировать решения</button></div>
      <ResultsPanel result={game.result} analysisState={game.analysisState} onRetryAnalysis={() => void game.retryAnalysis()} onReplay={game.replay} onEdit={game.edit} />
    </section>}
    <footer className={styles.footer}><strong>Город — условный. Выбор — ваш.</strong><p>Данные синтетические. Районы не соответствуют административной карте Астаны. Score — учебный показатель, а не официальная оценка города или рекомендация акимату.</p><span>{data.config.modelVersion} · {data.config.datasetVersion}</span></footer>
  </div>;
}

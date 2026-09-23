"use client";
import type { InitiativePickerProps } from "@/shared/ports";
import type { Outcome, SimulationResult } from "@/shared/types";
import { directionLabels, formatNumber } from "./labels";
import styles from "./game.module.css";

export interface CandidatePreviewProps {
  candidates?: Record<string, Outcome<SimulationResult>>;
  replacing?: boolean;
}

export function InitiativePicker({ initiatives, direction, districtId, selectedInitiativeId, onSelect, onRemove, candidates, replacing = false }: InitiativePickerProps & CandidatePreviewProps) {
  return <section aria-label="Выбор мероприятия">
    <div className={styles.sectionHeading}><h3>{directionLabels[direction]}</h3>{selectedInitiativeId && <button type="button" className={styles.textButton} onClick={onRemove}>Отменить решение</button>}</div>
    <div className={styles.cards}>{initiatives.filter(item => item.direction === direction).map((item, index) => {
      const selected = item.id === selectedInitiativeId;
      const eligible = item.eligibleDistrictIds.includes(districtId);
      const candidate = candidates?.[item.id];
      const blocked = candidate && !candidate.ok && candidate.error.code !== "NOT_IMPLEMENTED";
      const action = selected ? "Выбрано" : selectedInitiativeId || replacing ? "Заменить" : "Выбрать";
      return <article key={item.id} className={`${styles.card} ${selected ? styles.selectedCard : ""}`}>
        <div className={styles.cardTop}><span className={styles.cardNumber}>0{index + 1}</span><span className={styles.cost}>{item.cost} <small>ед.</small></span></div>
        <h4>{item.title}</h4>
        <ul className={styles.effectBadges} aria-label="Изменения показателей">{item.effects.map(effect => <li key={effect.ruleId} className={effect.delta < 0 ? styles.negativeEffect : styles.positiveEffect}><strong>{effect.delta > 0 ? "+" : ""}{formatNumber(effect.delta)}</strong> {directionLabels[effect.metric]}</li>)}</ul>
        <details><summary>Что изменится</summary><p>{item.description}</p><ul>{item.effects.map(effect => <li key={effect.ruleId}>{effect.explanation}</li>)}</ul></details>
        {candidate?.ok && <p className={styles.candidateBudget}>{selected ? "Остаток бюджета" : "Останется после выбора"}: <strong>{formatNumber(candidate.data.budget.remaining)} ед.</strong></p>}
        {blocked && <p className={styles.unaffordable}>{candidate.error.code === "BUDGET_EXCEEDED" ? "Не помещается в бюджет. Уменьшите масштаб другого решения." : candidate.error.message}</p>}
        <button type="button" aria-label={`${action}: ${item.title}`} aria-pressed={selected} disabled={!eligible || !!blocked} onClick={() => onSelect(item.id)} className={styles.choiceButton}>
          {action}<span aria-hidden="true">{selected ? "✓" : "↗"}</span>
        </button>
        {!eligible && <p className={styles.small}>Недоступно для выбранного района</p>}
      </article>;
    })}</div>
    <p className={styles.small}>Цветные числа — изменения показателей выбранного района. При замене стоимость прежнего решения возвращается в бюджет.</p>
  </section>;
}

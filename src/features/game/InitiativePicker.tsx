"use client";
import type { InitiativePickerProps } from "@/shared/ports";
import { directionLabels } from "./labels";
import styles from "./game.module.css";

export function InitiativePicker({ initiatives, direction, districtId, selectedInitiativeId, onSelect, onRemove }: InitiativePickerProps) {
  return <section aria-label="Выбор мероприятия">
    <div className={styles.sectionHeading}><h3>{directionLabels[direction]}</h3>{selectedInitiativeId && <button type="button" className={styles.textButton} onClick={onRemove}>Отменить решение</button>}</div>
    <div className={styles.cards}>{initiatives.filter(item => item.direction === direction).map((item, index) => {
      const selected = item.id === selectedInitiativeId;
      const eligible = item.eligibleDistrictIds.includes(districtId);
      return <article key={item.id} className={`${styles.card} ${selected ? styles.selectedCard : ""}`}>
        <div className={styles.cardTop}><span className={styles.cardNumber}>0{index + 1}</span><span className={styles.cost}>{item.cost} <small>ед.</small></span></div>
        <h4>{item.title}</h4><p>{item.description}</p>
        <details><summary>Эффекты учебной модели</summary><ul>{item.effects.map(effect => <li key={effect.ruleId}>{directionLabels[effect.metric]}: {effect.delta > 0 ? "+" : ""}{effect.delta}. {effect.explanation}</li>)}</ul></details>
        <button type="button" aria-label={`${selected ? "Выбрано" : selectedInitiativeId ? "Заменить" : "Выбрать"}: ${item.title}`} aria-pressed={selected} disabled={!eligible} onClick={() => onSelect(item.id)} className={styles.choiceButton}>
          {selected ? "Выбрано" : selectedInitiativeId ? "Заменить" : "Выбрать"}<span aria-hidden="true">{selected ? "✓" : "↗"}</span>
        </button>
        {!eligible && <p className={styles.small}>Недоступно для выбранного района</p>}
      </article>;
    })}</div>
    <p className={styles.small}>При замене стоимость прежнего решения освобождается. Допустимость проверяет общий расчёт.</p>
  </section>;
}

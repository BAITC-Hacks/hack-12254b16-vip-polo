"use client";

import type { GameShellProps } from "@/shared/ports";
import styles from "./game.module.css";

export function GameShell({ data }: GameShellProps) {
  return (
    <section className={styles.panel} aria-labelledby="scaffold-status">
      <p className={styles.eyebrow}>VIP POLO · Нулевой этап</p>
      <h1>Аким на 5 часов</h1>
      <h2 id="scaffold-status">Каркас проекта готов к разработке</h2>
      <p>Здесь появится пошаговая игра об управлении условным городом: пять решений, ограниченный бюджет и объяснение последствий.</p>
      <dl className={styles.summary}>
        <div><dt>Общий бюджет</dt><dd>{data.config.budget} {data.config.currencyLabel}</dd></div>
        <div><dt>Условных районов</dt><dd>{data.districts.length}</dd></div>
        <div><dt>Направлений</dt><dd>{data.config.directions.length}</dd></div>
      </dl>
      <p className={styles.notice}>Игра, расчёт сценария и AI-анализ ещё не реализованы. Полное прохождение пока недоступно.</p>
      <p className={styles.disclaimer}>Данные синтетические. Это учебная модель, а не официальная оценка Астаны.</p>
    </section>
  );
}

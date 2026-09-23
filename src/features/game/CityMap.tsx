"use client";
import type { CityMapProps } from "@/shared/ports";
import { directionLabels, formatNumber } from "./labels";
import styles from "./game.module.css";

const areas = [
  { path: "M42 48 L274 30 L360 154 L284 229 L59 196 Z", x: 174, y: 118 },
  { path: "M59 211 L279 245 L356 175 L417 278 L276 358 L73 320 Z", x: 209, y: 282 },
  { path: "M81 337 L276 376 L431 296 L488 416 L292 492 L109 461 Z", x: 240, y: 423 }
];
export function CityMap({ districts, selectedDistrictId, preview, onSelectDistrict }: CityMapProps) {
  const selected = districts.find(d => d.id === selectedDistrictId);
  const after = preview?.districts.find(d => d.districtId === selectedDistrictId)?.after;
  return <section aria-labelledby="map-title" className={styles.mapPanel}>
    <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>01 / Территория</p><h2 id="map-title">Начните с района</h2></div><span className={styles.tag}>Условная карта</span></div>
    <svg className={styles.map} viewBox="0 0 540 530" role="group" aria-label="Выбор района на карте">
      <title>Три условных района города</title>
      <path d="M358 -20 C295 50 454 88 403 172 S422 271 484 306 S476 468 555 538" fill="none" stroke="#c2dce0" strokeWidth="37" aria-hidden="true" />
      <path d="M358 -20 C295 50 454 88 403 172 S422 271 484 306 S476 468 555 538" fill="none" stroke="#eff8f6" strokeWidth="2" strokeDasharray="5 9" aria-hidden="true" />
      {districts.map((district, index) => {
        const area = areas[index]; if (!area) return null;
        const isSelected = district.id === selectedDistrictId;
        return <g key={district.id} role="button" tabIndex={0} aria-label={`${district.name} район`} aria-pressed={isSelected}
          className={`${styles.district} ${isSelected ? styles.selectedDistrict : ""}`}
          onClick={() => onSelectDistrict(district.id)} onKeyDown={event => {
            if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelectDistrict(district.id); }
          }}>
          <path className={styles.districtShape} d={area.path} />
          <g aria-hidden="true" className={styles.mapBlocks}><path d={`M${area.x - 80} ${area.y - 48} h36 v18 h-36z M${area.x - 33} ${area.y - 57} h24 v30 h-24z M${area.x + 5} ${area.y - 52} h47 v18 h-47z M${area.x + 64} ${area.y - 34} h20 v32 h-20z M${area.x - 70} ${area.y + 35} h47 v17 h-47z M${area.x - 6} ${area.y + 31} h25 v23 h-25z`} /></g>
          <text x={area.x} y={area.y + 7} textAnchor="middle" className={styles.mapLabel}>{district.name}</text>
          <text x={area.x} y={area.y + 26} textAnchor="middle" className={styles.mapHint}>{isSelected ? "Выбран" : "Выбрать район"}</text>
        </g>;
      })}
      <g aria-hidden="true"><text x="478" y="53" className={styles.compass}>С</text><path d="M483 64 v32 m-6-23 6-9 6 9" fill="none" stroke="#54645d" strokeWidth="2" /></g>
    </svg>
    <p className={styles.small}>Выберите район на карте. С клавиатуры: Tab, затем Enter или пробел.</p>
    {selected && <div className={styles.metrics} aria-label={`Показатели: ${selected.name}`}>
      <h3>{selected.name} <span>· индексы качества / 100</span></h3>
      {Object.entries(selected.baseline).map(([key, value]) => <div key={key} className={styles.metricRow}>
        <span>{directionLabels[key as keyof typeof directionLabels]}</span>
        <meter min={0} max={100} value={after?.[key as keyof typeof after] ?? value} aria-label={`${directionLabels[key as keyof typeof directionLabels]}: ${selected.name}`} />
        <strong>{formatNumber(value)}{after && <> → {formatNumber(after[key as keyof typeof after])}</>}</strong>
      </div>)}
      <p className={styles.small}>{after ? "До → после выбранных мероприятий" : "Исходные показатели. Прогноз появится после подключения расчёта."}</p>
    </div>}
  </section>;
}
